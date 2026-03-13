// GraphQLのレスポンスの型定義
export interface GitHubStatsResponse {
  totalStars: number;
  totalCommits: number;
  totalPRs: number;
  totalIssues: number;
}

/**
 * GitHub GraphQL API を使ってユーザーの総合貢献度を取得する
 * @param username GitHubユーザー名 (login)
 * @param token GitHub Personal Access Token
 */
export async function fetchUserGitHubStats(
  username: string,
  token: string,
): Promise<GitHubStatsResponse> {
  // GraphQL APIのエンドポイント
  const url = "https://api.github.com/graphql";

  const query = `
    query userInfo($login: String!) {
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
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          nodes {
            stargazerCount
          }
        }
      }
    }
  `;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const body = JSON.stringify({
    query,
    variables: { login: username },
  });

  // fetchでGraphQLのPostリクエストを送信
  const res = await fetch(url, { method: "POST", headers, body });

  if (!res.ok) {
    throw new Error(`GraphQL API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  if (json.errors) {
    throw new Error(`GraphQL Error: ${json.errors[0].message}`);
  }

  const userData = json.data.user;

  if (!userData) {
    throw new Error(`User not found: ${username}`);
  }

  // 取得したデータから必要な数値を抽出
  const totalCommits = userData.contributionsCollection.totalCommitContributions;
  const totalPRs = userData.pullRequests.totalCount;
  const totalIssues = userData.issues.totalCount;

  // Star数は、全リポジトリのStar数を合計する
  const totalStars = userData.repositories.nodes.reduce(
    (sum: number, repo: { stargazerCount: number }) => sum + repo.stargazerCount,
    0,
  );

  return {
    totalStars,
    totalCommits,
    totalPRs,
    totalIssues,
  };
}

/**
 * 総合スコア（Geeken Score）を計算するロジック
 */
export function calculateGitHubScore(stats: GitHubStatsResponse): number {
  return (
    stats.totalStars * 10 + stats.totalPRs * 5 + stats.totalIssues * 3 + stats.totalCommits * 1
  );
}
