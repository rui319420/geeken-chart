import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import RadioNav from "@/components/RadioNav";
import PrivacySettings from "@/components/PrivacySettings";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <RadioNav />
      <div style={{ paddingLeft: "56px" }}>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-6 md:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#e6edf3]">設定</h1>
            <p className="mt-1 text-sm text-[#636e7b]">公開設定やプロフィールを管理します</p>
          </div>
          <PrivacySettings />
        </main>
      </div>
    </div>
  );
}
