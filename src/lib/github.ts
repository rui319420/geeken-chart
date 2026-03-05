/**
 * GitHub REST API を使ったリポジトリ一覧・使用言語集計モジュール
 *
 * 機能:
 *  - /users/{username}/repos からリポジトリ一覧を取得（ページネーション対応）
 *  - 各リポジトリの /repos/{owner}/{repo}/languages から言語バイト数を取得
 *  - 言語ごとのバイト数を横断集計し、割合付きで返す
 */

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

export interface GitHubRepo {
  name: string;
  full_name: string;
  language: string | null; // リポジトリのプライマリ言語
  private: boolean;
  fork: boolean;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  updated_at: string;
}

/** /repos/{owner}/{repo}/languages レスポンス: { "TypeScript": 12345, "CSS": 678 } */
export type LanguageBytes = Record<string, number>;

export interface LanguageStat {
  language: string;
  bytes: number;
  percentage: number; // 全バイト数に占める割合 (0–100)
  repoCount: number; // この言語が含まれるリポジトリ数
}

export interface UserLanguageReport {
  username: string;
  totalRepos: number;
  analyzedRepos: number; // 言語データを取得できたリポジトリ数
  totalBytes: number;
  stats: LanguageStat[]; // 降順ソート済み
  fetchedAt: string;
}

// ─────────────────────────────────────────────
// 設定
// ─────────────────────────────────────────────

interface FetchOptions {
  /** GitHub Personal Access Token（レートリミット緩和用。省略可） */
  token?: string;
  /** フォークを集計に含めるか（デフォルト: false） */
  includeForks?: boolean;
  /** プライベートリポジトリを含めるか（デフォルト: false） */
  includePrivate?: boolean;
  /** 1リクエストあたりの並列数（デフォルト: 5） */
  concurrency?: number;
}

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

/**
 * GitHub API 用 fetch ラッパー
 * - Authorization ヘッダーの付与
 * - レートリミット残数をコンソール表示
 * - 4xx/5xx をエラーとして throw
 */
async function githubFetch(url: string, token?: string): Promise<Response> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });

  const remaining = res.headers.get("x-ratelimit-remaining");
  const resetTs = res.headers.get("x-ratelimit-reset");
  if (remaining !== null) {
    const resetTime = resetTs ? new Date(Number(resetTs) * 1000).toLocaleTimeString() : "unknown";
    console.debug(`[RateLimit] remaining=${remaining}, reset=${resetTime} | ${url}`);
  }

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText} — ${url}`);
  }
  return res;
}

/**
 * Promise を最大 concurrency 件ずつ順次実行する
 * （全件並列だと GitHub API のレートリミットに引っかかるため）
 */
async function pLimit<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const current = idx++;
      results[current] = await tasks[current]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ─────────────────────────────────────────────
// コア関数
// ─────────────────────────────────────────────

/**
 * ユーザーの全リポジトリを取得する（ページネーション対応）
 *
 * @param username  GitHub ユーザー名
 * @param options   FetchOptions
 * @returns GitHubRepo[]
 */
export async function fetchUserRepos(
  username: string,
  options: FetchOptions = {},
): Promise<GitHubRepo[]> {
  const { token, includeForks = false, includePrivate = false } = options;

  const allRepos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100; // GitHub API の上限

  console.log(`[fetchUserRepos] Fetching repos for "${username}" ...`);

  while (true) {
    const url =
      `https://api.github.com/users/${username}/repos` +
      `?per_page=${perPage}&page=${page}&type=owner&sort=updated`;

    const res = await githubFetch(url, token);
    const repos: GitHubRepo[] = await res.json();

    if (repos.length === 0) break;

    // フォーク / プライベートのフィルタ
    const filtered = repos.filter((r) => {
      if (!includeForks && r.fork) return false;
      if (!includePrivate && r.private) return false;
      return true;
    });

    allRepos.push(...filtered);
    console.log(`  page ${page}: ${repos.length} repos fetched, ${filtered.length} kept`);

    // 最終ページ判定
    if (repos.length < perPage) break;
    page++;
  }

  console.log(`[fetchUserRepos] Total: ${allRepos.length} repos`);
  return allRepos;
}

