import { auth } from "@/auth";
import LandingPage from "@/components/LandingPage";
import Header from "@/components/Header";
import StatsCards from "@/components/StatsCards";
import CombinedHeatmap from "@/components/CombinedHeatmap";
import LanguagePieChart from "@/components/LanguagePieChart";
import ContributionGraph from "@/components/ContributionGraph";
import LanguageTrendChart from "@/components/LanguageTrendChart";
import RefreshButton from "@/components/RefreshButton";
import PrivacySettings from "@/components/PrivacySettings";
import DiscordHeatmap from "@/components/DiscordHeatmap";
import RankingBoard from "@/components/RankingBoard";

function MemberList() {
  const members = [{ name: "rui319420", avatar: "https://github.com/rui319420.png" }];
  return (
    <div className="flex w-full flex-col rounded-xl border border-white/5 bg-[#161b22] p-6">
      <h2 className="mb-4 text-sm font-bold tracking-widest text-[#636e7b] uppercase">メンバー</h2>
      <div className="flex flex-wrap gap-3">
        {members.map((m) => (
          <a
            key={m.name}
            href={`https://github.com/${m.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded-lg border border-white/5 bg-white/3 px-3 py-2 transition-all duration-200 hover:border-white/10 hover:bg-white/6"
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

const isDev = process.env.NODE_ENV === "development";

// ランディングと共通の背景レイヤー
function Background() {
  const dots = Array.from({ length: 80 }, (_, i) => ({
    x: (i * 137.508) % 100,
    y: (i * 97.3) % 100,
    r: 0.8 + (i % 4) * 0.5,
    op: 0.04 + (i % 5) * 0.025,
  }));

  return (
    <>
      <svg
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {dots.map((d, i) => (
          <circle key={i} cx={`${d.x}%`} cy={`${d.y}%`} r={d.r} fill="#39d353" opacity={d.op} />
        ))}
      </svg>
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          backgroundImage:
            "linear-gradient(rgba(48,54,61,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(48,54,61,0.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "-20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "400px",
          background: "radial-gradient(ellipse, rgba(57,211,83,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </>
  );
}

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    return <LandingPage />;
  }

  return (
    <div className="relative min-h-screen bg-[#0d1117]">
      <Background />

      <div className="relative z-10">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
          <section className="mb-6">
            <StatsCards />
          </section>

          <section className="mb-6">
            <CombinedHeatmap />
          </section>

          <section className="mb-6">
            <ContributionGraph />
          </section>

          <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <LanguagePieChart />
            <MemberList />
          </section>

          <section className="mb-6">
            <LanguageTrendChart />
          </section>

          <section className="mb-6">
            <DiscordHeatmap />
          </section>

          <section className="mb-6">
            <RankingBoard />
          </section>

          <section className="mb-6">
            <PrivacySettings />
          </section>

          {isDev && (
            <section className="mt-10 border-t border-white/5 pt-8">
              <p className="mb-3 text-xs font-semibold tracking-widest text-[#636e7b] uppercase">
                開発用ツール
              </p>
              <RefreshButton />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
