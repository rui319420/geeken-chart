import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import Image from "next/image";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ githubName: string }>;
}) {
  const resolvedParams = await params;
  const githubName = resolvedParams.githubName;

  const user = await prisma.user.findFirst({
    where: { githubName: githubName },
    include: {
      links: true,
      languages: {
        orderBy: { bytes: "desc" },
        take: 8,
      },
    },
  });

  if (!user) {
    notFound();
  }

  const session = await auth();
  const isOwner = session?.user?.id === user.id;

  const displayName = user.nickname || user.githubName;
  const avatarUrl = user.avatarUrl || `https://github.com/${user.githubName}.png`;

  return (
    <div className="min-h-screen bg-[#0d1117] py-10">
      <div className="container mx-auto max-w-3xl p-6">
        <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#161b22] shadow-xl">
          <div className="flex flex-col items-center gap-6 border-b border-gray-800 p-8 sm:flex-row sm:items-start">
            <Image
              src={avatarUrl}
              alt={displayName}
              width={96}
              height={96}
              className="h-24 w-24 rounded-full border-2 border-gray-700 object-cover shadow-lg"
            />
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-bold text-white">{displayName}</h1>
              <p className="text-gray-400">@{user.githubName}</p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <a
                  href={`https://github.com/${user.githubName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-md bg-[#21262d] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#30363d]"
                >
                  GitHubプロフィールを見る ↗
                </a>

                {/* isOwner（本人）の時だけリンクを出す */}
                {isOwner && (
                  <Link
                    href="/mypage"
                    className="inline-block rounded-md border border-blue-600/30 bg-blue-600/10 px-4 py-2 text-sm font-medium text-blue-400 transition hover:bg-blue-600/20"
                  >
                    プロフィールを編集
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8 p-8">
            <section>
              <h2 className="mb-4 border-b border-gray-800 pb-2 text-lg font-bold text-gray-200">
                💻 主な使用言語
              </h2>
              {user.languages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.languages.map((lang) => (
                    <span
                      key={lang.id}
                      className="rounded-md border border-[#2ea043]/40 bg-[#2ea043]/10 px-3 py-1 text-sm font-medium text-[#3fb950]"
                    >
                      {lang.language}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">言語データがありません。</p>
              )}
            </section>

            <section>
              <h2 className="mb-4 border-b border-gray-800 pb-2 text-lg font-bold text-gray-200">
                🔗 SNS・リンク
              </h2>
              {user.links.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {user.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#0d1117] px-4 py-2 text-sm font-medium text-blue-400 transition hover:border-gray-500 hover:bg-[#21262d]"
                    >
                      <span className="text-gray-400">{link.platform}</span>
                      <span className="text-gray-600">|</span>
                      <span className="max-w-50 truncate">
                        {link.url.replace(/^https?:\/\//, "")}
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">リンクは登録されていません。</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
