import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import PrivacySettings from "@/components/PrivacySettings";
import ExcludedLanguagesSettings from "@/components/ExcludedLanguagesSettings";

export default async function SettingsPage() {
  const session = await auth();

  // ログインしていない場合はトップページに弾く
  if (!session) {
    redirect("/");
  }

  return (
    <div className="relative min-h-screen bg-[#0d1117]">
      <div className="relative z-10">
        <Header />

        <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#e6edf3]">設定</h1>
            <p className="mt-2 text-sm text-[#8b949e]">
              プロフィールの表示や、集計データの公開範囲を管理します。
            </p>
          </div>

          <section className="mb-8">
            <PrivacySettings />
          </section>

          <section className="mb-8">
            <ExcludedLanguagesSettings />
          </section>
        </main>
      </div>
    </div>
  );
}
