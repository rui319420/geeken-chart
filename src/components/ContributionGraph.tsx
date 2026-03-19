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

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    payload: DayData;
    value: number;
  }[];
}

interface CustomXAxisTickProps {
  x?: number;
  y?: number;
  payload?: {
    value: string;
  };
  data: DayData[];
  period: Period;
}

interface TopUser {
  count: number;
  displayName: string;
  avatarUrl: string | null;
}

interface ApiDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  topUser?: TopUser | null;
}

interface ApiResponse {
  daily: ApiDay[];
  weekly: ApiDay[];
}

interface DayData {
  date: string;
  count: number;
  label: string;
  dayLabel: string;
  topUser?: TopUser | null;
}

const TopUserAvatar = ({ topUser, size = 20 }: { topUser: TopUser; size?: number }) => {
  if (!topUser) return null;

  if (!topUser.avatarUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: "#30363d",
          color: "#c9d1d9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.55,
          fontWeight: "bold",
          border: "1px solid #484f58",
        }}
      >
        匿
      </div>
    );
  }
  return (
    <img
      src={topUser.avatarUrl}
      alt={topUser.displayName || "User"}
      style={{ width: size, height: size, borderRadius: "50%", border: "1px solid #484f58" }}
    />
  );
};

function apiToChartData(raw: ApiDay[]): DayData[] {
  if (!raw || !Array.isArray(raw)) return [];

  return raw.map((d) => {
    const dt = new Date(d.date || "");
    const isValidDate = dt instanceof Date && !isNaN(dt.getTime());

    return {
      date: d.date || "",
      count: d.count || 0,
      label: isValidDate ? `${dt.getMonth() + 1}/${dt.getDate()}` : "",
      dayLabel: isValidDate ? String(dt.getDate()) : "",
      topUser: d.topUser || null,
    };
  });
}

const CustomXAxisTick = (props: CustomXAxisTickProps) => {
  const { x, y, payload, data, period } = props;

  if (x === undefined || y === undefined || !payload || !data) return null;

  const pointData = data.find((d: DayData) => d.date === payload.value);

  if (!pointData) return null;
  const label = period === "1m" ? pointData.dayLabel : pointData.label;

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#8b949e" fontSize={11}>
        {label}
      </text>
      {pointData.topUser && (
        <foreignObject x={-10} y={18} width={20} height={20}>
          <TopUserAvatar topUser={pointData.topUser} />
        </foreignObject>
      )}
    </g>
  );
};

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

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
      <p style={{ color: "#8b949e", fontSize: 11, margin: 0 }}>{data.date}</p>
      <p style={{ color: "#3fb950", fontSize: 14, fontWeight: 700, margin: "2px 0 0" }}>
        {data.count}
        <span style={{ color: "#8b949e", fontSize: 11, fontWeight: 400, marginLeft: 4 }}>
          コミット
        </span>
      </p>
      {data.topUser && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid #30363d",
          }}
        >
          <TopUserAvatar topUser={data.topUser} size={16} />
          <span style={{ color: "#c9d1d9", fontSize: 11 }}>{data.topUser.displayName} が1位!</span>
        </div>
      )}
    </div>
  );
};

export default function ContributionGraph() {
  const [period, setPeriod] = useState<Period>("1m");
  const [dailyData, setDailyData] = useState<DayData[]>([]);
  const [weeklyData, setWeeklyData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/contributions/all")
      .then((r) => r.json())
      .then((json) => {
        // ★ 安全対策: APIのレスポンスが想定通りか厳密にチェック
        if (json && Array.isArray(json.daily) && Array.isArray(json.weekly)) {
          setDailyData(apiToChartData(json.daily));
          setWeeklyData(apiToChartData(json.weekly));
        } else {
          console.warn("APIから予期せぬデータが返却されました:", json);
        }
      })
      .catch((e) => console.error("Contributions fetch failed:", e))
      .finally(() => setLoading(false));

    const t = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const data = useMemo(() => {
    // 安全対策
    if (!dailyData || !weeklyData) return [];

    const now = new Date();
    const cutoff = new Date();

    if (period === "1m") {
      cutoff.setMonth(now.getMonth() - 1);
      return dailyData.filter((d) => new Date(d.date) >= cutoff);
    } else {
      cutoff.setFullYear(now.getFullYear() - 1);
      return weeklyData.filter((d) => new Date(d.date) >= cutoff);
    }
  }, [dailyData, weeklyData, period]);

  const maxCount = data?.length > 0 ? Math.max(...data.map((d) => d.count || 0)) : 10;
  const tickInterval = period === "1y" ? Math.floor((data?.length || 0) / 18) : 1;

  return (
    <div
      ref={containerRef}
      style={{
        background: "#0d1117",
        borderRadius: 12,
        border: "1px solid #21262d",
        padding: "20px 24px",
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.5s ease",
      }}
    >
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
        <p style={{ color: "#e6edf3", fontWeight: 700, fontSize: 14, margin: 0 }}>
          コミット推移（全体）
        </p>
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
                color: "#8b949e",
                fontSize: 13,
              }}
            >
              集計中...
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data || []} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="1 3" stroke="#30363d" />
              <XAxis
                dataKey="date"
                tick={<CustomXAxisTick data={data || []} period={period} />}
                tickLine={false}
                axisLine={false}
                interval={period === "1y" ? tickInterval : 0}
              />
              <YAxis
                tick={{ fill: "#8b949e", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={28}
                domain={[0, Math.ceil(maxCount * 1.15) || 10]}
                allowDecimals={false}
                tickCount={6}
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
