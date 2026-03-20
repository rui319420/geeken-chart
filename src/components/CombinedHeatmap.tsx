"use client";

import React, { useEffect, useState, useRef, startTransition, useCallback } from "react";
import { ActivityCalendar, type ThemeInput } from "react-activity-calendar";

type ContributionData = {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

type Period = "latest" | "2026" | "2025" | "2024";

const periodLabels: Record<Period, string> = {
  latest: "直近1年",
  "2026": "2026年",
  "2025": "2025年",
  "2024": "2024年",
};

const githubTheme: ThemeInput = {
  light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${days[date.getDay()]})`;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  date: string;
  count: number;
}

export default function CombinedHeatmap() {
  const [period, setPeriod] = useState<Period>("latest");
  const [data, setData] = useState<ContributionData[]>([]);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef<Partial<Record<Period, ContributionData[]>>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    date: "",
    count: 0,
  });
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cached = cacheRef.current[period];
    if (cached) {
      startTransition(() => {
        setData(cached);
        setLoading(false);
      });
      return;
    }
    startTransition(() => setLoading(true));

    const url =
      period === "latest" ? "/api/contributions/all" : `/api/contributions/all?year=${period}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("fetch error");
        return res.json();
      })
      .then((json: { daily: ContributionData[]; weekly: ContributionData[] }) => {
        const dailyData = json.daily || [];
        cacheRef.current[period] = dailyData;
        startTransition(() => setData(dailyData));
      })
      .catch((e) => console.error("Failed to fetch contributions:", e))
      .finally(() => startTransition(() => setLoading(false)));
  }, [period]);

  const handleMouseOver = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as SVGElement;
    const date = target.getAttribute("data-date");
    const count = target.getAttribute("data-count");

    if (!date) {
      if (!hideTimerRef.current) {
        hideTimerRef.current = setTimeout(() => {
          setTooltip((p) => ({ ...p, visible: false }));
          hideTimerRef.current = null;
        }, 120);
      }
      return;
    }

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (!containerRect) return;

    const x = targetRect.left - containerRect.left + targetRect.width / 2;
    const y = targetRect.top - containerRect.top;

    setTooltip({ visible: true, x, y, date, count: Number(count ?? 0) });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setTooltip((p) => ({ ...p, visible: false }));
      hideTimerRef.current = null;
    }, 150);
  }, []);

  return (
    <div className="flex w-full flex-col rounded-xl border border-[#2ea043]/40 bg-[#0d1117] p-6 shadow-[0_0_20px_rgba(46,160,67,0.15)]">
      {/* ヘッダー */}
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-[#F2F3F5]">サークル全体の活動</h3>
          <p className="mt-0.5 text-xs text-[#949BA4]">メンバー全員のコントリビューションを集計</p>
        </div>

        <div className="flex rounded-lg bg-[#1E1F22] p-1">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              disabled={loading}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 disabled:opacity-50 ${
                period === p
                  ? "bg-[#2ea043] text-white shadow-md"
                  : "text-[#949BA4] hover:bg-[#2B2D31] hover:text-[#DBDEE1]"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ヒートマップ */}
      <div
        className="overflow-x-auto rounded-lg bg-[#0d1117] p-5"
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
      >
        {loading ? (
          <div className="flex h-40 items-center justify-center">
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
          <div className="flex h-40 items-center justify-center text-[#949BA4]">
            データがありません
          </div>
        ) : (
          <ActivityCalendar
            data={data}
            theme={githubTheme}
            colorScheme="dark"
            blockSize={14}
            blockMargin={4}
            fontSize={13}
            labels={{
              legend: { less: "少", more: "多" },
              months: [
                "1月",
                "2月",
                "3月",
                "4月",
                "5月",
                "6月",
                "7月",
                "8月",
                "9月",
                "10月",
                "11月",
                "12月",
              ],
              totalCount: `{{count}} コミット`,
            }}
            showWeekdayLabels
            style={{ color: "#949BA4" }}
            renderBlock={(block, activity) =>
              React.cloneElement(
                block as React.ReactElement<
                  React.SVGProps<SVGRectElement> & {
                    "data-date"?: string;
                    "data-count"?: string;
                  }
                >,
                {
                  "data-date": activity.date,
                  "data-count": String(activity.count),
                  style: { cursor: "pointer" },
                },
              )
            }
          />
        )}
      </div>

      {/* フローティングツールチップ */}
      <div
        className="pointer-events-none absolute z-50 rounded-lg border border-[#30363d] shadow-xl"
        style={{
          left: tooltip.x,
          top: tooltip.y - 6,
          transform: "translate(-50%, -100%)",
          background: "#161b22",
          padding: "8px 12px",
          opacity: tooltip.visible && tooltip.date ? 1 : 0,
          transition: "opacity 0.08s ease",
          minWidth: "max-content",
        }}
      >
        <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b border-[#30363d] bg-[#161b22]" />
        <div className="relative z-10">
          {tooltip.date && (
            <>
              <p className="text-[11px] text-[#8b949e]">{formatDate(tooltip.date)}</p>
              {tooltip.count > 0 ? (
                <p className="mt-0.5 text-sm font-bold">
                  <span className="text-[#39d353]">{tooltip.count.toLocaleString()}</span>
                  <span className="ml-1 text-xs font-normal text-[#8b949e]">コミット</span>
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-[#484f58]">コミットなし</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