/**
 * 単一リポジトリの言語バイト数を取得する
 *
 * @param owner  リポジトリオーナー名
 * @param repo   リポジトリ名
 * @param token  GitHub PAT（省略可）
 * @returns LanguageBytes  例: { "TypeScript": 45678, "CSS": 1234 }
 */
export async function fetchRepoLanguages(
  owner: string,
  repo: string,
  token?: string,
): Promise<LanguageBytes> {
  const url = `https://api.github.com/repos/${owner}/${repo}/languages`;
  const res = await githubFetch(url, token);
  return res.json() as Promise<LanguageBytes>;
}

/**
 * ユーザーの全リポジトリを横断して言語バイト数を集計する
 *
 * @param username  GitHub ユーザー名
 * @param options   FetchOptions
 * @returns UserLanguageReport
 */
export async function getUserLanguageStats(
  username: string,
  options: FetchOptions = {},
): Promise<UserLanguageReport> {
  const { token, concurrency = 5 } = options;

  // Step 1: リポジトリ一覧を取得
  const repos = await fetchUserRepos(username, options);

  // Step 2: 各リポジトリの言語データを並列取得（concurrency 制限付き）
  console.log(
    `[getUserLanguageStats] Fetching language data for ${repos.length} repos ` +
      `(concurrency=${concurrency}) ...`,
  );

  const tasks = repos.map(
    (repo) => () =>
      fetchRepoLanguages(username, repo.name, token).catch((err) => {
        // 取得失敗しても集計を止めない（空オブジェクトを返す）
        console.warn(`  [WARN] ${repo.name}: ${err.message}`);
        return {} as LanguageBytes;
      }),
  );

  const languageResults: LanguageBytes[] = await pLimit(tasks, concurrency);

  // Step 3: 言語ごとに集計
  const byteMap: Record<string, number> = {};
  const repoCountMap: Record<string, number> = {};
  let analyzedRepos = 0;

  languageResults.forEach((langBytes) => {
    const keys = Object.keys(langBytes);
    if (keys.length > 0) analyzedRepos++;

    keys.forEach((lang) => {
      byteMap[lang] = (byteMap[lang] ?? 0) + langBytes[lang];
      repoCountMap[lang] = (repoCountMap[lang] ?? 0) + 1;
    });
  });

  // Step 4: 割合を計算してソート
  const totalBytes = Object.values(byteMap).reduce((s, v) => s + v, 0);

  const stats: LanguageStat[] = Object.entries(byteMap)
    .map(([language, bytes]) => ({
      language,
      bytes,
      percentage: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
      repoCount: repoCountMap[language] ?? 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  return {
    username,
    totalRepos: repos.length,
    analyzedRepos,
    totalBytes,
    stats,
    fetchedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────
// フォーマット用ヘルパー
// ─────────────────────────────────────────────

/**
 * 集計結果をコンソール用のサマリーテキストに変換する
 */
export function formatReport(report: UserLanguageReport): string {
  const lines: string[] = [
    `═══════════════════════════════════════════`,
    `  GitHub Language Stats — @${report.username}`,
    `═══════════════════════════════════════════`,
    `  Repos   : ${report.analyzedRepos} / ${report.totalRepos} analyzed`,
    `  Total   : ${report.totalBytes.toLocaleString()} bytes`,
    `  Fetched : ${report.fetchedAt}`,
    `───────────────────────────────────────────`,
  ];

  report.stats.slice(0, 10).forEach((s, i) => {
    const bar = "█".repeat(Math.round(s.percentage / 2));
    lines.push(
      `  ${String(i + 1).padStart(2)}. ${s.language.padEnd(18)} ` +
        `${s.percentage.toFixed(1).padStart(5)}%  ${bar}`,
    );
  });

  if (report.stats.length > 10) {
    lines.push(`      ... and ${report.stats.length - 10} more languages`);
  }

  lines.push(`═══════════════════════════════════════════`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────
// 使用例（直接実行用）
// ─────────────────────────────────────────────

// Node.js / Deno / Bun から直接実行する場合
// ts-node github-language-stats.ts
//
// または import して使う場合:
// import { getUserLanguageStats, formatReport } from "./github-language-stats";
//
// const report = await getUserLanguageStats("torvalds", {
//   token: process.env.GITHUB_TOKEN,  // PAT（任意）
//   includeForks: false,
//   concurrency: 5,
// });
// console.log(formatReport(report));
// console.log(JSON.stringify(report.stats, null, 2));
