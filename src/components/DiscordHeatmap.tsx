"use client";

import { useEffect, useState, useRef } from "react";

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

type Week = "current" | "last";

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
    return {
      background: "rgba(100, 160, 255, 0.85)",
      boxShadow: "0 0 10px rgba(100,160,255,0.4)",
    };
  return { background: "rgba(130, 180, 255, 1.0)", boxShadow: "0 0 16px rgba(130,180,255,0.6)" };
}

function makeDummyData(): HeatmapData {
  const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));
  return { matrix, maxVal: 1, normalized: matrix };
}

export default function DiscordHeatmap() {
  const [week, setWeek] = useState<Week>("current");
  const [dataMap, setDataMap] = useState<Partial<Record<Week, HeatmapData>>>({});
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<{ day: number; hour: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const [now, setNow] = useState<{ day: number; hour: number }>({
    day: (new Date().getDay() + 6) % 7,
    hour: new Date().getHours(),
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchWeek = (w: Week) => {
    if (dataMap[w]) return;
    setLoading(true);
    const url = w === "last" ? "/api/discord/heatmap?week=last" : "/api/discord/heatmap";
    fetch(url)
      .then((r) => r.json())
      .then((d: HeatmapData) => setDataMap((prev) => ({ ...prev, [w]: d })))
      .catch((e) => console.error("Discord heatmap fetch failed:", e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    fetchWeek("current");

    const timer = setInterval(() => {
      const d = new Date();
      setNow({ day: (d.getDay() + 6) % 7, hour: d.getHours() });
    }, 60000);

    return () => {
      clearTimeout(t);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWeekChange = (w: Week) => {
    setWeek(w);
    fetchWeek(w);
  };

  const data = dataMap[week];
  const display = data ?? makeDummyData();
  const isCurrent = week === "current";

  return (
    <div
      ref={containerRef}
      style={{
        background: "#0d1117",
        border: "1px solid rgba(88, 101, 242, 0.25)",
        borderRadius: 12,
        padding: "16px 20px 14px",
        width: "100%",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        boxShadow: "0 0 24px rgba(88, 101, 242, 0.08), inset 0 0 40px rgba(88, 101, 242, 0.03)",
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <h3 style={{ color: "#e6edf3", fontWeight: 700, fontSize: 20, margin: 0 }}>
          Discord アクティビティ
        </h3>

        <div
          style={{
            display: "flex",
            background: "#161b22",
            border: "1px solid rgba(88,101,242,0.2)",
            borderRadius: 8,
            padding: 3,
            gap: 2,
          }}
        >
          {(["current", "last"] as Week[]).map((w) => (
            <button
              key={w}
              onClick={() => handleWeekChange(w)}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                background: week === w ? "rgba(88,101,242,0.25)" : "transparent",
                color: week === w ? "#a5b4fc" : "#636e7b",
              }}
            >
              {w === "current" ? "今週" : "先週"}
            </button>
          ))}
        </div>
      </div>

      {/* ヒートマップ本体 */}
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "22px 1fr", marginBottom: 3 }}>
          <div />
          <div style={{ position: "relative", height: 20 }}>
            {HOUR_TICKS.map((h) => (
              <span
                key={h}
                style={{
                  position: "absolute",
                  left: `${(h / 24) * 100}%`,
                  transform: "translateX(-50%)",
                  fontSize: 12,
                  color: "#636e7b",
                  fontFamily: "monospace",
                }}
              >
                {h}
              </span>
            ))}
          </div>
        </div>

        {DAY_LABELS.map((dayLabel, d) => (
          <div
            key={d}
            style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 3, marginBottom: 2 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: isCurrent && d === now.day ? "#a5b4fc" : d >= 5 ? "#7c8cf5" : "#636e7b",
                fontWeight: (isCurrent && d === now.day) || d >= 5 ? 700 : 400,
              }}
            >
              {dayLabel}
            </div>

            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: 24 }, (_, h) => {
                const norm = loading ? 0 : display.normalized[d][h];
                const count = loading ? 0 : display.matrix[d][h];
                const isHovered = hovered?.day === d && hovered?.hour === h;
                const isNow = isCurrent && now.day === d && now.hour === h;
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
                      outline: isNow ? "2px solid rgba(255,255,255,0.9)" : "none",
                      outlineOffset: isNow ? "1px" : "0",
                      zIndex: isNow ? 1 : 0,
                      boxShadow: isHovered
                        ? "0 0 0 1.5px rgba(88,101,242,0.8), 0 0 8px rgba(88,101,242,0.5)"
                        : cellStyle.boxShadow,
                      transition: "box-shadow 0.12s ease",
                      cursor: count > 0 ? "pointer" : "default",
                      animation: loading
                        ? `pulse 1.5s ease-in-out ${(d * 24 + h) * 8}ms infinite`
                        : isNow
                          ? "pulse-now 2s ease-in-out infinite"
                          : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 凡例 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 4,
          marginTop: 12,
        }}
      >
        <span style={{ fontSize: 10, color: "#484f58" }}>少</span>
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
        <span style={{ fontSize: 10, color: "#484f58" }}>多</span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.7; }
        }
        @keyframes pulse-now {
          0%, 100% { outline-color: rgba(255,255,255,0.9); }
          50%       { outline-color: rgba(255,255,255,0.3); }
        }
      `}</style>
    </div>
  );
}
