import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Header from "@/components/Header";
import RadioNav from "@/components/RadioNav";

type Member = {
  id: string;
  githubName: string;
  nickname: string | null;
  avatarUrl: string | null;
  discordId: string | null;
  totalCommits: number | null;
  githubScore: number | null;
  joinRanking: boolean;
};

function MemberCard({ member }: { member: Member }) {
  const displayName = member.nickname ?? member.githubName;
  const initial = displayName.charAt(0).toUpperCase();
  const hasDiscord = !!member.discordId;

  return (
    <a
      href={`https://github.com/${member.githubName}`}
      target="_blank"
      rel="noopener noreferrer"
      className="member-card group flex items-center gap-3 rounded-md px-3 py-2 transition-colors duration-150"
      style={{ borderRadius: "6px" }}
    >
      {/* Avatar */}
      <div className="shrink-0">
        {member.avatarUrl ? (
          <Image
            src={member.avatarUrl}
            alt={displayName}
            width={36}
            height={36}
            className="h-9 w-9 rounded-full"
          />
        ) : (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
            style={{ background: "#36393f", color: "#dcddde" }}
          >
            {initial}
          </div>
        )}
      </div>

      {/* テキスト */}
      <div className="min-w-0 flex-1">
        <p
          className="member-name truncate text-[14px] leading-[18px] font-medium"
          style={{ color: "#c9d1d9" }}
        >
          {displayName}
        </p>
        <p className="truncate text-[11px] leading-[14px]" style={{ color: "#636e7b" }}>
          @{member.githubName}
          {hasDiscord && (
            <span className="ml-1.5" style={{ color: "#818cf8" }}>
              · Discord連携済み
            </span>
          )}
        </p>
      </div>

      {/* スコア */}
      {member.joinRanking && member.githubScore !== null && (
        <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: "#3fb950" }}>
          {member.githubScore.toLocaleString()} pts
        </span>
      )}
    </a>
  );
}

export default async function MembersPage() {
  const session = await auth();
  if (!session) redirect("/");

  const members = await prisma.user.findMany({
    select: {
      id: true,
      githubName: true,
      nickname: true,
      avatarUrl: true,
      discordId: true,
      totalCommits: true,
      githubScore: true,
      joinRanking: true,
    },
    orderBy: [{ githubScore: "desc" }, { createdAt: "asc" }],
  });

  const discordLinked = members.filter((m) => m.discordId);
  const githubOnly = members.filter((m) => !m.discordId);

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <RadioNav />

      <div style={{ paddingLeft: "56px" }}>
        <Header />

        <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
          {/* ページヘッダー */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#e6edf3]">メンバー</h1>
            <p className="mt-1 text-sm text-[#636e7b]">
              技研チャートに登録しているメンバー一覧です
            </p>
          </div>

          <div
            className="overflow-hidden rounded-xl"
            style={{ background: "#161b22", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <style>{`
              .member-card:hover { background: rgba(255,255,255,0.04); }
              .member-card:hover .member-name { color: #e6edf3 !important; }
            `}</style>

            {/* Discord 連携済み */}
            {discordLinked.length > 0 && (
              <section>
                <div
                  className="px-4 pt-5 pb-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <span
                    className="text-[11px] font-bold tracking-widest uppercase"
                    style={{ color: "#636e7b" }}
                  >
                    Discord連携済み — {discordLinked.length}
                  </span>
                </div>
                <div className="p-2">
                  {discordLinked.map((m) => (
                    <MemberCard key={m.id} member={m} />
                  ))}
                </div>
              </section>
            )}

            {/* GitHub のみ */}
            {githubOnly.length > 0 && (
              <section>
                <div
                  className="px-4 pt-5 pb-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <span
                    className="text-[11px] font-bold tracking-widest uppercase"
                    style={{ color: "#636e7b" }}
                  >
                    メンバー — {githubOnly.length}
                  </span>
                </div>
                <div className="p-2">
                  {githubOnly.map((m) => (
                    <MemberCard key={m.id} member={m} />
                  ))}
                </div>
              </section>
            )}

            {members.length === 0 && (
              <p className="py-12 text-center text-sm" style={{ color: "#484f58" }}>
                メンバーがいません
              </p>
            )}
          </div>

          <p className="mt-4 text-center text-xs" style={{ color: "#484f58" }}>
            GitHubでログインするとメンバーとして表示されます
          </p>
        </main>
      </div>
    </div>
  );
}
