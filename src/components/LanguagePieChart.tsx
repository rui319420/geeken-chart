"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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

  // KBの表示（バイト数が0の場合は非表示）
  const payloadData = payload as { bytes?: number };
  const bytesText = payloadData.bytes ? `${(payloadData.bytes / 1024).toFixed(0)} KB` : "";

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

interface LangData {
  name: string;
  bytes?: number;
  percentage: number;
}

type AggregationMode = "total" | "average";

const INTERVAL_MS = 2000;
const INITIAL_DELAY_MS = 1000;
const RESUME_DELAY_MS = 100;

export default function LanguagePieChart() {
  const [data, setData] = useState<LangData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [includePrivate, setIncludePrivate] = useState<boolean | null>(null);
  const [mode, setMode] = useState<AggregationMode>("total");

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

  // 設定取得
  useEffect(() => {
    fetch("/api/user/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { includePrivate?: boolean } | null) =>
        setIncludePrivate(s?.includePrivate ?? false),
      );
  }, []);

  // データ取得（modeの変更も監視する）
  useEffect(() => {
    if (includePrivate === null) return; // 設定取得待ち

    const fetchData = async () => {
      setLoading(true); // モード切り替え時にローディングを出す
      try {
        const params = new URLSearchParams();
        if (includePrivate) params.set("includePrivate", "true");
        params.set("mode", mode);
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
  }, [includePrivate, mode, startLoop]);

  return (
    <div className="flex h-112.5 w-full flex-col rounded-xl border border-[#2ea043]/40 bg-linear-to-br from-[#0d1117] to-[#181a26] p-4 shadow-[0_0_20px_rgba(88,101,242,0.15)] md:h-125 md:p-6">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-[#F2F3F5]">言語割合（全体）</h2>
          <p className="mt-0.5 text-xs text-[#636e7b]">
            {includePrivate
              ? "公開・プライベート含むコード使用量を集計（GitHub Linguist）"
              : "公開リポジトリのコード使用量を集計（GitHub Linguist）"}
          </p>
        </div>

        {/* モード切替トグル */}
        <div className="flex items-center gap-2 rounded-lg bg-black/40 p-1">
          <button
            onClick={() => setMode("total")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              mode === "total"
                ? "bg-[#388bfd]/20 text-[#388bfd] shadow-[0_0_10px_rgba(56,139,253,0.3)]"
                : "text-[#949BA4] hover:text-[#F2F3F5]"
            }`}
          >
            全体合計
          </button>
          <button
            onClick={() => setMode("average")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              mode === "average"
                ? "bg-[#388bfd]/20 text-[#388bfd] shadow-[0_0_10px_rgba(56,139,253,0.3)]"
                : "text-[#949BA4] hover:text-[#F2F3F5]"
            }`}
          >
            ユーザー平均
          </button>
        </div>
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
              dataKey="percentage"
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
