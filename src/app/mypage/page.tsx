import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserProfile } from "@/services/profileService";
import ProfileForm from "@/components/ProfileForm";

export default async function MyPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const userProfile = await getUserProfile(session.user.id);

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <h1 className="mb-8 text-2xl font-bold text-white">マイページ設定</h1>

      <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-6 shadow-xl">
        <p className="mb-4 text-gray-400">
          こんにちは、{userProfile.nickname || userProfile.githubName} さん！
          <br />
          ここでプロフィールやSNSリンクを編集できます。
        </p>

        <ProfileForm initialData={userProfile} />
      </div>
    </div>
  );
}
