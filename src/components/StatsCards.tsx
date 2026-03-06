"use client";

import { useEffect, useRef, useState } from "react";

interface StatItem {
  value: number;
  unit: string;
  label: string;
  color: string;
  icon: React.ReactNode;
}

// カウントアップアニメーション
function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return count;
}

function StatCard({ item, delay }: { item: StatItem; delay: number }) {
  const [visible, setVisible] = useState(false);
  const count = useCountUp(visible ? item.value : 0, 1400);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-white/5 bg-[#0d1117] p-6 transition-all duration-300 hover:border-white/10 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      {/* 背景グロー */}
      <div
        className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20"
        style={{ background: item.color }}
      />

      {/* アイコン */}
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ background: `${item.color}18`, color: item.color }}
      >
        {item.icon}
      </div>

      {/* 数値 */}
      <div className="flex items-end gap-1">
        <span
          className="font-mono text-3xl font-bold tracking-tight text-[#F2F3F5]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {count.toLocaleString()}
        </span>
        <span className="mb-0.5 text-sm font-medium" style={{ color: item.color }}>
          {item.unit}
        </span>
      </div>

      {/* ラベル */}
      <p className="mt-1 text-sm text-[#636e7b]">{item.label}</p>

      {/* ボトムライン */}
      <div
        className="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-500 group-hover:w-full"
        style={{ background: `linear-gradient(to right, ${item.color}, transparent)` }}
      />
    </div>
  );
}

// モックデータ（後でAPIから取得）
const MOCK_STATS = {
  members: 24,
  commits: 12847,
  languages: 11,
  repositories: 138,
};

export default function StatsCards() {
  const stats: StatItem[] = [
    {
      value: MOCK_STATS.members,
      unit: "人",
      label: "メンバー",
      color: "#58a6ff",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      value: MOCK_STATS.commits,
      unit: "",
      label: "総コミット数",
      color: "#39d353",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="4" />
          <line x1="1.05" y1="12" x2="7" y2="12" />
          <line x1="17.01" y1="12" x2="22.96" y2="12" />
        </svg>
      ),
    },
    {
      value: MOCK_STATS.languages,
      unit: "種",
      label: "使用言語",
      color: "#f78166",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
    },
    {
      value: MOCK_STATS.repositories,
      unit: "個",
      label: "リポジトリ",
      color: "#e3b341",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 3h18v18H3zM3 9h18M9 21V9" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {stats.map((item, i) => (
        <StatCard key={item.label} item={item} delay={i * 100} />
      ))}
    </div>
  );
}
