import Header from "@/components/Header";
import RadioNav from "@/components/RadioNav";
import RankingBoard from "@/components/RankingBoard";

// middleware で認証ガード済みのため auth() + redirect() は不要
export default function RankingPage() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <RadioNav />
      <div style={{ paddingLeft: "56px" }}>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-6 md:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#e6edf3]">ランキング</h1>
            <p className="mt-1 text-sm text-[#636e7b]">GitHubスコアによるメンバーランキングです</p>
          </div>
          <RankingBoard />
        </main>
      </div>
    </div>
  );
}
