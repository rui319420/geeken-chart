"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── 型 ───────────────────────────────────────────────────────────
type Mode = "score" | "detail";

interface TrendPoint {
  key: string;
  label: string;
  messages: number;
  reactions: number;
  score: number;
}

interface TooltipPayload {
  name?: string;
  value?: number;
  color?: string;
}

interface TrendApiResponse {
  points: TrendPoint[];
  hottestChannel: string | null;
}

// ─── 定数 ─────────────────────────────────────────────────────────
const WEEK_PERIOD = "1w";
const WEEK_TICK_INTERVAL = 23; // 168点 → 24h ごと (7 ラベル)
const WEEK_DOT_R = 0; // 点数が多いので非表示

// ─── カスタムツールチップ ────────────────────────────────────────
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly TooltipPayload[];
  label?: string | number;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid rgba(88,101,242,0.35)",
        borderRadius: 8,
        padding: "10px 14px",
        minWidth: 155,
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
    >
      <p style={{ color: "#8b949e", fontSize: 11, margin: "0 0 8px" }}>{String(label)}</p>
      {payload.map((e) => (
        <div
          key={e.name}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            marginBottom: 3,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "#c9d1d9",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: e.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {e.name}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: e.color }}>
            {e.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── メインコンポーネント ─────────────────────────────────────────
export default function DiscordTrendChart() {
  const [mode, setMode] = useState<Mode>("score");
  const [data, setData] = useState<TrendPoint[]>([]);
  const [hottestChannel, setHottestChannel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cache = useRef<TrendApiResponse | null>(null);

  const fetchData = useCallback(async () => {
    if (cache.current) {
      setData(cache.current.points);
      setHottestChannel(cache.current.hottestChannel);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/discord/trend?period=${WEEK_PERIOD}`);
      const json: unknown = await res.json();
      const payload: TrendApiResponse =
        json && typeof json === "object" && Array.isArray((json as TrendApiResponse).points)
          ? (json as TrendApiResponse)
          : { points: [], hottestChannel: null };
      cache.current = payload;
      setData(payload.points);
      setHottestChannel(payload.hottestChannel);
    } catch (e) {
      console.error("Discord trend fetch failed:", e);
      setData([]);
      setHottestChannel(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isEmpty = !loading && data.length > 0 && data.every((d) => d.score === 0);
  const dotR = WEEK_DOT_R;
  const dotProp = dotR > 0 ? { r: dotR, strokeWidth: 0 } : false;
  const activeDot = { r: 5, stroke: "#0d1117", strokeWidth: 2 };
  const hottestChannelLabel = hottestChannel ? `#${hottestChannel}` : "データ集計中";

  // ボタンスタイルヘルパー
  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 12px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s",
    background: active ? "rgba(88,101,242,0.25)" : "transparent",
    color: active ? "#a5b4fc" : "#636e7b",
  });

  const tabGroupStyle: React.CSSProperties = {
    display: "flex",
    background: "#161b22",
    border: "1px solid rgba(88,101,242,0.2)",
    borderRadius: 8,
    padding: 3,
    gap: 2,
  };

  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid rgba(88,101,242,0.25)",
        borderRadius: 12,
        padding: "20px 24px",
        width: "100%",
        boxShadow: "0 0 24px rgba(88,101,242,0.08)",
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <h3 style={{ color: "#e6edf3", fontWeight: 700, fontSize: 18, margin: 0 }}>
            Discord 盛り上がり推移
          </h3>
          <p style={{ color: "#636e7b", fontSize: 12, margin: "4px 0 0" }}>
            メッセージ・リアクションの推移
          </p>
          <div
            style={{
              marginTop: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid rgba(88,101,242,0.3)",
              background: "rgba(88,101,242,0.12)",
            }}
          >
            <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 700 }}>
              活発なチャンネル: {hottestChannelLabel}
            </span>
          </div>
        </div>

        {/* コントロール */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* モードタブ */}
          <div style={tabGroupStyle}>
            {(["score", "detail"] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} style={btnStyle(mode === m)}>
                {m === "score" ? "スコア" : "内訳"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* スコア凡例 */}
      {mode === "score" && (
        <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { label: "メッセージ", weight: "+2.0", color: "#5865f2" },
            { label: "リアクション", weight: "+1.0", color: "#eb459e" },
          ].map((it) => (
            <span
              key={it.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: "#8b949e",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: it.color,
                  display: "inline-block",
                }}
              />
              {it.label}
              <span style={{ color: it.color, fontWeight: 700 }}>{it.weight}</span>
            </span>
          ))}
        </div>
      )}

      {/* グラフ */}
      <div style={{ height: 300, width: "100%" }}>
        {loading ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#636e7b",
              fontSize: 13,
              gap: 8,
            }}
          >
            <svg
              className="animate-spin"
              style={{ width: 16, height: 16 }}
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                style={{ opacity: 0.25 }}
              />
              <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ opacity: 0.75 }} />
            </svg>
            集計中...
          </div>
        ) : isEmpty ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#484f58",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            データがありません
            <br />
            <span style={{ fontSize: 11, marginTop: 4, display: "block" }}>
              Bot が記録を開始すると表示されます
            </span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="1 4" stroke="#1c2128" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#636e7b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                dy={4}
                interval={WEEK_TICK_INTERVAL}
              />
              <YAxis
                tick={{ fill: "#636e7b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={32}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#30363d", strokeWidth: 1 }} />

              {mode === "score" ? (
                <Line
                  type="linear"
                  dataKey="score"
                  name="盛り上がりスコア"
                  stroke="#a5b4fc"
                  strokeWidth={2}
                  dot={dotProp}
                  activeDot={{ ...activeDot, fill: "#a5b4fc" }}
                  isAnimationActive
                  animationDuration={500}
                />
              ) : (
                <>
                  <Legend wrapperStyle={{ fontSize: 11, color: "#8b949e", paddingTop: 8 }} />
                  <Line
                    type="linear"
                    dataKey="messages"
                    name="メッセージ"
                    stroke="#5865f2"
                    strokeWidth={2}
                    dot={dotProp}
                    activeDot={{ ...activeDot, fill: "#5865f2" }}
                    isAnimationActive
                    animationDuration={500}
                  />
                  <Line
                    type="linear"
                    dataKey="reactions"
                    name="リアクション"
                    stroke="#eb459e"
                    strokeWidth={2}
                    dot={dotProp}
                    activeDot={{ ...activeDot, fill: "#eb459e" }}
                    isAnimationActive
                    animationDuration={500}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
