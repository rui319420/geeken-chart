// GraphQLのレスポンスの型定義
export interface GitHubStatsResponse {
  totalStars: number;
  totalCommits: number;
  totalPRs: number;
  totalIssues: number;
}

// ──────────────────────────────────────────────────────────────────
// クエリ定義
// ──────────────────────────────────────────────────────────────────

/**
 * コミット数・PR数・Issue数をまとめて取得するクエリ（1回のみ実行）
 */
const STATS_QUERY = `
  query userStats($login: String!) {
    user(login: $login) {
      contributionsCollection {
        totalCommitContributions
      }
      pullRequests(first: 1) {
        totalCount
      }
      issues(first: 1) {
        totalCount
      }
    }
  }
`;

/**
 * リポジトリのStar数をページネーションで取得するクエリ
 * after が null のときは最初のページを取得する
 */
const REPOS_QUERY = `
  query userRepos($login: String!, $cursor: String) {
    user(login: $login) {
      repositories(
        first: 100
        ownerAffiliations: OWNER
        isFork: false
        after: $cursor
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          stargazerCount
        }
      }
    }
  }
`;

// ──────────────────────────────────────────────────────────────────
// 汎用フェッチ関数
// ──────────────────────────────────────────────────────────────────

const GRAPHQL_URL = "https://api.github.com/graphql";

async function fetchGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GraphQL API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL Error: ${json.errors[0].message}`);
  }

  if (!json.data) {
    throw new Error("No data returned from GitHub GraphQL API");
  }

  return json.data;
}

// ──────────────────────────────────────────────────────────────────
// 型定義（GraphQLレスポンス）
// ──────────────────────────────────────────────────────────────────

interface StatsQueryResponse {
  user: {
    contributionsCollection: {
      totalCommitContributions: number;
    };
    pullRequests: { totalCount: number };
    issues: { totalCount: number };
  } | null;
}

interface ReposQueryResponse {
  user: {
    repositories: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: { stargazerCount: number }[];
    };
  } | null;
}

// ──────────────────────────────────────────────────────────────────
// Star数の全件取得（ページネーションループ）
// ──────────────────────────────────────────────────────────────────

/**
 * `repositories(first: 100, after: $cursor)` を
 * hasNextPage が false になるまで繰り返し、全リポジトリの Star 数を合算して返す。
 */
async function fetchTotalStars(username: string, token: string): Promise<number> {
  let totalStars = 0;
  let cursor: string | null = null;

  do {
    const data = await fetchGraphQL<ReposQueryResponse>(
      REPOS_QUERY,
      { login: username, cursor },
      token,
    );

    if (!data.user) {
      throw new Error(`GitHub user not found: ${username}`);
    }

    const nodes: { stargazerCount: number }[] = data.user.repositories.nodes;
    const pageInfo: { hasNextPage: boolean; endCursor: string | null } =
      data.user.repositories.pageInfo;

    totalStars += nodes.reduce((sum, repo) => sum + repo.stargazerCount, 0);

    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor;
  } while (true);

  return totalStars;
}

// ──────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────

/**
 * GitHub GraphQL API を使ってユーザーの総合貢献度を取得する。
 *
 * - コミット数・PR数・Issue数 → 1クエリで取得
 * - Star数 → リポジトリ数が100超のユーザーに対応するためページネーションで全件取得
 *
 * @param username GitHubユーザー名 (login)
 * @param token    GitHub Personal Access Token
 */
export async function fetchUserGitHubStats(
  username: string,
  token: string,
): Promise<GitHubStatsResponse> {
  // コミット・PR・Issue は1クエリで完結する
  const statsData = await fetchGraphQL<StatsQueryResponse>(STATS_QUERY, { login: username }, token);

  if (!statsData.user) {
    throw new Error(`GitHub user not found: ${username}`);
  }

  const { contributionsCollection, pullRequests, issues } = statsData.user;

  // Star数はページネーションで全件集計
  const totalStars = await fetchTotalStars(username, token);

  return {
    totalStars,
    totalCommits: contributionsCollection.totalCommitContributions,
    totalPRs: pullRequests.totalCount,
    totalIssues: issues.totalCount,
  };
}

/**
 * 総合スコア（Geeken Score）を計算するロジック
 * 既存の呼び出し元（admin/refresh/route.ts）との互換を維持する
 */
export function calculateGitHubScore(stats: GitHubStatsResponse): number {
  return (
    stats.totalStars * 10 + stats.totalPRs * 5 + stats.totalIssues * 3 + stats.totalCommits * 1
  );
}
