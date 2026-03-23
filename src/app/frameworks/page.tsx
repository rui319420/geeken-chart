import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import RadioNav from "@/components/RadioNav";
import FrameworkChart from "@/components/FrameworkChart";
import PageShell from "@/components/PageShell";

export default async function FrameworksPage() {
  const session = await auth();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <RadioNav />
      <PageShell>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#e6edf3]">フレームワーク</h1>
            <p className="mt-1 text-sm text-[#636e7b]">
              メンバーのリポジトリで使われているフレームワーク・ライブラリの集計です
            </p>
          </div>
          <FrameworkChart />
        </main>
      </PageShell>
    </div>
  );
}
