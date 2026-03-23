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

function MemberRowSkeleton({ index }: { index: number }) {
  // 表示名の幅を変えてリアルに見せる
  const nameWidths = [100, 80, 120, 90, 110, 75, 95, 85];
  const handleWidths = [72, 88, 65, 80, 76, 68, 84, 70];
  const nameW = nameWidths[index % nameWidths.length];
  const handleW = handleWidths[index % handleWidths.length];
  const d = index * 0.05;

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      {/* アバター */}
      <div
        className="sk h-9 w-9 shrink-0 rounded-full"
        style={{ animationDelay: `${d}s`, borderRadius: "50%" }}
      />
      {/* テキスト */}
      <div className="flex-1 space-y-1.5">
        <div
          className="sk h-3.5 rounded"
          style={{ width: `${nameW}px`, animationDelay: `${d + 0.05}s` }}
        />
        <div
          className="sk h-3 rounded"
          style={{ width: `${handleW}px`, animationDelay: `${d + 0.1}s` }}
        />
      </div>
      {/* スコア（一部のみ表示） */}
      {index % 3 !== 2 && (
        <div
          className="sk h-3.5 w-14 shrink-0 rounded"
          style={{ animationDelay: `${d + 0.08}s` }}
        />
      )}
    </div>
  );
}

export default function MembersLoading() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <style>{shimmerStyle}</style>
      <RadioNav />
      <div style={{ paddingLeft: "56px" }}>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
          {/* ページヘッダー */}
          <div className="mb-8">
            <div className="sk mb-2 h-7 w-28 rounded" style={{ animationDelay: "0.05s" }} />
            <div className="sk h-3.5 w-72 rounded" style={{ animationDelay: "0.1s" }} />
          </div>

          <div
            className="overflow-hidden rounded-xl"
            style={{ background: "#161b22", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {/* Discord連携済みセクション */}
            <div
              className="px-4 pt-5 pb-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <div className="sk h-2.5 w-36 rounded" style={{ animationDelay: "0.1s" }} />
            </div>
            <div className="p-2">
              {[0, 1, 2].map((i) => (
                <MemberRowSkeleton key={i} index={i} />
              ))}
            </div>

            {/* メンバーセクション */}
            <div
              className="px-4 pt-5 pb-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <div className="sk h-2.5 w-24 rounded" style={{ animationDelay: "0.15s" }} />
            </div>
            <div className="p-2">
              {[3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <MemberRowSkeleton key={i} index={i} />
              ))}
            </div>
          </div>

          {/* フッターテキスト */}
          <div className="mt-4 flex justify-center">
            <div className="sk h-3 w-56 rounded" style={{ animationDelay: "0.3s" }} />
          </div>
        </main>
      </div>
    </div>
  );
}
