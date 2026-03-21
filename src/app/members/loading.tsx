import Header from "@/components/Header";
import RadioNav from "@/components/RadioNav";

function MemberCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2">
      <div className="h-9 w-9 animate-pulse rounded-full bg-white/5" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-28 animate-pulse rounded bg-white/5" />
        <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
      </div>
      <div className="h-3.5 w-14 animate-pulse rounded bg-white/5" />
    </div>
  );
}

export default function MembersLoading() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <RadioNav />
      <div style={{ paddingLeft: "56px" }}>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#e6edf3]">メンバー</h1>
            <p className="mt-1 text-sm text-[#636e7b]">
              技研チャートに登録しているメンバー一覧です
            </p>
          </div>
          <div
            className="overflow-hidden rounded-xl"
            style={{ background: "#161b22", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="px-4 pt-5 pb-2">
              <div className="h-3 w-32 animate-pulse rounded bg-white/5" />
            </div>
            <div className="p-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <MemberCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
