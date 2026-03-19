import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import RadioNav from "@/components/RadioNav";

export default async function SnsPage() {
  const session = await auth();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <RadioNav />
      <div style={{ paddingLeft: "56px" }}>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-6 md:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#e6edf3]">SNS</h1>
            <p className="mt-1 text-sm text-[#636e7b]">技研メンバーのSNSアカウントをまとめます</p>
          </div>
          <div
            className="flex items-center justify-center rounded-xl py-24"
            style={{ background: "#161b22", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-sm" style={{ color: "#484f58" }}>
              SNSページは準備中です
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
