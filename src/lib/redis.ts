import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisClient = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
const warnedOperations = new Set<string>();

function warnOnce(operation: string, error?: unknown) {
  if (warnedOperations.has(operation)) return;
  warnedOperations.add(operation);
  console.warn("[redis] " + operation + " unavailable; continuing without cache", error);
}

function fallbackFor(operation: PropertyKey) {
  if (operation === "get") return null;
  if (operation === "del") return 0;
  return null;
}

/**
 * Redis is an optional cache. Reads and writes must not make the application
 * unavailable when the free database is paused, deleted, or misconfigured.
 */
const redis = new Proxy((redisClient ?? {}) as Redis, {
  get(target, operation, receiver) {
    const method = Reflect.get(target, operation, receiver);
    if (typeof method !== "function") return method;

    return (...args: unknown[]) => {
      if (!redisClient) {
        warnOnce(String(operation), new Error("UPSTASH_REDIS_REST_URL/TOKEN is not configured"));
        return Promise.resolve(fallbackFor(operation));
      }

      try {
        return Promise.resolve(method.apply(target, args)).catch((error) => {
          warnOnce(String(operation), error);
          return fallbackFor(operation);
        });
      } catch (error) {
        warnOnce(String(operation), error);
        return Promise.resolve(fallbackFor(operation));
      }
    };
  },
}) as Redis;

export default redis;

export const TTL = {
  /** コントリビューション（草）: 1時間 */
  CONTRIBUTIONS: 60 * 60,
  /** 使用言語統計: 6時間 */
  LANGUAGES: 60 * 60 * 6,
} as const;

export const cacheKey = {
  contributions: (username: string, year?: number) =>
    year ? "contributions:" + username + ":" + year : "contributions:" + username + ":latest",
  languages: (username: string) => "languages:" + username,
};

/**
 * キャッシュがあればそれを返し、なければfetcherを実行する。
 * Redisが利用できない場合もfetcherへフォールバックする。
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await redis.get<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  await redis.set(key, data, { ex: ttl });
  return data;
}

export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key);
}

/** Administrative mutations must report cache failures instead of falling back. */
export function requireRedis(): Redis {
  if (!redisClient) throw new Error("Redis is not configured");
  return redisClient;
}
