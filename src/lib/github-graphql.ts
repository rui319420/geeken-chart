const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

// ──────────────────────────────────────
// 型定義
// ──────────────────────────────────────

export type ContributionDay = {
  date: string; // "YYYY-MM-DD"
  contributionCount: number;
  weekday: number; // 0=Sun, 6=Sat
};

export type ContributionWeek = {
  contributionDays: ContributionDay[];
};

export type ContributionCalendar = {
  totalContributions: number;
  weeks: ContributionWeek[];
};

export type ContributionData = {
  totalContributions: number;
  weeks: ContributionWeek[];
  /** 過去365日分のフラットな配列（チャート描画用） */
  days: ContributionDay[];
};

// ──────────────────────────────────────
// GraphQL クエリ
// ──────────────────────────────────────

const CONTRIBUTION_QUERY = `
  query GetContributions($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              weekday
            }
          }
        }
      }
    }
  }
`;

// ──────────────────────────────────────
// フェッチ関数
// ──────────────────────────────────────

/**
 * GitHub GraphQL APIを呼び出す汎用関数
 */
async function fetchGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<T> {
  const res = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GitHub GraphQL API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };

  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  if (!json.data) {
    throw new Error("No data returned from GitHub GraphQL API");
  }

  return json.data;
}

// ──────────────────────────────────────
// コントリビューション取得
// ──────────────────────────────────────

type GraphQLContributionResponse = {
  user: {
    contributionsCollection: {
      contributionCalendar: ContributionCalendar;
    };
  } | null;
};

/**
 * 指定ユーザーの過去1年分のコントリビューションデータを取得する
 *
 * @param username  GitHubのユーザー名
 * @param token     GitHubのPersonal Access Token（read:user スコープが必要）
 * @param year      取得する年（省略時は直近1年）
 */
export async function getContributionData(
  username: string,
  token: string,
  year?: number,
): Promise<ContributionData> {
  const now = new Date();

  let from: Date;
  let to: Date;

  if (year !== undefined) {
    from = new Date(`${year}-01-01T00:00:00Z`);
    to = new Date(`${year}-12-31T23:59:59Z`);
    if (to > now) to = now;
  } else {
    to = now;
    from = new Date(now);
    from.setFullYear(from.getFullYear() - 1);
  }

  const data = await fetchGraphQL<GraphQLContributionResponse>(
    CONTRIBUTION_QUERY,
    {
      username,
      from: from.toISOString(),
      to: to.toISOString(),
    },
    token,
  );

  if (!data.user) {
    throw new Error(`GitHub user not found: ${username}`);
  }

  const calendar = data.user.contributionsCollection.contributionCalendar;

  const days: ContributionDay[] = calendar.weeks.flatMap((week) => week.contributionDays);

  return {
    totalContributions: calendar.totalContributions,
    weeks: calendar.weeks,
    days,
  };
}
