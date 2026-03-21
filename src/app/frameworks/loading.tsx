import Header from "@/components/Header";
import RadioNav from "@/components/RadioNav";

export default function FrameworksLoading() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <RadioNav />
      <div style={{ paddingLeft: "56px" }}>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#e6edf3]">フレームワーク</h1>
            <p className="mt-1 text-sm text-[#636e7b]">
              メンバーのリポジトリで使われているフレームワーク・ライブラリの集計です
            </p>
          </div>
          <div className="w-full rounded-xl border border-[#2ea043]/40 bg-[#0d1117] p-5 shadow-[0_0_20px_rgba(46,160,67,0.15)]">
            {/* タイトル */}
            <div className="mb-4 h-4 w-40 animate-pulse rounded bg-white/5" />
            {/* フィルター行 */}
            <div className="mb-5 flex gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-7 w-24 animate-pulse rounded-full bg-white/5" />
              ))}
            </div>
            {/* バーチャート行 */}
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="h-3 w-24 animate-pulse rounded bg-white/5"
                    style={{ animationDelay: `${i * 40}ms` }}
                  />
                  <div
                    className="h-7 animate-pulse rounded bg-white/5"
                    style={{
                      width: `${60 - i * 4}%`,
                      animationDelay: `${i * 40}ms`,
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
