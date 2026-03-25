"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, type PieSectorDataItem } from "recharts";
import { GITHUB_LANGUAGE_COLORS, getRandomColor } from "@/lib/constants";

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

  const payloadData = payload as { bytes?: number };
  const bytesText = payloadData.bytes ? `${(payloadData.bytes / 1024).toFixed(0)} KB` : "";

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} fontSize={26} fontWeight="bold">
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
      {bytesText && (
        <text
          x={ex + (cos >= 0 ? 1 : -1) * 12}
          y={ey}
          dy={18}
          textAnchor={textAnchor}
          fill="#949BA4"
          fontSize={12}
        >
          {bytesText}
        </text>
      )}
    </g>
  );
};

type RawLanguageData = { language: string; bytes: number };

export default function UserLanguagePieChart({ languages }: { languages: RawLanguageData[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const dataLengthRef = useRef(0);
  const activeIndexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const data = useMemo(() => {
    if (!languages || languages.length === 0) return [];

    const totalBytes = languages.reduce((sum, lang) => sum + lang.bytes, 0);

    if (totalBytes === 0) return [];

    // 上位5つ
    const top5 = languages.slice(0, 5).map((lang) => ({
      name: lang.language,
      bytes: lang.bytes,
      percentage: lang.bytes / totalBytes,
    }));

    // 6位以降があれば「Others」としてまとめる
    const others = languages.slice(5);
    if (others.length > 0) {
      const othersBytes = others.reduce((sum, lang) => sum + lang.bytes, 0);
      top5.push({
        name: "Others",
        bytes: othersBytes,
        percentage: othersBytes / totalBytes,
      });
    }

    return top5;
  }, [languages]);

  useEffect(() => {
    dataLengthRef.current = data.length;
  }, [data]);

  const stopLoop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    intervalRef.current = setInterval(() => {
      if (dataLengthRef.current > 0) {
        activeIndexRef.current = (activeIndexRef.current + 1) % dataLengthRef.current;
        setActiveIndex(activeIndexRef.current);
      }
    }, 2500);
  }, [stopLoop]);

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

  useEffect(() => {
    if (data.length <= 1) return;
    startLoop();
    return () => stopLoop();
  }, [data.length, startLoop, stopLoop]);

  if (data.length === 0) {
    return <p className="text-sm text-gray-500">表示できる言語データがありません。</p>;
  }

  return (
    <div className="h-80 w-full sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="50%"
            outerRadius="70%"
            dataKey="percentage"
            stroke="none"
            shape={renderShape}
            onMouseEnter={(_, index) => {
              stopLoop();
              setActiveIndex(index);
              activeIndexRef.current = index;
            }}
            onMouseLeave={() => startLoop()}
          >
            {data.map((entry, index) => {
              // Othersは専用の色（グレー系）にし、それ以外はGitHubの色を使う
              const color =
                entry.name === "Others"
                  ? "#484f58"
                  : (GITHUB_LANGUAGE_COLORS[entry.name] ?? getRandomColor(entry.name));
              return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
