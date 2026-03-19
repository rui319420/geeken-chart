"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const COLLAPSED_W = 56;
const EXPANDED_W = 230;

interface NavItemProps {
  href: string;
  label: string;
  children: React.ReactNode;
}

function NavItem({ href, label, children }: NavItemProps) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      title={label}
      className={`nav-item flex h-10 w-full items-center gap-3 rounded-md px-3 transition-colors duration-150 ${
        active
          ? "bg-white/10 text-white"
          : "text-[#8b949e] hover:bg-white/[0.06] hover:text-[#c9d1d9]"
      }`}
    >
      <span className="shrink-0">{children}</span>
      <span className="nav-label text-[13px] font-medium">{label}</span>
    </Link>
  );
}

function Divider() {
  return (
    <div className="mx-3 my-1" style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="nav-label mt-3 mb-0.5 px-3">
      <span className="text-[10px] font-semibold tracking-widest text-[#484f58] uppercase">
        {label}
      </span>
    </div>
  );
}

export default function RadioNav() {
  return (
    <>
      <style>{`
        .supabase-nav {
          width: ${COLLAPSED_W}px;
          transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }
        .supabase-nav:hover { width: ${EXPANDED_W}px; }
        .nav-label {
          opacity: 0;
          width: 0;
          overflow: hidden;
          white-space: nowrap;
          transition: opacity 120ms ease 0ms, width 0ms ease 200ms;
          pointer-events: none;
        }
        .supabase-nav:hover .nav-label {
          opacity: 1;
          width: auto;
          pointer-events: auto;
          transition: opacity 180ms ease 60ms, width 0ms ease 0ms;
        }
        .nav-item svg { flex-shrink: 0; }
      `}</style>

      <nav
        className="supabase-nav fixed top-0 bottom-0 left-0 z-50 hidden flex-col lg:flex"
        style={{ background: "#161b22", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* ロゴ */}
        <div
          className="flex h-14 shrink-0 items-center gap-3 px-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#2ea043] text-xs font-bold text-white">
            技
          </div>
          <span className="nav-label text-[13px] font-bold tracking-widest text-[#f0f6fc]">
            技研チャート
          </span>
        </div>

        {/* メインメニュー */}
        <div className="flex flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-2 py-3">
          <NavItem href="/" label="ダッシュボード">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 13h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1zm-1 7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v4zm10 0a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v7zm1-10h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1z" />
            </svg>
          </NavItem>

          <Divider />

          <NavItem href="/ranking" label="ランキング">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </NavItem>

          <NavItem href="/frameworks" label="フレームワーク">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </NavItem>

          <Divider />

          <SectionLabel label="技研" />

          <NavItem href="/works" label="制作物">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </NavItem>

          <NavItem href="/sns" label="SNS">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </NavItem>

          <Divider />

          <SectionLabel label="個人" />

          <NavItem href="/members" label="メンバー">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 8a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm9 11v-1a7 7 0 0 0-7-7h-4a7 7 0 0 0-7 7v1h2v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1z" />
            </svg>
          </NavItem>
        </div>

        {/* ボトム固定 — 設定 */}
        <div
          className="shrink-0 px-2 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <NavItem href="/settings" label="設定">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 16c2.206 0 4-1.794 4-4s-1.794-4-4-4-4 1.794-4 4 1.794 4 4 4zm0-6c1.084 0 2 .916 2 2s-.916 2-2 2-2-.916-2-2 .916-2 2-2z" />
              <path d="m2.845 16.136 1 1.73c.531.917 1.809 1.261 2.73.73l.529-.306A8.1 8.1 0 0 0 9 19.402V20c0 1.103.897 2 2 2h2c1.103 0 2-.897 2-2v-.598a8.132 8.132 0 0 0 1.896-1.111l.529.306c.923.53 2.198.188 2.731-.731l.999-1.729a2.001 2.001 0 0 0-.731-2.732l-.505-.292a7.718 7.718 0 0 0 0-2.224l.505-.292a2.002 2.002 0 0 0 .731-2.732l-.999-1.729c-.531-.92-1.808-1.265-2.731-.732l-.529.306A8.1 8.1 0 0 0 15 4.598V4c0-1.103-.897-2-2-2h-2c-1.103 0-2 .897-2 2v.598a8.132 8.132 0 0 0-1.896 1.111l-.529-.306c-.924-.531-2.2-.187-2.731.732l-.999 1.729a2.001 2.001 0 0 0 .731 2.732l.505.292a7.683 7.683 0 0 0 0 2.223l-.505.292a2.003 2.003 0 0 0-.731 2.733z" />
            </svg>
          </NavItem>
        </div>
      </nav>
    </>
  );
}
