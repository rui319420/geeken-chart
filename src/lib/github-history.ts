const GITHUB_API = "https://api.github.com";

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

  const repos =
    cachedRepos ?? (await fetchAllRepos(githubName, token, includeForks, includePrivate));

  if (repos.length === 0) return [];

  const repoLanguages: { repo: GithubRepo; langBytes: LanguageBytes }[] = cachedLanguages
    ? repos.map((repo) => ({
        repo,
        langBytes: cachedLanguages.get(repo.name) ?? {},
      }))
    : await fetchLanguagesWithConcurrency(githubName, repos, token, concurrency);

  const months = getRecentMonths(monthsBack);

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

// ──────────────────────────────────────────────────────────────────
// 内部ユーティリティ
// ──────────────────────────────────────────────────────────────────

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
