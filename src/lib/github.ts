/**
 * GitHub REST API を使ったリポジトリ一覧・使用言語集計モジュール
 *
 * 機能:
 *  - /users/{username}/repos からリポジトリ一覧を取得（ページネーション対応）
 *  - 各リポジトリの /repos/{owner}/{repo}/languages から言語バイト数を取得
 *  - 言語ごとのバイト数を横断集計し、割合付きで返す
 */

import pLimit from "p-limit";

// 集計から除外する言語
const EXCLUDED_LANGUAGES = new Set(["ShaderLab", "HLSL", "GLSL", "Jupyter Notebook"]);

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

export interface GitHubRepo {
  name: string;
  full_name: string;
  language: string | null;
  private: boolean;
  fork: boolean;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  updated_at: string;
  created_at: string;
}

export type LanguageBytes = Record<string, number>;

export interface LanguageStat {
  language: string;
  bytes: number;
  percentage: number;
  repoCount: number;
}

export interface UserLanguageReport {
  username: string;
  totalRepos: number;
  analyzedRepos: number;
  totalBytes: number;
  stats: LanguageStat[];
  fetchedAt: string;
}

// ─────────────────────────────────────────────
// 設定
// ─────────────────────────────────────────────

interface FetchOptions {
  token?: string;
  includeForks?: boolean;
  includePrivate?: boolean;
  concurrency?: number;
}

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// コア関数
// ─────────────────────────────────────────────

export async function fetchUserRepos(
  username: string,
  options: FetchOptions = {},
): Promise<GitHubRepo[]> {
  const { token, includeForks = false, includePrivate = false } = options;

  const allRepos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  console.log(
    `[fetchUserRepos] Fetching repos for "${username}" (includePrivate=${includePrivate}) ...`,
  );

  while (true) {
    const url = includePrivate
      ? `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&affiliation=owner&sort=updated`
      : `https://api.github.com/users/${username}/repos?per_page=${perPage}&page=${page}&type=owner&sort=updated`;

    const res = await githubFetch(url, token);
    const repos: GitHubRepo[] = await res.json();

    if (repos.length === 0) break;

    const filtered = repos.filter((r) => {
      if (!includeForks && r.fork) return false;
      if (!includePrivate && r.private) return false;
      return true;
    });

    allRepos.push(...filtered);
    console.log(`  page ${page}: ${repos.length} repos fetched, ${filtered.length} kept`);

    if (repos.length < perPage) break;
    page++;
  }

  console.log(`[fetchUserRepos] Total: ${allRepos.length} repos`);
  return allRepos;
}

export async function fetchRepoLanguages(
  owner: string,
  repo: string,
  token?: string,
): Promise<LanguageBytes> {
  const url = `https://api.github.com/repos/${owner}/${repo}/languages`;
  const res = await githubFetch(url, token);
  return res.json() as Promise<LanguageBytes>;
}

export async function getUserLanguageStats(
  username: string,
  options: FetchOptions = {},
): Promise<UserLanguageReport> {
  const { token, concurrency = 5 } = options;

  const repos = await fetchUserRepos(username, options);

  console.log(
    `[getUserLanguageStats] Fetching language data for ${repos.length} repos ` +
      `(concurrency=${concurrency}) ...`,
  );

  const limit = pLimit(concurrency);
  const languageResults: LanguageBytes[] = await Promise.all(
    repos.map((repo) =>
      limit(() =>
        fetchRepoLanguages(username, repo.name, token).catch((err) => {
          console.warn(`  [WARN] ${repo.name}: ${err.message}`);
          return {} as LanguageBytes;
        }),
      ),
    ),
  );

  const byteMap: Record<string, number> = {};
  const repoCountMap: Record<string, number> = {};
  let analyzedRepos = 0;

  languageResults.forEach((langBytes) => {
    const keys = Object.keys(langBytes).filter((lang) => !EXCLUDED_LANGUAGES.has(lang));
    if (keys.length > 0) analyzedRepos++;

    keys.forEach((lang) => {
      byteMap[lang] = (byteMap[lang] ?? 0) + langBytes[lang];
      repoCountMap[lang] = (repoCountMap[lang] ?? 0) + 1;
    });
  });

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
