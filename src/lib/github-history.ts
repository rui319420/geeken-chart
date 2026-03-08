/**
 * github-history.ts
 *
 * GitHubのREST APIから全リポジトリの言語データ（Linguist解析済み）を取得し、
 * 各月末時点で存在していたリポジトリを使って言語使用率の歴史的トレンドを再構築する。
 *
 * アプローチ：
 *   - GitHub は各リポジトリに対してLinguistを実行しており、
 *     GET /repos/{owner}/{repo}/languages で結果を取得できる
 *   - リポジトリの created_at を使って「その月末時点で存在していたリポジトリ」を絞り込む
 *   - これにより後から参加したユーザーでも即座に過去12ヶ月分のデータが生成できる
 */

const GITHUB_API = "https://api.github.com";
const TOP_LANGUAGES = 5;

const EXCLUDED_LANGUAGES = new Set(["ShaderLab", "HLSL", "GLSL"]);

export interface MonthlySnapshot {
  /** "2026-03" 形式 */
  month: string;
  /** 言語 → bytes の合計 */
  languages: Record<string, number>;
}

interface GithubRepo {
  name: string;
  created_at: string; // ISO8601
  fork: boolean;
}

interface LanguageBytes {
  [language: string]: number;
}

/**
 * ユーザーの過去 monthsBack ヶ月分の言語スナップショットを構築する。
 *
 * @param githubName  GitHubユーザー名
 * @param token       GitHubアクセストークン（includePrivate=trueならOAuthトークン）
 * @param options.monthsBack   何ヶ月分遡るか（デフォルト12）
 * @param options.includeForks フォークリポジトリを含めるか（デフォルトfalse）
 * @param options.concurrency  言語API並列数（デフォルト5）
 */
export async function buildHistoricalSnapshots(
  githubName: string,
  token: string,
  options: {
    monthsBack?: number;
    includeForks?: boolean;
    includePrivate?: boolean;
    concurrency?: number;
  } = {},
): Promise<MonthlySnapshot[]> {
  const {
    monthsBack = 12,
    includeForks = false,
    includePrivate = false,
    concurrency = 5,
  } = options;

  // ──────────────────────────────────────────────────────────────
  // 1. 全リポジトリを取得（ページネーション対応）
  // ──────────────────────────────────────────────────────────────
  const repos = await fetchAllRepos(githubName, token, includeForks, includePrivate);

  if (repos.length === 0) return [];

  // ──────────────────────────────────────────────────────────────
  // 2. 各リポジトリの言語データを並列取得（Linguist済みデータ）
  // ──────────────────────────────────────────────────────────────
  const repoLanguages = await fetchLanguagesWithConcurrency(githubName, repos, token, concurrency);

  // ──────────────────────────────────────────────────────────────
  // 3. 月リストを生成（古い順）
  // ──────────────────────────────────────────────────────────────
  const months = getRecentMonths(monthsBack);

  // ──────────────────────────────────────────────────────────────
  // 4. 各月末時点で存在していたリポジトリを使って言語bytesを合算
  // ──────────────────────────────────────────────────────────────
  const snapshots: MonthlySnapshot[] = months.map((month) => {
    const monthEnd = getMonthEnd(month); // その月の最終日
    const languages: Record<string, number> = {};

    for (const { repo, langBytes } of repoLanguages) {
      const repoCreated = new Date(repo.created_at);
      if (repoCreated <= monthEnd) {
        // その月末時点で存在していたリポジトリ
        for (const [lang, bytes] of Object.entries(langBytes)) {
          languages[lang] = (languages[lang] ?? 0) + bytes;
        }
      }
    }

    return { month, languages };
  });

  // データが全くない月はスキップ
  return snapshots.filter((s) => Object.keys(s.languages).length > 0);
}

/**
 * buildHistoricalSnapshots の結果から、
 * トレンドグラフ用の DataPoint[] を生成する。
 * 全期間で使用量上位 TOP_LANGUAGES 言語のみ返す。
 */
export function toTrendDataPoints(
  snapshots: MonthlySnapshot[],
): { month: string; [lang: string]: string | number }[] {
  if (snapshots.length === 0) return [];

  // 全期間での合計 bytes でトップ言語を選定
  const totals: Record<string, number> = {};
  for (const { languages } of snapshots) {
    for (const [lang, bytes] of Object.entries(languages)) {
      totals[lang] = (totals[lang] ?? 0) + bytes;
    }
  }
  const topLangs = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LANGUAGES)
    .map(([lang]) => lang);

  return snapshots.map(({ month, languages }) => {
    const total = Object.values(languages).reduce((s, b) => s + b, 0);
    const point: { month: string; [lang: string]: string | number } = {
      month: formatMonth(month), // "2026/3"
    };
    for (const lang of topLangs) {
      const bytes = languages[lang] ?? 0;
      point[lang] = total > 0 ? Math.round((bytes / total) * 1000) / 10 : 0;
    }
    return point;
  });
}

// ──────────────────────────────────────────────────────────────
// 内部ユーティリティ
// ──────────────────────────────────────────────────────────────

async function fetchAllRepos(
  githubName: string,
  token: string,
  includeForks: boolean,
  includePrivate: boolean,
): Promise<GithubRepo[]> {
  const repos: GithubRepo[] = [];
  let page = 1;

  while (true) {
    // /users/{username}/repos は公開リポジトリのみ返す（トークンがあっても）
    // プライベートを含める場合は /user/repos（認証ユーザー自身用）を使う
    const url = includePrivate
      ? `${GITHUB_API}/user/repos?per_page=100&page=${page}&affiliation=owner&sort=updated`
      : `${GITHUB_API}/users/${githubName}/repos?per_page=100&page=${page}&type=owner`;

    const res = await fetch(url, { headers: buildHeaders(token) });
    if (!res.ok) break;

    const batch: GithubRepo[] = await res.json();
    if (batch.length === 0) break;

    for (const repo of batch) {
      if (!includeForks && repo.fork) continue;
      repos.push(repo);
    }

    if (batch.length < 100) break;
    page++;
  }

  return repos;
}

async function fetchLanguagesWithConcurrency(
  githubName: string,
  repos: GithubRepo[],
  token: string,
  concurrency: number,
): Promise<{ repo: GithubRepo; langBytes: LanguageBytes }[]> {
  const results: { repo: GithubRepo; langBytes: LanguageBytes }[] = [];
  const queue = [...repos];

  // concurrency 数ずつ並列処理
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    const batchResults = await Promise.all(
      batch.map(async (repo) => {
        try {
          const res = await fetch(`${GITHUB_API}/repos/${githubName}/${repo.name}/languages`, {
            headers: buildHeaders(token),
          });
          if (!res.ok) return { repo, langBytes: {} };
          const langBytes: LanguageBytes = await res.json();
          // ★ 除外言語を削除
          for (const lang of EXCLUDED_LANGUAGES) delete langBytes[lang];
          return { repo, langBytes };
        } catch {
          return { repo, langBytes: {} };
        }
      }),
    );
    results.push(...batchResults);
  }

  return results;
}

function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** 直近 n ヶ月の "YYYY-MM" 配列（古い順） */
function getRecentMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

/** "2026-03" → その月の最終日の Date（23:59:59） */
function getMonthEnd(yyyyMM: string): Date {
  const [y, m] = yyyyMM.split("-").map(Number);
  // 翌月1日の前日 = その月の最終日
  return new Date(y, m, 0, 23, 59, 59, 999);
}

/** "2026-03" → "2026/3" */
function formatMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return `${y}/${parseInt(m, 10)}`;
}
