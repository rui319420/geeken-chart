import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import {
  consumeLinkCode,
  issueLinkCode,
  recordLinkedMessage,
  unlinkDiscord,
} from "../bot/discord-link";

let db: PGlite;
let pool: Pool;
// PGlite has a single connection. Lease it for complete transactions, just as
// pg.Pool(max: 1) would. SQL, constraints, rollback and claims are real Postgres;
// multi-connection advisory-lock scheduling requires a native Postgres test.
let tail = Promise.resolve();
async function acquire() {
  const prior = tail;
  let release!: () => void;
  tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prior;
  return release;
}
async function query(sql: string, values?: unknown[]) {
  const result = await db.query(sql, values);
  return { rows: result.rows, rowCount: result.affectedRows || result.rows.length };
}
beforeAll(async () => {
  db = await PGlite.create();
  // Existing migration history is missing some RawDiscordActivity columns.
  // Build the baseline from the declared schema without accessing an external DB.
  const schema = execFileSync(
    "node_modules/.bin/prisma",
    [
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://test:test@localhost:5432/test",
        DIRECT_URL: "postgresql://test:test@localhost:5432/test",
      },
    },
  );
  await db.exec(schema);
  await db.exec('DROP TABLE "DiscordLinkCode", "DiscordLinkRateLimit"');
  await db.exec(
    await readFile(
      "prisma/migrations/20260923030000_discord_link_verification/migration.sql",
      "utf8",
    ),
  );
  pool = {
    async query(sql: string, values?: unknown[]) {
      const release = await acquire();
      try {
        return await query(sql, values);
      } finally {
        release();
      }
    },
    async connect() {
      const release = await acquire();
      return { query, release };
    },
  } as unknown as Pool;
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec('TRUNCATE "User" CASCADE; TRUNCATE "RawDiscordActivity", "DiscordLinkRateLimit";');
  await db.query(
    'INSERT INTO "User" ("id", "githubId", "githubName", "updatedAt") VALUES ($1, $2, $3, NOW()), ($4, $5, $6, NOW())',
    ["alice", "1", "alice-name", "bob", "2", "bob-name"],
  );
});
const message = {
  discordId: "discord-a",
  weekKey: "2026-W39",
  dayOfWeek: 1,
  hour: 10,
  channelId: "channel",
  channelName: "general",
};
async function count() {
  return (
    await db.query<{ total: number }>(
      'SELECT COALESCE(SUM("messageCount"), 0)::integer AS total FROM "DiscordActivity"',
    )
  ).rows[0].total;
}
it("does not accept a GitHub name or invalid code", async () => {
  await expect(consumeLinkCode(pool, "discord-a", "alice-name")).rejects.toMatchObject({
    status: 400,
  });
  expect(
    (await db.query('SELECT "id" FROM "User" WHERE "discordId" IS NOT NULL')).rows,
  ).toHaveLength(0);
});
it("stores only a hash and links the authenticated owner's code", async () => {
  const issued = await issueLinkCode(pool, "alice");
  expect(issued.code).toMatch(/^[a-f0-9]{48}$/);
  const stored = (await db.query<{ codeHash: string }>('SELECT "codeHash" FROM "DiscordLinkCode"'))
    .rows[0];
  expect(stored.codeHash).not.toContain(issued.code);
  expect(await consumeLinkCode(pool, "discord-a", issued.code)).toEqual({
    userId: "alice",
    githubName: "alice-name",
  });
  await expect(consumeLinkCode(pool, "discord-b", issued.code)).rejects.toMatchObject({
    status: 400,
  });
});
it("rejects expired and replaced codes", async () => {
  const first = await issueLinkCode(pool, "alice");
  const second = await issueLinkCode(pool, "alice");
  await expect(consumeLinkCode(pool, "discord-a", first.code)).rejects.toMatchObject({
    status: 400,
  });
  await db.exec('UPDATE "DiscordLinkCode" SET "expiresAt" = NOW() - INTERVAL \'1 second\'');
  await expect(consumeLinkCode(pool, "discord-a", second.code)).rejects.toMatchObject({
    status: 400,
  });
});
it("allows exactly one of two simultaneous claims", async () => {
  const { code } = await issueLinkCode(pool, "alice");
  const results = await Promise.allSettled([
    consumeLinkCode(pool, "discord-a", code),
    consumeLinkCode(pool, "discord-b", code),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
});
it("rejects identity conflicts and rolls back the code claim", async () => {
  const a = await issueLinkCode(pool, "alice");
  const b = await issueLinkCode(pool, "bob");
  await consumeLinkCode(pool, "discord-a", a.code);
  await expect(consumeLinkCode(pool, "discord-a", b.code)).rejects.toMatchObject({ status: 409 });
  expect((await consumeLinkCode(pool, "discord-b", b.code)).userId).toBe("bob");
});
it("rejects a different Discord identity when the GitHub account was linked meanwhile", async () => {
  const issued = await issueLinkCode(pool, "alice");
  await db.exec('UPDATE "User" SET "discordId" = \'discord-b\' WHERE "id" = \'alice\'');
  await expect(consumeLinkCode(pool, "discord-a", issued.code)).rejects.toMatchObject({
    status: 409,
  });
  await expect(issueLinkCode(pool, "alice")).rejects.toMatchObject({ status: 409 });
});
it("limits invalid attempts and code issuance, and resumes after the window", async () => {
  for (let n = 0; n < 5; n++) {
    await expect(consumeLinkCode(pool, "discord-a", "invalid")).rejects.toMatchObject({
      status: 400,
    });
    await issueLinkCode(pool, "alice");
  }
  await expect(consumeLinkCode(pool, "discord-a", "invalid")).rejects.toMatchObject({
    status: 429,
  });
  await expect(issueLinkCode(pool, "alice")).rejects.toMatchObject({ status: 429 });
  await db.exec('UPDATE "DiscordLinkRateLimit" SET "resetAt" = NOW() - INTERVAL \'1 second\'');
  await expect(issueLinkCode(pool, "alice")).resolves.toHaveProperty("code");
});
it("does not double-count history on relink and immediately stops attribution on unlink", async () => {
  await recordLinkedMessage(pool, message);
  expect(await count()).toBe(0);
  const first = await issueLinkCode(pool, "alice");
  await consumeLinkCode(pool, "discord-a", first.code);
  expect(await count()).toBe(1);
  await recordLinkedMessage(pool, message);
  expect(await count()).toBe(2);
  await expect(consumeLinkCode(pool, "discord-a", first.code)).rejects.toMatchObject({
    status: 400,
  });
  expect(await count()).toBe(2);
  await unlinkDiscord(pool, "discord-a");
  expect(await count()).toBe(0);
  await recordLinkedMessage(pool, message);
  expect(await count()).toBe(0);
  const second = await issueLinkCode(pool, "alice");
  await consumeLinkCode(pool, "discord-a", second.code);
  expect(await count()).toBe(3);
});
it("handles a simultaneous message and link without losing or duplicating a message", async () => {
  const { code } = await issueLinkCode(pool, "alice");
  await Promise.all([consumeLinkCode(pool, "discord-a", code), recordLinkedMessage(pool, message)]);
  expect(await count()).toBe(1);
});
it("fails closed when the database is unavailable", async () => {
  const broken = { query: () => Promise.reject(new Error("unavailable")) } as unknown as Pool;
  await expect(issueLinkCode(broken, "alice")).rejects.toThrow();
  await expect(consumeLinkCode(broken, "discord-a", "a".repeat(48))).rejects.toThrow();
});
