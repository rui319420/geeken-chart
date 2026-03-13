import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Star, GitCommit, GitPullRequest, CircleDot } from "lucide-react";

export default async function RankingBoard() {
  // ログイン中のユーザー情報を取得
  const session = await auth();
  const currentUserId = session?.user?.id;

  // Top 5 を直接DBから取得する
  const top5UsersRaw = await prisma.user.findMany({
    where: { joinRanking: true, githubScore: { gt: 0 } },
    orderBy: { githubScore: "desc" },
    take: 5,
    select: {
      id: true,
      githubName: true,
      nickname: true,
      avatarUrl: true,
      githubScore: true,
      totalCommits: true,
      totalStars: true,
      totalPRs: true,
      totalIssues: true,
      isAnonymous: true,
    },
  });

  const top5Users = top5UsersRaw.map((user, index) => {
    // 自分のスコアと同じスコアを持つ一番最初の人のインデックスを探し、それに+1する。
    // 例: スコアが [100, 100, 90] の場合
    // 1人目(100): 100が最初に出現するのはindex 0 -> 0 + 1 = 1位
    // 2人目(100): 100が最初に出現するのはindex 0 -> 0 + 1 = 1位
    // 3人目( 90):  90が最初に出現するのはindex 2 -> 2 + 1 = 3位
    const displayRank = top5UsersRaw.findIndex((u) => u.githubScore === user.githubScore) + 1;

    return { ...user, displayRank };
  });

  // 自分の順位とデータを個別に取得する
  let myRank = -1;
  let myData = null;

  if (currentUserId) {
    // まず自分のデータを取得
    myData = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        githubName: true,
        nickname: true,
        avatarUrl: true,
        githubScore: true,
        isAnonymous: true,
      },
    });

    // 自分がランキングに参加しており、スコアが0より大きい場合のみ順位を計算
    if (myData && myData.githubScore && myData.githubScore > 0) {
      // 自分よりスコアが高い人の数をカウントする
      const higherScoreCount = await prisma.user.count({
        where: {
          joinRanking: true,
          githubScore: { gt: myData.githubScore },
        },
      });
      myRank = higherScoreCount + 1;
    } else {
      myData = null; // ランキング不参加の場合は表示しない
    }
  }

  return (
    <div className="flex w-full flex-col rounded-xl border border-white/5 bg-[#161b22] p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-sm font-bold tracking-widest text-[#636e7b] uppercase">ランキング</h2>
      </div>

      {/* Top 5 リスト */}
      <ul className="flex flex-col gap-3">
        {top5Users.map((user) => {
          const rankColor =
            user.displayRank === 1
              ? "text-yellow-400"
              : user.displayRank === 2
                ? "text-gray-300"
                : user.displayRank === 3
                  ? "text-orange-400"
                  : "text-[#8b949e]";

          return (
            <li
              key={user.id}
              className="group flex items-center justify-between rounded-lg border border-white/5 bg-white/2 p-4 transition-all duration-200 hover:border-white/10 hover:bg-white/4"
            >
              <div className="flex items-center gap-4">
                {/* 順位バッジ */}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${rankColor} ${user.displayRank <= 3 ? "bg-white/5" : ""}`}
                >
                  {user.displayRank}
                </div>

                {/* アイコンと名前 */}
                <div className="flex items-center gap-3">
                  {user.avatarUrl && !user.isAnonymous ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt={user.githubName}
                      className="h-8 w-8 rounded-full border border-white/10"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-600 text-xs text-white">
                      👻
                    </div>
                  )}
                  <span className="font-medium text-[#c9d1d9] transition-colors group-hover:text-white">
                    {user.isAnonymous ? "匿名ユーザー" : (user.nickname ?? user.githubName)}
                  </span>
                  {/* スコア内訳 */}
                  <div className="mt-1.5 ml-9 flex items-center gap-3 text-[11px] text-[#8b949e]">
                    <span title="Stars" className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500/80" /> {user.totalStars}
                    </span>
                    <span title="Commits" className="flex items-center gap-1">
                      <GitCommit className="h-3 w-3 text-[#39d353]/80" /> {user.totalCommits}
                    </span>
                    <span title="Pull Requests" className="flex items-center gap-1">
                      <GitPullRequest className="h-3 w-3 text-purple-400/80" /> {user.totalPRs}
                    </span>
                    <span title="Issues" className="flex items-center gap-1">
                      <CircleDot className="h-3 w-3 text-green-400/80" /> {user.totalIssues}
                    </span>
                  </div>
                </div>
              </div>

              {/* スコア */}
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-[#39d353]">{user.githubScore}</span>
                <span className="pb-0.5 text-xs text-[#8b949e]">pts</span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* ログインユーザー自身の順位（常に表示、匿名化しない） */}
      {myData && (
        <>
          <div className="my-6 flex items-center">
            <div className="h-px grow bg-white/5"></div>
            <span className="px-4 text-xs font-semibold text-[#8b949e]">Your Rank</span>
            <div className="h-px grow bg-white/5"></div>
          </div>

          <div className="relative flex items-center justify-between overflow-hidden rounded-lg border border-[#39d353]/30 bg-[#39d353]/5 p-4">
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center font-bold text-[#8b949e]">
                {myRank}
              </div>
              <div className="flex items-center gap-3">
                {myData.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={myData.avatarUrl}
                    alt={myData.githubName}
                    className="h-8 w-8 rounded-full border border-white/10"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-600" />
                )}
                <span className="font-medium text-[#c9d1d9]">
                  {myData.nickname ?? myData.githubName}
                </span>
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-1.5">
              <span className="text-lg font-bold text-[#39d353]">{myData.githubScore}</span>
              <span className="pb-0.5 text-xs text-[#8b949e]">pts</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
