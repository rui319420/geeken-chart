import Header from "@/components/Header";
import RadioNav from "@/components/RadioNav";

function RankingRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/2 p-4">
      <div className="flex items-center gap-4">
        {/* 順位 */}
        <div className="h-8 w-8 animate-pulse rounded-full bg-white/5" />
        <div className="flex items-center gap-3">
          {/* アバター */}
          <div className="h-8 w-8 animate-pulse rounded-full bg-white/5" />
          <div className="space-y-1.5">
            {/* 名前 */}
            <div className="h-3.5 w-24 animate-pulse rounded bg-white/5" />
            {/* スコア内訳 */}
            <div className="h-3 w-40 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      </div>
      {/* スコア */}
      <div className="h-5 w-16 animate-pulse rounded bg-white/5" />
    </div>
  );
}

export default function RankingLoading() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <RadioNav />
      <div style={{ paddingLeft: "56px" }}>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-6 md:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#e6edf3]">ランキング</h1>
            <p className="mt-1 text-sm text-[#636e7b]">GitHubスコアによるメンバーランキングです</p>
          </div>
          <div className="flex w-full flex-col rounded-xl border border-white/5 bg-[#161b22] p-6">
            <div className="mb-6 h-4 w-20 animate-pulse rounded bg-white/5" />
            <ul className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <RankingRowSkeleton key={i} />
              ))}
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
