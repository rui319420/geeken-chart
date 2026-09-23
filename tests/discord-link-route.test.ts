import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), issue: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ pool: {} }));
vi.mock("../bot/discord-link", async (original) => ({
  ...(await original<object>()),
  issueLinkCode: mocks.issue,
}));
import { POST } from "@/app/api/user/discord-link/route";
beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});
it("requires authentication before any DB work", async () => {
  mocks.auth.mockResolvedValue(null);
  expect(
    (await POST(new Request("https://site.test/api/user/discord-link", { method: "POST" }))).status,
  ).toBe(401);
  expect(mocks.issue).not.toHaveBeenCalled();
});
it("rejects cross-site requests before issuing a code", async () => {
  mocks.auth.mockResolvedValue({ user: { id: "alice" } });
  expect(
    (
      await POST(
        new Request("https://site.test/api/user/discord-link", {
          method: "POST",
          headers: { origin: "https://evil.test" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(mocks.issue).not.toHaveBeenCalled();
});
it("uses only the session identity and prevents response caching", async () => {
  mocks.auth.mockResolvedValue({ user: { id: "alice" } });
  mocks.issue.mockResolvedValue({ code: "test", expiresAt: "2026-09-23T00:05:00Z" });
  const response = await POST(
    new Request("https://site.test/api/user/discord-link", {
      method: "POST",
      headers: { origin: "https://site.test" },
      body: JSON.stringify({ userId: "bob" }),
    }),
  );
  expect(mocks.issue).toHaveBeenCalledWith({}, "alice");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
