"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

export default function Header() {
  const { data: session, status } = useSession();

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#0d1117]/90 backdrop-blur-sm"
      style={{ paddingLeft: "56px" }}
    >
      <div className="mx-auto flex h-10 max-w-7xl items-center justify-end px-4 md:px-6">
        {status === "loading" ? (
          <div className="h-6 w-6 animate-pulse rounded-full bg-white/10" />
        ) : session ? (
          <div className="flex items-center gap-3">
            <Link
              href={session.user?.githubName ? `/user/${session.user.githubName}` : "#"}
              className="flex items-center gap-2 transition-opacity hover:opacity-70"
              title="自分のプロフィールを見る"
            >
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? ""}
                  width={24}
                  height={24}
                  className="rounded-full ring-1 ring-white/10"
                />
              )}
              <span className="hidden text-xs text-[#636e7b] sm:block">
                {session.user?.nickname || session.user?.name}
              </span>
            </Link>

            <button
              onClick={() => signIn("github")}
              className="flex items-center gap-2 rounded bg-[#2ea043] px-3 py-1 text-xs font-medium text-white shadow-[0_0_12px_rgba(46,160,67,0.3)] transition-all duration-200 hover:bg-[#3fb950]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53-1.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHubでログイン
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn("github")}
            className="flex items-center gap-2 rounded bg-[#2ea043] px-3 py-1 text-xs font-medium text-white shadow-[0_0_12px_rgba(46,160,67,0.3)] transition-all duration-200 hover:bg-[#3fb950]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53-1.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHubでログイン
          </button>
        )}
      </div>
    </header>
  );
}
