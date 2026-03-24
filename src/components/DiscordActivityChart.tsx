"use client";

import { useState, useEffect, useMemo } from "react";
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

type Period = "1m" | "3m" | "all";

const periodLabels: Record<Period, string> = {
  "1m": "1ヶ月",
  "3m": "3ヶ月",
  all: "全期間",
};

interface WeeklyData {
  weekKey: string;
  messageCount: number;
  presenceCount: number;
}

interface ChartPoint {
  weekKey: string;
  label: string;
  messageCount: number;
  presenceCount: number;
}

// "2026-W11" → "3/10" (Monday of that week, approximate)
function weekKeyToLabel(weekKey: string): string {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekKey;
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const date = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

// "2026-W11" → Date
function weekKeyToDate(weekKey: string): Date {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return new Date(0);
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  return new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: 6,
        padding: "8px 12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      }}
    >
      <p style={{ color: "#8b949e", fontSize: 11, margin: "0 0 6px" }}>{label} 週</p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}
        >
          <span style={{ color: entry.color, fontSize: 11 }}>
            {entry.dataKey === "messageCount" ? "メッセージ数" : "オンライン回数"}
          </span>
          <span style={{ color: "#e6edf3", fontSize: 12, fontWeight: 700 }}>
            {(entry.value ?? 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

const CustomLegend = ({
  payload,
  hiddenLines,
  onToggle,
}: {
  payload?: { value: string; color: string }[];
  hiddenLines: Set<string>;
  onToggle: (key: string) => void;
}) => {
  const items = [
    { key: "messageCount", label: "メッセージ数", color: "#5865f2" },
    { key: "presenceCount", label: "オンライン回数", color: "#3ba55c" },
  ];
  if (payload) void payload; // suppress unused warning
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        justifyContent: "flex-end",
        paddingTop: 8,
      }}
    >
      {items.map((item) => {
        const hidden = hiddenLines.has(item.key);
        return (
          <button
            key={item.key}
            onClick={() => onToggle(item.key)}
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
                background: item.color,
                display: "inline-block",
                borderRadius: 2,
              }}
            />
            <span style={{ color: "#8b949e", fontSize: 11 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default function DiscordActivityChart() {
  const [rawData, setRawData] = useState<WeeklyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("3m");
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch("/api/discord/trend")
      .then((r) => r.json())
      .then((json: WeeklyData[]) => {
        if (Array.isArray(json)) setRawData(json);
      })
      .catch((e) => console.error("Discord trend fetch failed:", e))
      .finally(() => setLoading(false));

    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const data: ChartPoint[] = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();

    if (period === "1m") cutoff.setMonth(now.getMonth() - 1);
    else if (period === "3m") cutoff.setMonth(now.getMonth() - 3);
    else cutoff.setFullYear(2000);

    return rawData
      .filter((d) => weekKeyToDate(d.weekKey) >= cutoff)
      .map((d) => ({
        weekKey: d.weekKey,
        label: weekKeyToLabel(d.weekKey),
        messageCount: d.messageCount,
        presenceCount: d.presenceCount,
      }));
  }, [rawData, period]);

  const toggleLine = (key: string) => {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalMessages = data.reduce((s, d) => s + d.messageCount, 0);
  const activeWeeks = data.filter((d) => d.messageCount > 0).length;
  const tickInterval =
    period === "all"
      ? Math.max(1, Math.floor(data.length / 16))
      : period === "3m"
        ? Math.max(1, Math.floor(data.length / 10))
        : 0;

  return (
    <div
      style={{
        background: "#0d1117",
        borderRadius: 12,
        border: "1px solid rgba(88, 101, 242, 0.25)",
        boxShadow: "0 0 24px rgba(88, 101, 242, 0.08), inset 0 0 40px rgba(88, 101, 242, 0.03)",
        padding: "20px 24px",
        width: "100%",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <p style={{ color: "#e6edf3", fontWeight: 700, fontSize: 18, margin: 0 }}>
            Discord 活動推移
          </p>
          <p style={{ color: "#636e7b", fontSize: 12, margin: "2px 0 0" }}>
            週次のメッセージ数・オンライン回数の推移
          </p>
        </div>

        <div
          style={{
            display: "flex",
            background: "#161b22",
            borderRadius: 8,
            padding: 3,
            border: "1px solid rgba(88,101,242,0.2)",
          }}
        >
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                borderRadius: 6,
                padding: "4px 12px",
                fontSize: 11,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                background: period === p ? "rgba(88,101,242,0.25)" : "transparent",
                color: period === p ? "#a5b4fc" : "#636e7b",
              }}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* サマリー */}
      {!loading && data.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div
            style={{
              background: "rgba(88,101,242,0.08)",
              border: "1px solid rgba(88,101,242,0.2)",
              borderRadius: 8,
              padding: "6px 14px",
            }}
          >
            <p style={{ color: "#636e7b", fontSize: 10, margin: "0 0 2px" }}>期間中メッセージ数</p>
            <p
              style={{
                color: "#a5b4fc",
                fontSize: 16,
                fontWeight: 700,
                margin: 0,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {totalMessages.toLocaleString()}
            </p>
          </div>
          <div
            style={{
              background: "rgba(59,165,92,0.08)",
              border: "1px solid rgba(59,165,92,0.2)",
              borderRadius: 8,
              padding: "6px 14px",
            }}
          >
            <p style={{ color: "#636e7b", fontSize: 10, margin: "0 0 2px" }}>アクティブ週</p>
            <p style={{ color: "#3ba55c", fontSize: 16, fontWeight: 700, margin: 0 }}>
              {activeWeeks} 週
            </p>
          </div>
        </div>
      )}

      {/* グラフ */}
      <div style={{ height: 240, width: "100%" }}>
        {loading ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#636e7b",
                fontSize: 13,
              }}
            >
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
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
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ color: "#484f58", fontSize: 13, textAlign: "center" }}>
              Discord のデータがありません
              <br />
              <span style={{ fontSize: 11 }}>Bot が起動するとデータが蓄積されます</span>
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="1 3" stroke="#21262d" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#8b949e", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={tickInterval}
                angle={period === "all" ? -45 : 0}
                textAnchor={period === "all" ? "end" : "middle"}
                dy={period === "all" ? 0 : 6}
              />
              <YAxis
                tick={{ fill: "#8b949e", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={32}
                allowDecimals={false}
                tickCount={5}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: "rgba(88,101,242,0.4)", strokeWidth: 1, strokeDasharray: "4 3" }}
              />
              <Legend
                content={(props) => (
                  <CustomLegend
                    payload={props.payload as { value: string; color: string }[]}
                    hiddenLines={hiddenLines}
                    onToggle={toggleLine}
                  />
                )}
              />
              <Line
                type="monotone"
                dataKey="messageCount"
                name="メッセージ数"
                stroke="#5865f2"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#5865f2", stroke: "#5865f2", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#5865f2", stroke: "#0d1117", strokeWidth: 2 }}
                hide={hiddenLines.has("messageCount")}
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="presenceCount"
                name="オンライン回数"
                stroke="#3ba55c"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 2.5, fill: "#3ba55c", stroke: "#3ba55c", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#3ba55c", stroke: "#0d1117", strokeWidth: 2 }}
                hide={hiddenLines.has("presenceCount")}
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
