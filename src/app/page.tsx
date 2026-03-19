import { auth } from "@/auth";
import LandingPage from "@/components/LandingPage";
import Header from "@/components/Header";
import StatsCards from "@/components/StatsCards";
import CombinedHeatmap from "@/components/CombinedHeatmap";
import LanguagePieChart from "@/components/LanguagePieChart";
import ContributionGraph from "@/components/ContributionGraph";
import LanguageTrendChart from "@/components/LanguageTrendChart";
import RefreshButton from "@/components/RefreshButton";
import DiscordHeatmap from "@/components/DiscordHeatmap";
import FrameworkChart from "@/components/FrameworkChart";
import RadioNav from "@/components/RadioNav";

const isDev = process.env.NODE_ENV === "development";

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
  if (!session) return <LandingPage />;

  return (
    <div className="relative min-h-screen bg-[#0d1117]">
      <Background />
      <RadioNav />

      <div className="relative z-10" style={{ paddingLeft: "56px" }}>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
          <section id="dashboard" className="mb-6">
            <StatsCards />
          </section>
          <section className="mb-6">
            <CombinedHeatmap />
          </section>
          <section className="mb-6">
            <ContributionGraph />
          </section>
          <section id="languages" className="mb-6">
            <LanguagePieChart />
          </section>
          <section className="mb-6">
            <LanguageTrendChart />
          </section>
          <section id="discord" className="mb-6">
            <DiscordHeatmap />
          </section>
          <section className="mb-6">
            <FrameworkChart />
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
