import { prisma } from "@/lib/prisma";
import Image from "next/image";
import SidebarShell from "@/components/SidebarShell";

type Member = {
  id: string;
  githubName: string;
  nickname: string | null;
  avatarUrl: string | null;
  discordId: string | null;
};

function MemberRow({ member }: { member: Member }) {
  const displayName = member.nickname ?? member.githubName;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <a
      href={`https://github.com/${member.githubName}`}
      className="member-row flex h-10.5 cursor-pointer items-center gap-3 rounded-sm px-2"
      title={`@${member.githubName} — GitHubを開く`}
    >
      {/* Avatar */}
      <div className="shrink-0">
        {member.avatarUrl ? (
          <Image
            src={member.avatarUrl}
            alt={displayName}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
            style={{ background: "#36393f", color: "#dcddde" }}
          >
            {initial}
          </div>
        )}
      </div>

      {/* テキスト */}
      <div className="min-w-0 flex-1">
        <p
          className="member-name truncate text-[15px] leading-4.5 font-medium"
          style={{ color: "#949ba4" }}
        >
          {displayName}
        </p>
        {member.nickname && (
          <p className="truncate text-[11px] leading-3.5" style={{ color: "#616269" }}>
            @{member.githubName}
          </p>
        )}
      </div>
    </a>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-2 pt-4 pb-1">
      <span
        className="text-[11px] font-bold uppercase"
        style={{ color: "#949ba4", letterSpacing: "0.04em", lineHeight: "16px" }}
      >
        {label} — {count}
      </span>
    </div>
  );
}

export default async function Sidebar() {
  const members = await prisma.user.findMany({
    select: {
      id: true,
      githubName: true,
      nickname: true,
      avatarUrl: true,
      discordId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const discordLinked = members.filter((m) => m.discordId);
  const githubOnly = members.filter((m) => !m.discordId);

  return (
    <SidebarShell memberCount={members.length}>
      <>
        <style>{`
          .member-row:hover { background: rgba(79, 84, 92, 0.16); }
          .member-row:hover .member-name { color: #dbdee1 !important; }
          .member-row:active { background: rgba(79, 84, 92, 0.24); }
          .sidebar-scroll {
            scrollbar-width: thin;
            scrollbar-color: #1a1b1e transparent;
          }
          .sidebar-scroll::-webkit-scrollbar { width: 4px; }
          .sidebar-scroll::-webkit-scrollbar-thumb {
            background: #1a1b1e;
            border-radius: 2px;
          }
        `}</style>

        <div
          className="sidebar-scroll overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 10rem)" }}
        >
          <div className="px-2 pb-3">
            {discordLinked.length > 0 && (
              <section>
                <SectionHeader label="Discord連携済み" count={discordLinked.length} />
                {discordLinked.map((m) => (
                  <MemberRow key={m.id} member={m} />
                ))}
              </section>
            )}

            {githubOnly.length > 0 && (
              <section>
                <SectionHeader label="メンバー" count={githubOnly.length} />
                {githubOnly.map((m) => (
                  <MemberRow key={m.id} member={m} />
                ))}
              </section>
            )}

            {members.length === 0 && (
              <p className="py-8 text-center text-xs" style={{ color: "#4e5058" }}>
                メンバーがいません
              </p>
            )}
          </div>
        </div>
      </>
    </SidebarShell>
  );
}
