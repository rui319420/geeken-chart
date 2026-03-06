"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  Tooltip,
  ResponsiveContainer,
  type PieSectorDataItem,
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
};

const getRandomColor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = Math.floor(Math.abs(((Math.sin(hash) * 10000) % 1) * 16777215)).toString(16);
  return "#" + "000000".substring(0, 6 - color.length) + color;
};

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
  value,
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
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} fontSize={18} fontWeight="bold">
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
        {`使用量: ${value}`}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#949BA4">
        {`(割合: ${((percent ?? 0) * 100).toFixed(2)}%)`}
      </text>
    </g>
  );
};

type Period = "1m" | "3m" | "1y" | "all";
interface PieData {
  name: string;
  value: number;
}

const mockData: Record<Period, PieData[]> = {
  "1m": [
    { name: "TypeScript", value: 450 },
    { name: "C", value: 250 },
    { name: "Python", value: 200 },
    { name: "Go", value: 100 },
  ],
  "3m": [
    { name: "TypeScript", value: 1200 },
    { name: "Python", value: 900 },
    { name: "C", value: 450 },
    { name: "Rust", value: 300 },
    { name: "Go", value: 150 },
  ],
  "1y": [
    { name: "Python", value: 4200 },
    { name: "TypeScript", value: 3600 },
    { name: "JavaScript", value: 1800 },
    { name: "C", value: 1200 },
    { name: "Rust", value: 1200 },
  ],
  all: [
    { name: "JavaScript", value: 8000 },
    { name: "Python", value: 7500 },
    { name: "TypeScript", value: 6000 },
    { name: "C", value: 4500 },
    { name: "HTML", value: 1500 },
    { name: "CSS", value: 1500 },
  ],
};

const periodLabels: Record<Period, string> = {
  "1m": "直近1ヶ月",
  "3m": "直近3ヶ月",
  "1y": "直近1年",
  all: "総合",
};

const INTERVAL_MS = 2000; // ループ間隔
const INITIAL_DELAY_MS = 1000; // 初回開始までの遅延
const RESUME_DELAY_MS = 100; // マウスが離れてから再開するまでの遅延

export default function LanguagePieChart() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("1m");
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const currentData = mockData[selectedPeriod];
  const dataLengthRef = useRef(currentData.length);
  const activeIndexRef = useRef<number>(0);
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
      if (props.index === activeIndex) {
        return renderActiveShape(props);
      }
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

  // 期間変更・マウント時にループをリセット
  useEffect(() => {
    dataLengthRef.current = currentData.length;
    activeIndexRef.current = 0;
    setActiveIndex(0);
    startLoop(INITIAL_DELAY_MS);
    return () => stopLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const handlePeriodChange = (period: Period) => {
    setSelectedPeriod(period);
  };

  return (
    <div className="flex h-[450px] w-full flex-col rounded-xl border border-[#2ea043]/40 bg-gradient-to-br from-[#0d1117] to-[#181a26] p-4 shadow-[0_0_20px_rgba(88,101,242,0.15)] md:h-[500px] md:p-6">
      <div className="mb-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <h2 className="text-xl font-bold tracking-wider text-[#F2F3F5]">言語割合（全体）</h2>
        <div className="flex flex-wrap justify-center rounded-lg bg-[#1E1F22] p-1 shadow-inner">
          {(Object.keys(periodLabels) as Period[]).map((period) => (
            <button
              key={period}
              onClick={() => handlePeriodChange(period)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                selectedPeriod === period
                  ? "bg-[#5865F2] text-white shadow-md"
                  : "text-[#949BA4] hover:bg-[#2B2D31] hover:text-[#DBDEE1]"
              }`}
            >
              {periodLabels[period]}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 20, right: 120, bottom: 0, left: 120 }}>
          <Pie
            data={currentData}
            cx="50%"
            cy="50%"
            innerRadius="38%"
            outerRadius="58%"
            dataKey="value"
            stroke="none"
            shape={renderShape}
            onMouseEnter={(_, index) => {
              stopLoop();
              setActiveIndex(index);
              activeIndexRef.current = index;
            }}
            onMouseLeave={() => {
              startLoop(RESUME_DELAY_MS);
            }}
          >
            {currentData.map((entry, index) => {
              const cellColor = GITHUB_LANGUAGE_COLORS[entry.name] || getRandomColor(entry.name);
              return <Cell key={`cell-${index}`} fill={cellColor} />;
            })}
          </Pie>
          <Tooltip
            content={() => null}
            defaultIndex={activeIndex}
            key={activeIndex as number}
          />{" "}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
