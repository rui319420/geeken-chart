"use client";

import { useEffect, useMemo, useState } from "react";
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
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Java: "#b07219",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Vue: "#42b883",
};

interface DataPoint {
  month: string;
  [lang: string]: string | number;
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
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [includePrivate, setIncludePrivate] = useState(false);

  useEffect(() => {
    // 設定取得（ログイン中のみ）
    fetch("/api/user/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setIncludePrivate(s.includePrivate ?? false))
      .catch(() => {});

    // 言語トレンドAPI
    fetch("/api/languages/trend")
      .then((r) => r.json())
      .then((json: DataPoint[]) => setData(json))
      .catch((e) => console.error("Trend fetch failed:", e))
      .finally(() => setLoading(false));
  }, []);

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
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#e6edf3]">人気言語ランキング</h3>
          <p className="mt-0.5 text-xs text-[#8b949e]">
            {includePrivate
              ? "公開・プライベート含む使用率の推移（直近1年・GitHub Linguist）"
              : "公開リポジトリの使用率の推移（直近1年・GitHub Linguist）"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {includePrivate && (
            <span className="flex items-center gap-1 rounded-full border border-[#388bfd]/30 bg-[#388bfd]/10 px-2.5 py-1 text-[11px] font-medium text-[#388bfd]">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              プライベート含む
            </span>
          )}
          <span
            className="cursor-help text-[#636e7b]"
            title="各リポジトリの作成日を使い、その月末時点で存在していたリポジトリをGitHub Linguistで集計しています。後から参加したユーザーでも即座に過去データが生成されます。"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
        </div>
      </div>

      {/* グラフ */}
      <div style={{ height: 320, width: "100%" }}>
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-2 text-[#636e7b]">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              集計中...
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sm text-[#636e7b]">
              履歴データがありません
              <br />
              <span className="text-xs">
                「今すぐ更新」を実行するとリポジトリの作成日を元に
                <br />
                過去12ヶ月分のデータが自動生成されます
              </span>
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
