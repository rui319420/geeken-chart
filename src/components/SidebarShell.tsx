"use client";

import { useSidebar } from "@/contexts/SidebarContext";
import { useRef, useState } from "react";

interface Props {
  memberCount: number;
  children: React.ReactNode;
}

export default function SidebarShell({ memberCount, children }: Props) {
  const { isOpen, toggle } = useSidebar();
  const [isMorphing, setIsMorphing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = () => {
    if (timerRef.current) return;
    setIsMorphing(true);
    timerRef.current = setTimeout(() => {
      toggle();
      setTimeout(() => {
        setIsMorphing(false);
        timerRef.current = null;
      }, 320);
    }, 240);
  };

  return (
    <>
      <style>{`
        @keyframes icon-swap {
          0%   { transform: scale(1);   opacity: 1; }
          40%  { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(0.4); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        .icon-morphing { animation: icon-swap 240ms ease forwards; }
        .member-row:hover { background: rgba(79,84,92,0.16); }
        .member-row:hover .member-name { color: #dbdee1 !important; }
        .sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: #333 transparent;
        }
        .sidebar-scroll::-webkit-scrollbar { width: 4px; }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 2px;
        }
        .close-btn:hover { background: rgba(255,255,255,0.08); }
      `}</style>

      {/* バックドロップ（メンバーリスト外クリックで閉じる） */}
      {isOpen && <div className="fixed inset-0 z-40 hidden lg:block" onClick={toggle} />}

      {/* メンバーリストパネル — ナビ(56px)の右から出現 */}
      <div
        className="fixed top-0 bottom-0 z-50 hidden flex-col lg:flex"
        style={{
          left: "56px",
          width: "240px",
          background: "#2b2d31",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 280ms cubic-bezier(0.4,0,0.2,1)",
          boxShadow: isOpen ? "4px 0 20px rgba(0,0,0,0.4)" : "none",
        }}
      >
        {/* パネルヘッダー */}
        <div
          className="flex h-14 shrink-0 items-center justify-between px-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <span className="text-[13px] font-semibold" style={{ color: "#b5bac1" }}>
            メンバーリスト
          </span>

          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
              style={{ background: "rgba(255,255,255,0.06)", color: "#636e7b" }}
            >
              {memberCount}
            </span>

            {/* × → 人アイコン モーフボタン */}
            <button
              onClick={handleClose}
              className="close-btn flex h-6 w-6 items-center justify-center rounded transition-colors duration-150"
              style={{ color: "#636e7b" }}
              title="メンバーリストを閉じる"
            >
              <span
                key={isMorphing ? "people" : "close"}
                className={isMorphing ? "icon-morphing" : ""}
              >
                {isMorphing ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 8a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm9 11v-1a7 7 0 0 0-7-7h-4a7 7 0 0 0-7 7v1h2v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1z" />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* メンバーリスト */}
        <div className="sidebar-scroll flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
