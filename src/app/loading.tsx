import RadioNav from "@/components/RadioNav";
import Header from "@/components/Header";

function CardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/5 bg-[#0d1117] p-6">
      <div className="h-9 w-24 animate-pulse rounded bg-white/5" />
      <div className="mt-1 h-3.5 w-20 animate-pulse rounded bg-white/5" />
    </div>
  );
}

function BlockSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div
      className={`w-full animate-pulse rounded-xl border border-white/5 bg-[#0d1117] ${height}`}
    />
  );
}

export default function HomeLoading() {
  return (
    <div className="relative min-h-screen bg-[#0d1117]">
      <RadioNav />
      <div className="relative z-10" style={{ paddingLeft: "56px" }}>
        <Header />
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
          {/* StatsCards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
          {/* CombinedHeatmap */}
          <BlockSkeleton height="h-52" />
          {/* ContributionGraph */}
          <BlockSkeleton height="h-72" />
          {/* Pie charts */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <BlockSkeleton height="h-112" />
            <BlockSkeleton height="h-112" />
          </div>
          {/* LanguageTrendChart */}
          <BlockSkeleton height="h-80" />
          {/* DiscordHeatmap */}
          <BlockSkeleton height="h-64" />
        </main>
      </div>
    </div>
  );
}
