"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Period = "1m" | "1y";

const periodLabels: Record<Period, string> = {
  "1m": "1ヶ月",
  "1y": "1年",
};

interface DayData {
  date: string;
  count: number;
  label: string;
  dayLabel: string;
}

function filterByPeriod(data: DayData[], period: Period): DayData[] {
  const now = new Date();
  const cutoff = new Date();
  if (period === "1m") cutoff.setMonth(now.getMonth() - 1);
  else cutoff.setFullYear(now.getFullYear() - 1);

  const filtered = data.filter((d) => new Date(d.date) >= cutoff);

  if (period === "1y") {
    const weekly: Record<string, DayData> = {};
    filtered.forEach((d) => {
      const dt = new Date(d.date);
      const day = dt.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      const monday = new Date(dt);
      monday.setDate(dt.getDate() + diff);
      const key = monday.toISOString().split("T")[0];
      if (!weekly[key]) {
        weekly[key] = {
          date: key,
          count: 0,
          label: `${monday.getMonth() + 1}/${monday.getDate()}`,
          dayLabel: "",
        };
      }
      weekly[key].count += d.count;
    });
    return Object.values(weekly).sort((a, b) => a.date.localeCompare(b.date));
  }

  return filtered;
}

function generateMockData(): DayData[] {
  const data: DayData[] = [];
  const now = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const rand = Math.random();
    const count = rand < 0.15 ? 0 : Math.floor(rand * 22);
    data.push({
      date: dateStr,
      count,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      dayLabel: `${d.getDate()}`,
    });
  }
  return data;
}

const MOCK_DATA = generateMockData();

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value?: number; payload?: { date?: string } }[];
}) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: 6,
        padding: "6px 10px",
      }}
    >
      <p style={{ color: "#8b949e", fontSize: 11, margin: 0 }}>{payload[0]?.payload?.date}</p>
      <p style={{ color: "#3fb950", fontSize: 13, fontWeight: 700, margin: "2px 0 0" }}>
        {payload[0]?.value}
        <span style={{ color: "#8b949e", fontSize: 11, fontWeight: 400, marginLeft: 4 }}>
          コミット
        </span>
      </p>
    </div>
  );
};

function getTickInterval(period: Period, dataLength: number): number {
  if (period === "1m") return 1;
  return Math.floor(dataLength / 18);
}

export default function ContributionGraph() {
  const [period, setPeriod] = useState<Period>("1m");
  const data = useMemo(() => filterByPeriod(MOCK_DATA, period), [period]);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const maxCount = data.length > 0 ? Math.max(...data.map((d) => d.count)) : 0;
  const tickInterval = getTickInterval(period, data.length);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{
        background: "#0d1117",
        borderRadius: 12,
        border: "1px solid #21262d",
        padding: "20px 24px",
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.5s ease",
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <p style={{ color: "#e6edf3", fontWeight: 700, fontSize: 14, margin: 0 }}>
            コミット推移（全体）
          </p>
        </div>

        {/* 期間タブ */}
        <div style={{ display: "flex", background: "#161b22", borderRadius: 8, padding: 2 }}>
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                borderRadius: 6,
                padding: "4px 14px",
                fontSize: 11,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                background: period === p ? "#21262d" : "transparent",
                color: period === p ? "#e6edf3" : "#8b949e",
              }}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* グラフ */}
      <div style={{ height: 220, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 16 }}>
            {/* 点線グリッド（画像に忠実） */}
            <CartesianGrid
              strokeDasharray="1 3"
              stroke="#30363d"
              vertical={true}
              horizontal={true}
            />

            <XAxis
              dataKey={period === "1m" ? "dayLabel" : "label"}
              tick={{ fill: "#8b949e", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={period === "1y" ? tickInterval : 0}
              dy={5}
              label={{
                value: "Days",
                position: "insideBottom",
                offset: -6,
                fill: "#8b949e",
                fontSize: 11,
              }}
            />

            <YAxis
              tick={{ fill: "#8b949e", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={28}
              domain={[0, Math.ceil(maxCount * 1.15) || 10]}
              allowDecimals={false}
              tickCount={6}
              label={{
                value: "",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                fill: "#8b949e",
                fontSize: 11,
              }}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "#58a6ff", strokeWidth: 1, strokeDasharray: "4 3" }}
            />

            <Line
              type="monotone"
              dataKey="count"
              stroke="#3fb950"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: "#8b949e", stroke: "#8b949e", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#3fb950", stroke: "#0d1117", strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={500}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
