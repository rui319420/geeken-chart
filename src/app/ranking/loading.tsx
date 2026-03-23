import Header from "@/components/Header";
import RadioNav from "@/components/RadioNav";

const shimmerStyle = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .sk {
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0.03) 25%,
      rgba(255,255,255,0.07) 50%,
      rgba(255,255,255,0.03) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.8s ease-in-out infinite;
    border-radius: 6px;
  }
`;

function RankingRowSkeleton({ index }: { index: number }) {
  const d = index * 0.07;
  // 名前の幅を変える
  const nameWidths = [96, 80, 110, 88, 76];
  const nameW = nameWidths[index % nameWidths.length];

  return (
    <li
      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-4"
      style={{ animationDelay: `${d}s` }}
    >
      <div className="flex items-center gap-4">
        {/* 順位 */}
        <div
          className="sk h-8 w-8 rounded-full"
          style={{ animationDelay: `${d}s`, borderRadius: "50%" }}
        />
        <div className="flex items-center gap-3">
          {/* アバター */}
          <div
            className="sk h-8 w-8 shrink-0 rounded-full"
            style={{ animationDelay: `${d + 0.04}s`, borderRadius: "50%" }}
          />
          <div>
            {/* 名前 */}
            <div
              className="sk h-3.5 rounded"
              style={{ width: `${nameW}px`, animationDelay: `${d + 0.06}s` }}
            />
            {/* スコア内訳（アイコン4つ） */}
            <div className="mt-1.5 flex items-center gap-3">
              {[0, 1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="sk h-3 w-10 rounded"
                  style={{ animationDelay: `${d + 0.08 + j * 0.03}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* スコア */}
      <div className="sk h-5 w-16 rounded" style={{ animationDelay: `${d + 0.1}s` }} />
    </li>
  );
}

export default function RankingLoading() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <style>{shimmerStyle}</style>
      <RadioNav />
      <div style={{ paddingLeft: "56px" }}>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-6 md:px-6">
          {/* ページヘッダー */}
          <div className="mb-6">
            <div className="sk mb-2 h-7 w-36 rounded" style={{ animationDelay: "0.05s" }} />
            <div className="sk h-3.5 w-72 rounded" style={{ animationDelay: "0.1s" }} />
          </div>

          <div className="flex w-full flex-col rounded-xl border border-white/5 bg-[#161b22] p-6">
            {/* セクションラベル */}
            <div className="sk mb-6 h-3.5 w-20 rounded" style={{ animationDelay: "0.1s" }} />

            <ul className="flex flex-col gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <RankingRowSkeleton key={i} index={i} />
              ))}
            </ul>

            {/* Your Rank 区切り */}
            <div className="my-6 flex items-center">
              <div className="h-px flex-1 bg-white/5" />
              <div className="sk mx-4 h-3 w-20 rounded" style={{ animationDelay: "0.4s" }} />
              <div className="h-px flex-1 bg-white/5" />
            </div>

            {/* 自分の順位カード */}
            <div
              className="flex items-center justify-between rounded-lg border border-[#39d353]/20 bg-[#39d353]/5 p-4"
              style={{ animationDelay: "0.45s" }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="sk h-8 w-8 rounded-full"
                  style={{ animationDelay: "0.45s", borderRadius: "50%" }}
                />
                <div className="flex items-center gap-3">
                  <div
                    className="sk h-8 w-8 rounded-full"
                    style={{ animationDelay: "0.5s", borderRadius: "50%" }}
                  />
                  <div className="sk h-3.5 w-24 rounded" style={{ animationDelay: "0.52s" }} />
                </div>
              </div>
              <div className="sk h-5 w-16 rounded" style={{ animationDelay: "0.55s" }} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
