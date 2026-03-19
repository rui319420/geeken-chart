"use client";

import { useEffect, useState, useRef, startTransition } from "react";
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

export default function CombinedHeatmap() {
  const [period, setPeriod] = useState<Period>("latest");
  const [data, setData] = useState<ContributionData[]>([]);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef<Partial<Record<Period, ContributionData[]>>>({});

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
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((json: { daily: ContributionData[]; weekly: ContributionData[] }) => {
        const dailyData = json.daily || [];
        cacheRef.current[period] = dailyData;
        startTransition(() => setData(dailyData));
      })
      .catch((error) => {
        console.error("Failed to fetch combined contributions:", error);
      })
      .finally(() => startTransition(() => setLoading(false)));
  }, [period]);

  return (
    <div className="flex w-full flex-col rounded-xl border border-[#2ea043]/40 bg-linear-to-br from-[#0d1117] to-[#181a26] p-6 shadow-[0_0_20px_rgba(88,101,242,0.15)]">
      {/* ヘッダー */}
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-[#F2F3F5]">サークル全体の活動</h3>
          <p className="mt-0.5 text-xs text-[#949BA4]">メンバー全員のコントリビューションを集計</p>
        </div>

        {/* 期間タブ */}
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
      <div className="overflow-x-auto rounded-lg bg-[#0d1117] p-5">
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
          />
        )}
      </div>
    </div>
  );
}
