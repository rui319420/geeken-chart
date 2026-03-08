"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, type PieSectorDataItem } from "recharts";

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

function getRandomColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = Math.floor(Math.abs(((Math.sin(hash) * 10000) % 1) * 16777215)).toString(16);
  return "#" + "000000".substring(0, 6 - color.length) + color;
}

const renderActiveShape = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  startAngle,
  endAngle,
  fill,
  payload,
  percent,
}: PieSectorDataItem) => {
  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * (midAngle ?? 0));
  const cos = Math.cos(-RADIAN * (midAngle ?? 0));
  const sx = (cx ?? 0) + ((outerRadius ?? 0) + 10) * cos;
  const sy = (cy ?? 0) + ((outerRadius ?? 0) + 10) * sin;
  const mx = (cx ?? 0) + ((outerRadius ?? 0) + 30) * cos;
  const my = (cy ?? 0) + ((outerRadius ?? 0) + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} fontSize={22} fontWeight="bold">
        {(payload as { name: string }).name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={(outerRadius ?? 0) + 6}
        outerRadius={(outerRadius ?? 0) + 10}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={2} />
      <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        textAnchor={textAnchor}
        fill="#F2F3F5"
        fontWeight="bold"
      >
        {`${((percent ?? 0) * 100).toFixed(1)}%`}
      </text>
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        dy={18}
        textAnchor={textAnchor}
        fill="#949BA4"
        fontSize={12}
      >
        {(payload as { name: string; bytes: number }).bytes
          ? `${((payload as { bytes: number }).bytes / 1024).toFixed(0)} KB`
          : ""}
      </text>
    </g>
  );
};

interface LangData {
  name: string;
  bytes: number;
  percentage: number;
}

const INTERVAL_MS = 2000;
const INITIAL_DELAY_MS = 1000;
const RESUME_DELAY_MS = 100;

export default function LanguagePieChart() {
  const [data, setData] = useState<LangData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [includePrivate, setIncludePrivate] = useState<boolean | null>(null);

  const dataLengthRef = useRef(0);
  const activeIndexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopLoop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  const startLoop = useCallback(
    (delay = 0) => {
      stopLoop();
      resumeTimerRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          activeIndexRef.current = (activeIndexRef.current + 1) % dataLengthRef.current;
          setActiveIndex(activeIndexRef.current);
        }, INTERVAL_MS);
      }, delay);
    },
    [stopLoop],
  );

  const renderShape = useCallback(
    (props: PieSectorDataItem & { index?: number }) => {
      if (props.index === activeIndex) return renderActiveShape(props);
      return (
        <Sector
          cx={props.cx}
          cy={props.cy}
          innerRadius={props.innerRadius}
          outerRadius={props.outerRadius}
          startAngle={props.startAngle}
          endAngle={props.endAngle}
          fill={props.fill}
        />
      );
    },
    [activeIndex],
  );

  // 1. 設定取得
  useEffect(() => {
    fetch("/api/user/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((s) => setIncludePrivate(s.includePrivate ?? false))
      .catch(() => setIncludePrivate(false));
  }, []);

  // データ取得
  useEffect(() => {
    if (includePrivate === null) return; // 設定取得待ち

    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        if (includePrivate) params.set("includePrivate", "true");
        params.set("t", Date.now().toString());

        const res = await fetch(`/api/languages/all?${params.toString()}`, {
          cache: "no-store",
        });
        const json: LangData[] = await res.json();
        setData(json);
        dataLengthRef.current = json.length;
        activeIndexRef.current = 0;
        setActiveIndex(0);
        startLoop(INITIAL_DELAY_MS);
      } catch (e) {
        console.error("Language fetch failed:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => stopLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includePrivate, startLoop]);

  return (
    <div className="flex h-[450px] w-full flex-col rounded-xl border border-[#2ea043]/40 bg-gradient-to-br from-[#0d1117] to-[#181a26] p-4 shadow-[0_0_20px_rgba(88,101,242,0.15)] md:h-[500px] md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-[#F2F3F5]">言語割合（全体）</h2>
          <p className="mt-0.5 text-xs text-[#636e7b]">
            {includePrivate
              ? "公開・プライベート含むコード使用量を集計（GitHub Linguist）"
              : "公開リポジトリのコード使用量を集計（GitHub Linguist）"}
          </p>
        </div>
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
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-[#949BA4]">
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
        <div className="flex flex-1 items-center justify-center">
          <p className="text-center text-sm text-[#636e7b]">
            データがありません
            <br />
            <span className="text-xs">GitHubでログインすると自動で集計されます</span>
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 20, right: 120, bottom: 0, left: 120 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="38%"
              outerRadius="58%"
              dataKey="bytes"
              stroke="none"
              shape={renderShape}
              onMouseEnter={(_, index) => {
                stopLoop();
                setActiveIndex(index);
                activeIndexRef.current = index;
              }}
              onMouseLeave={() => startLoop(RESUME_DELAY_MS)}
            >
              {data.map((entry, index) => {
                const color = GITHUB_LANGUAGE_COLORS[entry.name] ?? getRandomColor(entry.name);
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
