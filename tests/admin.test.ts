import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  scan: vi.fn(),
  del: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/redis", () => ({
  default: { scan: mocks.scan, del: mocks.del },
  requireRedis: () => ({ scan: mocks.scan, del: mocks.del }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findMany: mocks.findMany } } }));
vi.mock("@/lib/github", () => ({ fetchUserRepos: vi.fn(), fetchRepoLanguages: vi.fn() }));
vi.mock("@/lib/github-graphql", () => ({ getContributionData: vi.fn() }));
vi.mock("@/lib/github-history", () => ({ buildHistoricalSnapshots: vi.fn() }));
vi.mock("@/lib/githubStats", () => ({
  fetchUserGitHubStats: vi.fn(),
  calculateGitHubScore: vi.fn(),
}));
vi.mock("@/lib/github-deps", () => ({ getUserFrameworkStats: vi.fn() }));
import { POST as clear } from "@/app/api/admin/clear-depfile-cache/route";
import { POST as refresh } from "@/app/api/admin/refresh/route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ADMIN_USER_IDS", " admin-id , other-admin ");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_GIT_COMMIT_REF", "develop");
  vi.stubEnv("GITHUB_ACCESS_TOKEN", "test-token");
  vi.spyOn(console, "info").mockImplementation(() => {});
  mocks.scan.mockResolvedValue(["0", ["depfile:test"]]);
  mocks.del.mockResolvedValue(1);
  mocks.findMany.mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const request = () =>
  new Request("https://example.test/api/admin/refresh", {
    method: "POST",
    body: JSON.stringify({ role: "admin", userId: "admin-id", force: true }),
  });
describe.each([
  ["clear", () => clear()],
  ["refresh", () => refresh(request())],
] as const)("%s authorization", (name, invoke) => {
  it.each([null, { user: {} }])("rejects missing user ID without side effects", async (session) => {
    mocks.auth.mockResolvedValue(session);
    expect((await invoke()).status).toBe(401);
    expect(mocks.scan).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("rejects ordinary users regardless of submitted admin claims", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "member", role: "admin" } });
    expect((await invoke()).status).toBe(403);
    expect(mocks.scan).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("denies everyone with an empty allowlist", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "");
    mocks.auth.mockResolvedValue({ user: { id: "admin-id" } });
    expect((await invoke()).status).toBe(403);
  });
  it("allows administrators and records actor/action/result", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin-id" } });
    expect((await invoke()).status).toBe(200);
    expect(console.info).toHaveBeenCalledWith(
      "[admin]",
      expect.objectContaining({
        actor: "admin-id",
        status: 200,
        success: true,
      }),
    );
    expect(name === "clear" ? mocks.scan : mocks.findMany).toHaveBeenCalled();
  });
  it("logs failures without exposing raw errors", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin-id" } });
    mocks.scan.mockRejectedValue(new Error("secret"));
    mocks.findMany.mockRejectedValue(new Error("secret"));
    const response = await invoke();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
    expect(console.info).toHaveBeenCalledWith(
      "[admin]",
      expect.objectContaining({ success: false }),
    );
  });
});
it.each([
  ["main", "preview"],
  ["develop", "production"],
  ["", "production"],
])("blocks refresh on branch=%s environment=%s even for admins", async (branch, env) => {
  vi.stubEnv("VERCEL_GIT_COMMIT_REF", branch);
  vi.stubEnv("VERCEL_ENV", env);
  mocks.auth.mockResolvedValue({ user: { id: "admin-id" } });
  expect((await refresh(request())).status).toBe(403);
  expect(mocks.findMany).not.toHaveBeenCalled();
  expect(mocks.del).not.toHaveBeenCalled();
});
