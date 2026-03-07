"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const GITHUB_LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  C: "#9b9b9b",
  "C++": "#f34b7d",
  "C#": "#178600",
  Java: "#b07219",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
};

interface DataPoint {
  month: string;
  [lang: string]: string | number;
}

// モックデータ生成（1年固定）
function generateMockData(): DataPoint[] {
  const months = 12;
  const languages = ["TypeScript", "Python", "JavaScript", "C", "Rust"];

  // 各言語の初期値とトレンド
  const init: Record<string, number> = {
    TypeScript: 38,
    Python: 28,
    JavaScript: 20,
    C: 18,
    Rust: 8,
  };
  const trend: Record<string, number> = {
    TypeScript: 0.8,
    Python: 0.3,
    JavaScript: -0.4,
    C: -0.2,
    Rust: 0.5,
  };

  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now);
    d.setMonth(now.getMonth() - (months - 1 - i));
    const point: DataPoint = {
      month: `${d.getFullYear()}/${d.getMonth() + 1}`,
    };
    languages.forEach((lang) => {
      const noise = (Math.random() - 0.5) * 4;
      point[lang] = Math.max(1, Math.round(init[lang] + trend[lang] * i + noise));
    });
    return point;
  });
}

// カスタムツールチップ
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const sorted = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: 8,
        padding: "10px 14px",
        minWidth: 140,
      }}
    >
      <p style={{ color: "#8b949e", fontSize: 11, margin: "0 0 8px" }}>{label}</p>
      {sorted.map((entry) => (
        <div
          key={entry.name}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 3,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: entry.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#e6edf3", fontSize: 11 }}>{entry.name}</span>
          </div>
          <span style={{ color: entry.color, fontWeight: 700, fontSize: 12 }}>{entry.value}%</span>
        </div>
      ))}
    </div>
  );
};

// カスタム凡例
const CustomLegend = ({
  payload,
  hiddenLines,
  onToggle,
}: {
  payload?: { value: string; color: string }[];
  hiddenLines: Set<string>;
  onToggle: (lang: string) => void;
}) => {
  if (!payload) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 14px",
        justifyContent: "flex-end",
        paddingTop: 8,
      }}
    >
      {payload.map((entry) => {
        const hidden = hiddenLines.has(entry.value);
        return (
          <button
            key={entry.value}
            onClick={() => onToggle(entry.value)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "none",
              border: "none",
              cursor: "pointer",
              opacity: hidden ? 0.35 : 1,
              transition: "opacity 0.2s",
              padding: 0,
            }}
          >
            <span
              style={{
                width: 20,
                height: 2.5,
                background: entry.color,
                display: "inline-block",
                borderRadius: 2,
              }}
            />
            <span style={{ color: "#8b949e", fontSize: 11 }}>{entry.value}</span>
          </button>
        );
      })}
    </div>
  );
};

export default function LanguageTrendChart() {
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  const data = useMemo(() => generateMockData(), []);

  const languages = useMemo(() => {
    const keys = new Set<string>();
    data.forEach((d) => Object.keys(d).forEach((k) => k !== "month" && keys.add(k)));
    return Array.from(keys);
  }, [data]);

  const toggleLine = (lang: string) => {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      next.has(lang) ? next.delete(lang) : next.add(lang);
      return next;
    });
  };

  return (
    <div className="w-full rounded-xl border border-[#21262d] bg-[#0d1117] p-5 md:p-6">
      {/* ヘッダー */}
      <div className="mb-5">
        <h3 className="text-base font-bold text-[#e6edf3]">人気言語ランキング</h3>
        <p className="mt-0.5 text-xs text-[#8b949e]">言語ごとの使用率の推移（直近1年）</p>
      </div>

      {/* グラフ */}
      <div style={{ height: 320, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 24, left: -4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="1 3" stroke="#21262d" vertical={false} />

            <XAxis
              dataKey="month"
              tick={{ fill: "#8b949e", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              dy={6}
            />

            <YAxis
              tick={{ fill: "#8b949e", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={30}
              unit="%"
              domain={[0, "auto"]}
              allowDecimals={false}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#30363d", strokeWidth: 1 }} />

            <Legend
              content={(props) => (
                <CustomLegend
                  payload={props.payload as { value: string; color: string }[]}
                  hiddenLines={hiddenLines}
                  onToggle={toggleLine}
                />
              )}
            />

            {languages.map((lang) => (
              <Line
                key={lang}
                type="linear"
                dataKey={lang}
                stroke={GITHUB_LANGUAGE_COLORS[lang] ?? "#8b949e"}
                strokeWidth={2.5}
                dot={{ r: 3.5, strokeWidth: 0, fill: GITHUB_LANGUAGE_COLORS[lang] ?? "#8b949e" }}
                activeDot={{ r: 6, stroke: "#0d1117", strokeWidth: 2 }}
                hide={hiddenLines.has(lang)}
                isAnimationActive={true}
                animationDuration={500}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
