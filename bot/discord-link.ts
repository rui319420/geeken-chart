import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";

export class LinkError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

// A transaction-scoped lock serializes linking, unlinking and incoming messages
// for the same Discord identity, including across multiple Bot processes.
export async function lockDiscord(db: PoolClient, discordId: string) {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    "discord-link:" + discordId,
  ]);
}

async function transaction<T>(pool: Pool, work: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await work(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

async function rateLimit(pool: Pool, key: string, maximum: number) {
  // This statement commits independently: invalid attempts must also count.
  await pool.query('DELETE FROM "DiscordLinkRateLimit" WHERE "resetAt" <= NOW()');
  const result = await pool.query<{ attempts: number }>(
    `INSERT INTO "DiscordLinkRateLimit" ("key", "attempts", "resetAt")
     VALUES ($1, 1, NOW() + INTERVAL '5 minutes')
     ON CONFLICT ("key") DO UPDATE SET "attempts" = "DiscordLinkRateLimit"."attempts" + 1
     RETURNING "attempts"`,
    [key],
  );
  if (result.rows[0].attempts > maximum) {
    throw new LinkError(429, "試行回数の上限です。5分後にもう一度お試しください。");
  }
}

export async function issueLinkCode(pool: Pool, userId: string) {
  await rateLimit(pool, "issue:" + userId, 5);
  const code = randomBytes(24).toString("hex");
  return transaction(pool, async (db) => {
    const user = await db.query('SELECT "id", "discordId" FROM "User" WHERE "id" = $1 FOR UPDATE', [
      userId,
    ]);
    if (!user.rowCount) throw new LinkError(401, "ログインし直してください。");
    if (user.rows[0].discordId)
      throw new LinkError(409, "連携済みです。Discordの /unlink で解除してください。");
    await db.query('DELETE FROM "DiscordLinkCode" WHERE "expiresAt" <= NOW()');
    const result = await db.query<{ expiresAt: Date }>(
      `INSERT INTO "DiscordLinkCode" ("userId", "codeHash", "expiresAt")
       VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
       ON CONFLICT ("userId") DO UPDATE SET "codeHash" = EXCLUDED."codeHash",
       "expiresAt" = EXCLUDED."expiresAt" RETURNING "expiresAt"`,
      [userId, hash(code)],
    );
    return { code, expiresAt: result.rows[0].expiresAt.toISOString() };
  });
}

export async function consumeLinkCode(pool: Pool, discordId: string, code: string) {
  await rateLimit(pool, "consume:" + discordId, 5);
  if (!/^[a-f0-9]{48}$/.test(code))
    throw new LinkError(400, "連携コードが無効または期限切れです。");
  return transaction(pool, async (db) => {
    await lockDiscord(db, discordId);
    // Atomic DELETE RETURNING allows exactly one consumer to obtain the code.
    const claim = await db.query<{ userId: string }>(
      'DELETE FROM "DiscordLinkCode" WHERE "codeHash" = $1 AND "expiresAt" > clock_timestamp() RETURNING "userId"',
      [hash(code)],
    );
    if (!claim.rowCount) throw new LinkError(400, "連携コードが無効または期限切れです。");
    const userId = claim.rows[0].userId;
    const user = await db.query<{ githubName: string; discordId: string | null }>(
      'SELECT "githubName", "discordId" FROM "User" WHERE "id" = $1 FOR UPDATE',
      [userId],
    );
    const other = await db.query('SELECT "id" FROM "User" WHERE "discordId" = $1 AND "id" <> $2', [
      discordId,
      userId,
    ]);
    if (
      !user.rowCount ||
      other.rowCount ||
      (user.rows[0].discordId && user.rows[0].discordId !== discordId)
    ) {
      throw new LinkError(
        409,
        "すでに別のアカウントと連携しています。先に連携を解除してください。",
      );
    }
    await db.query('UPDATE "User" SET "discordId" = $1, "updatedAt" = NOW() WHERE "id" = $2', [
      discordId,
      userId,
    ]);
    // Replace the snapshot instead of incrementing it on each link.
    await db.query('DELETE FROM "DiscordActivity" WHERE "userId" = $1', [userId]);
    await db.query(
      `INSERT INTO "DiscordActivity" ("id", "userId", "dayOfWeek", "hour", "messageCount", "updatedAt")
       SELECT $1 || ':' || "dayOfWeek" || ':' || "hour", $1, "dayOfWeek", "hour",
       SUM("messageCount")::integer, NOW() FROM "RawDiscordActivity"
       WHERE "discordId" = $2 GROUP BY "dayOfWeek", "hour"`,
      [userId, discordId],
    );
    return { userId, githubName: user.rows[0].githubName };
  });
}

export async function unlinkDiscord(pool: Pool, discordId: string) {
  return transaction(pool, async (db) => {
    await lockDiscord(db, discordId);
    const result = await db.query<{ id: string; githubName: string }>(
      'UPDATE "User" SET "discordId" = NULL, "updatedAt" = NOW() WHERE "discordId" = $1 RETURNING "id", "githubName"',
      [discordId],
    );
    if (result.rowCount) {
      await db.query('DELETE FROM "DiscordActivity" WHERE "userId" = $1', [result.rows[0].id]);
      await db.query('DELETE FROM "DiscordLinkCode" WHERE "userId" = $1', [result.rows[0].id]);
    }
    return result.rows[0] ?? null;
  });
}

export async function recordLinkedMessage(
  pool: Pool,
  input: {
    discordId: string;
    weekKey: string;
    dayOfWeek: number;
    hour: number;
    channelId: string;
    channelName: string;
  },
) {
  return transaction(pool, async (db) => {
    await lockDiscord(db, input.discordId);
    await db.query(
      `INSERT INTO "RawDiscordActivity"
       ("id", "discordId", "weekKey", "dayOfWeek", "hour", "channelId", "channelName", "messageCount", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW())
       ON CONFLICT ("discordId", "weekKey", "dayOfWeek", "hour", "channelId")
       DO UPDATE SET "messageCount" = "RawDiscordActivity"."messageCount" + 1, "updatedAt" = NOW()`,
      [
        randomBytes(16).toString("hex"),
        input.discordId,
        input.weekKey,
        input.dayOfWeek,
        input.hour,
        input.channelId,
        input.channelName,
      ],
    );
    // Resolve membership inside the transaction; no stale in-memory link cache.
    await db.query(
      `INSERT INTO "DiscordActivity" ("id", "userId", "dayOfWeek", "hour", "messageCount", "updatedAt")
       SELECT "id" || ':' || $2::text || ':' || $3::text, "id", $2::integer, $3::integer, 1, NOW()
       FROM "User" WHERE "discordId" = $1
       ON CONFLICT ("userId", "dayOfWeek", "hour")
       DO UPDATE SET "messageCount" = "DiscordActivity"."messageCount" + 1, "updatedAt" = NOW()`,
      [input.discordId, input.dayOfWeek, input.hour],
    );
  });
}
