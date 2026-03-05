"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// GitHubの公式カラー（Linguist）に準拠した主要言語のカラーマップ
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
  Vue: "#41b883",
  Shell: "#89e051",
  Lua: "#000080",
  Perl: "#0298c3",
  Haskell: "#5e5086",
  Elixir: "#6e4a7e",
};

interface ChartData {
  period: string;
  [language: string]: string | number;
}

const mockData: ChartData[] = [
  { period: "1月", TypeScript: 40, C: 20, Python: 25, Go: 10, Rust: 5 },
  { period: "2月", TypeScript: 45, C: 15, Python: 20, Go: 15, Rust: 5 },
  { period: "3月", TypeScript: 50, C: 10, Python: 15, Go: 15, Rust: 10 },
  { period: "4月", TypeScript: 55, C: 10, Python: 10, Go: 10, Rust: 15 },
];

const getRandomColor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = Math.floor(Math.abs(((Math.sin(hash) * 10000) % 1) * 16777215)).toString(16);
  return "#" + "000000".substring(0, 6 - color.length) + color;
};

export default function LanguageTrendChart({ data = mockData }: { data?: ChartData[] }) {
  const activeLanguages = useMemo(() => {
    if (!data || data.length === 0) return [];

    const keys = new Set<string>();
    data.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (key !== "period") keys.add(key);
      });
    });
    return Array.from(keys);
  }, [data]);

  return (
    // 【サイズ・背景の調整】
    // 高さをPC画面向けに500pxに拡大 (md:h-[500px])
    // GitHubのダークテーマ背景(#0d1117)からDiscordのダークトーンへのグラデーション
    // GitHubグリーン(#2ea043)の枠線と、Discordブルー(#5865F2)のうっすらとしたシャドウを融合
    <div className="h-[400px] w-full rounded-xl border border-[#2ea043]/40 bg-gradient-to-br from-[#0d1117] to-[#181a26] p-4 shadow-[0_0_20px_rgba(88,101,242,0.15)] md:h-[500px] md:p-6">
      <h2 className="mb-6 text-center text-xl font-bold tracking-wider text-[#F2F3F5]">
        言語別使用率
      </h2>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 30, left: -10, bottom: 10 }}>
          {/* グリッド線：GitHubのグリーンを薄く適用 */}
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(46, 160, 67, 0.15)" />

          {/* X軸・Y軸：文字色はDiscordのMuted text色、軸線はDiscordブルーを薄く適用 */}
          <XAxis
            dataKey="period"
            tick={{ fill: "#949BA4", fontSize: 13 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(88, 101, 242, 0.4)" }}
            dy={10}
          />
          <YAxis
            unit="%"
            tick={{ fill: "#949BA4", fontSize: 13 }}
            tickLine={false}
            axisLine={false}
          />

          {/* ツールチップ：Discordのダークパネル風にカスタマイズ（枠線はDiscordブルー） */}
          <Tooltip
            formatter={(value: number | undefined) => [`${value}%`, undefined]}
            contentStyle={{
              backgroundColor: "#1E1F22",
              borderColor: "#5865F2",
              color: "#F2F3F5",
              borderRadius: "8px",
              boxShadow: "0 8px 16px rgba(0,0,0,0.4)",
            }}
            itemStyle={{ color: "#F2F3F5" }}
            labelStyle={{ color: "#949BA4", marginBottom: "4px" }}
          />

          {/* 凡例（Legend）：文字色をライトグレーにしてダークテーマに合わせる */}
          <Legend
            wrapperStyle={{ paddingTop: "20px" }}
            formatter={(value) => (
              <span style={{ color: "#DBDEE1", fontWeight: 500 }}>{value}</span>
            )}
          />

          {activeLanguages.map((lang) => {
            const strokeColor = GITHUB_LANGUAGE_COLORS[lang] || getRandomColor(lang);

            return (
              <Line
                key={lang}
                type="monotone" // 滑らかな曲線に（linearから変更）
                dataKey={lang}
                name={lang}
                stroke={strokeColor}
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: "#0d1117" }} // ドットの中心を背景色で抜く
                activeDot={{ r: 7, stroke: "#F2F3F5", strokeWidth: 2 }} // ホバー時のドットを強調
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
