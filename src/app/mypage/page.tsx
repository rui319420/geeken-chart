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
    <div className="min-h-screen bg-[#0d1117] py-10">
      <div className="container mx-auto max-w-3xl p-6">
        <h1 className="mb-8 text-2xl font-bold text-white">マイページ設定</h1>

        <div className="rounded-xl border border-gray-800 bg-[#161b22] p-6 shadow-xl">
          <p className="mb-6 text-gray-400">
            こんにちは、
            <span className="font-bold text-white">
              {userProfile.nickname || userProfile.githubName}
            </span>{" "}
            さん！
            <br />
            ここでプロフィールやSNSリンクを編集できます。
          </p>

          <ProfileForm initialData={userProfile} />
        </div>
      </div>
    </div>
  );
}
