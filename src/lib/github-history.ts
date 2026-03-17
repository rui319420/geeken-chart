const GITHUB_API = "https://api.github.com";
const TOP_LANGUAGES = 5;

const EXCLUDED_LANGUAGES = new Set(["ShaderLab", "HLSL", "GLSL", "Jupyter Notebook"]);

export interface MonthlySnapshot {
  month: string;
  languages: Record<string, number>;
}

export interface GithubRepo {
  name: string;
  created_at: string;
  fork: boolean;
}

export interface LanguageBytes {
  [language: string]: number;
}

export async function buildHistoricalSnapshots(
  githubName: string,
  token: string,
  options: {
    monthsBack?: number;
    includeForks?: boolean;
    includePrivate?: boolean;
    concurrency?: number;
    cachedRepos?: GithubRepo[];
    cachedLanguages?: Map<string, LanguageBytes>;
  } = {},
): Promise<MonthlySnapshot[]> {
  const {
    monthsBack = 12,
    includeForks = false,
    includePrivate = false,
    concurrency = 5,
    cachedRepos,
    cachedLanguages,
  } = options;

  // ──────────────────────────────────────────────────────────────
  // 1. リポジトリ一覧（キャッシュがあればそれを使う）
  // ──────────────────────────────────────────────────────────────
  const repos =
    cachedRepos ?? (await fetchAllRepos(githubName, token, includeForks, includePrivate));

  if (repos.length === 0) return [];

  // ──────────────────────────────────────────────────────────────
  // 2. 言語データ（キャッシュがあれば API 呼び出しをスキップ）
  // ──────────────────────────────────────────────────────────────
  const repoLanguages: { repo: GithubRepo; langBytes: LanguageBytes }[] = cachedLanguages
    ? repos.map((repo) => ({
        repo,
        langBytes: cachedLanguages.get(repo.name) ?? {},
      }))
    : await fetchLanguagesWithConcurrency(githubName, repos, token, concurrency);

  // ──────────────────────────────────────────────────────────────
  // 3. 月リストを生成（古い順）
  // ──────────────────────────────────────────────────────────────
  const months = getRecentMonths(monthsBack);

  // ──────────────────────────────────────────────────────────────
  // 4. 各月末時点で存在していたリポジトリを使って言語bytesを合算
  // ──────────────────────────────────────────────────────────────
  const snapshots: MonthlySnapshot[] = months.map((month) => {
    const monthEnd = getMonthEnd(month);
    const languages: Record<string, number> = {};

    for (const { repo, langBytes } of repoLanguages) {
      const repoCreated = new Date(repo.created_at);
      if (repoCreated <= monthEnd) {
        for (const [lang, bytes] of Object.entries(langBytes)) {
          if (EXCLUDED_LANGUAGES.has(lang)) continue;
          languages[lang] = (languages[lang] ?? 0) + bytes;
        }
      }
    }

    return { month, languages };
  });

  return snapshots.filter((s) => Object.keys(s.languages).length > 0);
}

export function toTrendDataPoints(
  snapshots: MonthlySnapshot[],
): { month: string; [lang: string]: string | number }[] {
  if (snapshots.length === 0) return [];

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
      month: formatMonth(month),
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

function getRecentMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function getMonthEnd(yyyyMM: string): Date {
  const [y, m] = yyyyMM.split("-").map(Number);
  return new Date(y, m, 0, 23, 59, 59, 999);
}

function formatMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return `${y}/${parseInt(m, 10)}`;
}
