import { auth } from "@/auth";
import Header from "@/components/Header";
import StatsCards from "@/components/StatsCards";
import CombinedHeatmap from "@/components/CombinedHeatmap";
import LanguagePieChart from "@/components/LanguagePieChart";
import ContributionGraph from "@/components/ContributionGraph";

// メンバー一覧（仮）
function MemberList() {
  const members = [{ name: "rui319420", avatar: "https://github.com/rui319420.png" }];

  return (
    <div className="flex w-full flex-col rounded-xl border border-white/5 bg-[#0d1117] p-6">
      <h2 className="mb-4 text-sm font-bold tracking-widest text-[#636e7b] uppercase">メンバー</h2>
      <div className="flex flex-wrap gap-3">
        {members.map((m) => (
          <a
            key={m.name}
            href={`https://github.com/${m.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.06]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.avatar} alt={m.name} width={24} height={24} className="rounded-full" />
            <span className="text-xs text-[#949BA4] group-hover:text-[#F2F3F5]">{m.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        {/* 未ログイン時のバナー */}
        {!session && (
          <div className="mb-8 rounded-xl border border-[#2ea043]/20 bg-[#2ea043]/5 px-5 py-4">
            <p className="text-sm text-[#949BA4]">
              <span className="font-medium text-[#3fb950]">GitHubでログイン</span>
              すると、あなたの活動もダッシュボードに反映されます。
            </p>
          </div>
        )}

        {/* StatsCards - 1カラム */}
        <section className="mb-6">
          <StatsCards />
        </section>

        {/* ヒートマップ - 1カラム */}
        <section className="mb-6">
          <CombinedHeatmap />
        </section>
        <section className="mb-6">
          <ContributionGraph />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LanguagePieChart />
          <MemberList />
        </section>
      </main>
    </div>
  );
}
