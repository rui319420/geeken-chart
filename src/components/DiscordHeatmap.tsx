"use client";

import { useEffect, useState, useRef } from "react";

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

interface HeatmapData {
  matrix: number[][];
  maxVal: number;
  normalized: number[][];
}

function getCellStyle(value: number): { background: string; boxShadow: string } {
  if (value === 0) return { background: "rgba(22, 27, 34, 0.8)", boxShadow: "none" };
  if (value < 0.1) return { background: "rgba(56, 139, 253, 0.12)", boxShadow: "none" };
  if (value < 0.25) return { background: "rgba(56, 139, 253, 0.28)", boxShadow: "none" };
  if (value < 0.45) return { background: "rgba(56, 139, 253, 0.48)", boxShadow: "none" };
  if (value < 0.65)
    return { background: "rgba(79, 149, 255, 0.68)", boxShadow: "0 0 6px rgba(79,149,255,0.3)" };
  if (value < 0.82)
    return { background: "rgba(100, 160, 255, 0.85)", boxShadow: "0 0 10px rgba(100,160,255,0.4)" };
  return { background: "rgba(130, 180, 255, 1.0)", boxShadow: "0 0 16px rgba(130,180,255,0.6)" };
}

function getBestSlots(matrix: number[][], maxVal: number) {
  const slots: { day: number; hour: number; score: number }[] = [];
  for (let d = 0; d < 7; d++)
    for (let h = 0; h < 24; h++)
      if (matrix[d][h] > 0) slots.push({ day: d, hour: h, score: matrix[d][h] });
  return slots
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => ({ ...s, pct: Math.round((s.score / maxVal) * 100) }));
}

function makeDummyData(): HeatmapData {
  const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));
  return { matrix, maxVal: 1, normalized: matrix };
}

export default function DiscordHeatmap() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<{ day: number; hour: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    fetch("/api/discord/heatmap")
      .then((r) => r.json())
      .then((d: HeatmapData) => setData(d))
      .catch((e) => console.error("Discord heatmap fetch failed:", e))
      .finally(() => setLoading(false));
    return () => clearTimeout(t);
  }, []);

  const display = data ?? makeDummyData();
  const bestSlots = data && data.maxVal > 0 ? getBestSlots(data.matrix, data.maxVal) : [];
  const isEmpty = !loading && (!data || data.maxVal === 0);

  return (
    <div
      ref={containerRef}
      style={{
        background: "linear-gradient(135deg, #0d1117 0%, #0f1520 100%)",
        border: "1px solid #1c2333",
        borderRadius: 12,
        padding: "16px 20px 14px",
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
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#5865f2",
                boxShadow: "0 0 8px #5865f2",
              }}
            />
            <h3
              style={{
                color: "#e6edf3",
                fontWeight: 700,
                fontSize: 13,
                margin: 0,
                letterSpacing: "0.01em",
              }}
            >
              Discord アクティビティ
            </h3>
          </div>
          <p style={{ color: "#8b949e", fontSize: 11, margin: 0, fontFamily: "sans-serif" }}>
            メンバーの活動時間帯（JST）· メッセージ＋オンライン遷移
          </p>
        </div>

        {bestSlots.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 10,
                color: "#636e7b",
                fontFamily: "sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              📣 通知おすすめ
            </span>
            {bestSlots.map((s, i) => (
              <span
                key={i}
                style={{
                  background: "rgba(88, 101, 242, 0.12)",
                  border: "1px solid rgba(88, 101, 242, 0.3)",
                  borderRadius: 99,
                  padding: "3px 10px",
                  fontSize: 11,
                  color: "#7c8cf5",
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                }}
              >
                {DAY_LABELS[s.day]} {String(s.hour).padStart(2, "0")}時台{" "}
                <span style={{ color: "#5865f2", fontWeight: 700 }}>{s.pct}%</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ヒートマップ本体 */}
      <div>
        <div>
          {/* X軸 時間ラベル */}
          <div style={{ display: "grid", gridTemplateColumns: "22px 1fr", marginBottom: 3 }}>
            <div />
            <div style={{ position: "relative", height: 14 }}>
              {HOUR_TICKS.map((h) => (
                <span
                  key={h}
                  style={{
                    position: "absolute",
                    left: `${(h / 24) * 100}%`,
                    transform: "translateX(-50%)",
                    fontSize: 10,
                    color: "#636e7b",
                    fontFamily: "monospace",
                    userSelect: "none",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* 行（曜日×時間） */}
          {DAY_LABELS.map((dayLabel, d) => (
            <div
              key={d}
              style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 3, marginBottom: 2 }}
            >
              {/* 曜日ラベル */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: d >= 5 ? "#7c8cf5" : "#636e7b",
                  fontFamily: "sans-serif",
                  userSelect: "none",
                  fontWeight: d >= 5 ? 700 : 400,
                }}
              >
                {dayLabel}
              </div>

              {/* セル */}
              <div style={{ display: "flex", gap: 2 }}>
                {Array.from({ length: 24 }, (_, h) => {
                  const norm = loading ? 0 : display.normalized[d][h];
                  const count = loading ? 0 : display.matrix[d][h];
                  const isHovered = hovered?.day === d && hovered?.hour === h;
                  const cellStyle = getCellStyle(norm);

                  return (
                    <div
                      key={h}
                      onMouseEnter={() => setHovered({ day: d, hour: h })}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        flex: 1,
                        aspectRatio: "1 / 1",
                        borderRadius: 3,
                        background: loading ? "rgba(22,27,34,0.5)" : cellStyle.background,
                        boxShadow: isHovered
                          ? "0 0 12px rgba(88,101,242,0.7)"
                          : cellStyle.boxShadow,
                        transform: isHovered ? "scaleY(1.2)" : "scaleY(1)",
                        transition: "transform 0.1s ease, box-shadow 0.1s ease",
                        cursor: count > 0 ? "pointer" : "default",
                        animation: loading
                          ? `pulse 1.5s ease-in-out ${(d * 24 + h) * 8}ms infinite`
                          : "none",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ホバー情報 */}
      <div style={{ minHeight: 26, marginTop: 8 }}>
        {hovered && !isEmpty ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 14px",
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: 8,
              fontSize: 11,
              fontFamily: "sans-serif",
            }}
          >
            <span style={{ color: "#8b949e" }}>
              {DAY_LABELS[hovered.day]}曜&nbsp;
              {String(hovered.hour).padStart(2, "0")}:00〜
              {String(hovered.hour + 1).padStart(2, "0")}:00
            </span>
            <span
              style={{
                color: display.matrix[hovered.day][hovered.hour] > 0 ? "#7c8cf5" : "#484f58",
                fontWeight: 700,
              }}
            >
              {display.matrix[hovered.day][hovered.hour].toLocaleString()} 人
            </span>
          </div>
        ) : isEmpty ? (
          <p style={{ fontSize: 12, color: "#484f58", margin: 0, fontFamily: "sans-serif" }}>
            まだ活動データがありません · Bot がメッセージを記録すると表示されます
          </p>
        ) : null}
      </div>

      {/* 凡例 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 4,
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 10, color: "#484f58", fontFamily: "sans-serif" }}>少</span>
        {[0, 0.15, 0.35, 0.55, 0.75, 1.0].map((v, i) => {
          const s = getCellStyle(v);
          return (
            <div
              key={i}
              style={{
                width: 11,
                height: 11,
                borderRadius: 2,
                background: s.background,
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            />
          );
        })}
        <span style={{ fontSize: 10, color: "#484f58", fontFamily: "sans-serif" }}>多</span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
