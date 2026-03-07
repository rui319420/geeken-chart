"use client";

import { useEffect, useRef, useState } from "react";

interface StatsData {
  members: number;
  commits: number;
  languages: number;
  repositories: number;
}

interface StatItem {
  value: number;
  unit: string;
  label: string;
  color: string;
}

function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === 0) return;
    const from = prevTarget.current;
    prevTarget.current = target;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(from + eased * (target - from)));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return count;
}

function StatCard({ item, delay, loading }: { item: StatItem; delay: number; loading: boolean }) {
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

      {/* 数値 */}
      <div className="flex items-end gap-1">
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded bg-white/5" />
        ) : (
          <>
            <span
              className="font-mono text-3xl font-bold tracking-tight text-[#F2F3F5]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {count.toLocaleString()}
            </span>
            <span className="mb-0.5 text-sm font-medium" style={{ color: item.color }}>
              {item.unit}
            </span>
          </>
        )}
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

export default function StatsCards() {
  const [data, setData] = useState<StatsData>({
    members: 0,
    commits: 0,
    languages: 0,
    repositories: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((json: StatsData) => setData(json))
      .catch((e) => console.error("Stats fetch failed:", e))
      .finally(() => setLoading(false));
  }, []);

  const stats: StatItem[] = [
    { value: data.members, unit: "人", label: "メンバー", color: "#58a6ff" },
    { value: data.commits, unit: "", label: "総コミット数", color: "#39d353" },
    { value: data.languages, unit: "種", label: "使用言語", color: "#f78166" },
    { value: data.repositories, unit: "個", label: "リポジトリ", color: "#e3b341" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {stats.map((item, i) => (
        <StatCard key={item.label} item={item} delay={i * 100} loading={loading} />
      ))}
    </div>
  );
}
