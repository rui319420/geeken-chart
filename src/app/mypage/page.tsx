import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserProfile } from "@/services/profileService";
import ProfileForm from "@/components/ProfileForm";
import Link from "next/link";

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
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* トップへ戻るリンク */}
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
          >
            <span>← トップページに戻る</span>
          </Link>

          {/* 公開プロフィールへのリンク */}
          {userProfile?.githubName && (
            <Link
              href={`/user/${userProfile.githubName}`}
              className="flex items-center gap-1 text-blue-400 transition-colors hover:text-blue-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>公開プロフィールを確認</span>
            </Link>
          )}
        </div>

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
