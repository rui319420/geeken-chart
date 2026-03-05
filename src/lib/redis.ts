import { Redis } from "@upstash/redis";

// ──────────────────────────────────────
// Redisクライアント（シングルトン）
// ──────────────────────────────────────

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default redis;

// ──────────────────────────────────────
// TTL 定数
// ──────────────────────────────────────

export const TTL = {
  /** コントリビューション（草）: 1時間 */
  CONTRIBUTIONS: 60 * 60,
  /** 使用言語統計: 6時間 */
  LANGUAGES: 60 * 60 * 6,
} as const;

// ──────────────────────────────────────
// キャッシュキー生成
// ──────────────────────────────────────

export const cacheKey = {
  contributions: (username: string, year?: number) =>
    year ? `contributions:${username}:${year}` : `contributions:${username}:latest`,
  languages: (username: string) => `languages:${username}`,
};

// ──────────────────────────────────────
// 汎用キャッシュラッパー
// ──────────────────────────────────────

/**
 * キャッシュがあればそれを返し、なければ fetcher を実行してキャッシュに保存する。
 *
 * @param key     Redisのキー
 * @param ttl     有効期限（秒）
 * @param fetcher キャッシュミス時に実行する非同期関数
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  // キャッシュヒット
  const cached = await redis.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // キャッシュミス → 取得してキャッシュに保存
  const data = await fetcher();
  await redis.set(key, data, { ex: ttl });
  return data;
}

/**
 * 指定キーのキャッシュを手動で削除する（データ更新時などに使用）
 */
export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key);
}
