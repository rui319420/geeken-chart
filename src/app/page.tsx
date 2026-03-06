import LanguagePieChart from "@/components/LanguagePieChart";
import LanguageTrendChart from "@/components/LanguageTrendChart";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0d1117] p-6 text-[#F2F3F5] md:p-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-[#2ea043]/30 pb-6">
          <h1 className="bg-gradient-to-r from-[#2ea043] to-[#5865F2] bg-clip-text text-3xl font-extrabold tracking-tight text-transparent md:text-4xl">
            Circle Vital Dashboard
          </h1>
          <p className="mt-2 text-[15px] text-[#949BA4]">
            GitHubとDiscordのAPIを活用したサークル活動トレンドの可視化
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6">
          <section>
            <LanguagePieChart />
          </section>
          <section>
            <LanguageTrendChart />
          </section>

          {/* 今後、他のグラフ（コミット数やDiscordのアクティブ時間など）を追加する場合はここに並べます */}
          {/* <section> ... </section> */}
        </div>
      </div>
    </main>
  );
}
