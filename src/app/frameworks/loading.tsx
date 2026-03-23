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

export default function FrameworksLoading() {
  // 仮の棒グラフデータ（幅をずらして自然に見せる）
  const bars = [85, 72, 68, 61, 55, 50, 46, 42, 38, 34, 30, 26];

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <style>{shimmerStyle}</style>
      <RadioNav />
      <div style={{ paddingLeft: "56px" }}>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          {/* ページヘッダー */}
          <div className="mb-6">
            <div className="sk mb-2 h-7 w-44 rounded" style={{ animationDelay: "0.05s" }} />
            <div className="sk h-3.5 w-80 rounded" style={{ animationDelay: "0.1s" }} />
          </div>

          <div className="w-full rounded-xl border border-[#2ea043]/30 bg-[#0d1117] p-5">
            {/* コンポーネントタイトル */}
            <div className="sk mb-5 h-4 w-48 rounded" style={{ animationDelay: "0.1s" }} />

            {/* ソート + カテゴリフィルター行 */}
            <div className="mb-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="sk h-3 w-16 rounded" style={{ animationDelay: "0.1s" }} />
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="sk h-7 w-20 rounded-md"
                      style={{ animationDelay: `${0.12 + i * 0.06}s` }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="sk h-3 w-12 rounded" style={{ animationDelay: "0.15s" }} />
                {[80, 96, 88, 72, 100, 64].map((w, i) => (
                  <div
                    key={i}
                    className="sk h-7 rounded-full"
                    style={{ width: `${w}px`, animationDelay: `${0.15 + i * 0.05}s` }}
                  />
                ))}
              </div>
            </div>

            {/* 横棒グラフのスケルトン */}
            <div className="space-y-3" style={{ paddingLeft: "100px", paddingRight: "48px" }}>
              {/* X軸ラベル（上） */}
              <div className="flex justify-between px-1 pb-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="sk h-3 w-6 rounded"
                    style={{ animationDelay: `${0.2 + i * 0.03}s` }}
                  />
                ))}
              </div>
              {bars.map((width, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  {/* Y軸ラベル */}
                  <div
                    className="sk h-3.5 rounded"
                    style={{
                      width: "96px",
                      marginLeft: "-100px",
                      animationDelay: `${0.2 + i * 0.04}s`,
                    }}
                  />
                  {/* バー */}
                  <div
                    className="sk h-7 rounded"
                    style={{
                      width: `${width}%`,
                      animationDelay: `${0.25 + i * 0.04}s`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
