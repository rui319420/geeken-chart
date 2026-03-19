"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, type PieSectorDataItem } from "recharts";
import { useSession } from "next-auth/react";

// ─── AIモデルのカラー定義 ──────────────────────────────────────────
const AI_MODEL_COLORS: Record<string, string> = {
  ChatGPT: "#10a37f",
  Claude: "#d4a574",
  Gemini: "#4285f4",
  "GitHub Copilot": "#6e40c9",
  Cursor: "#1a1a2e",
  Perplexity: "#20b2aa",
  Grok: "#1da1f2",
  Mistral: "#ff6b35",
  Llama: "#0064e0",
  DeepSeek: "#4fc3f7",
};

function getModelColor(name: string): string {
  if (AI_MODEL_COLORS[name]) return AI_MODEL_COLORS[name];
  // フォールバック：文字列からハッシュで色生成
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = Math.floor(Math.abs(((Math.sin(hash) * 10000) % 1) * 16777215)).toString(16);
  return "#" + "000000".substring(0, 6 - color.length) + color;
}

// ─── アクティブシェイプ（LanguagePieChart と同じ形式） ──────────────
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
        {`${((percent ?? 0) * 100).toFixed(1)}%`}
      </text>
    </g>
  );
};

// ─── 型定義 ────────────────────────────────────────────────────────
interface SurveyItem {
  answer: string;
  count: number;
}

interface ChartData {
  name: string;
  value: number;
  percentage: number;
}

const SUGGESTIONS = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "GitHub Copilot",
  "Cursor",
  "Perplexity",
  "Grok",
  "Mistral",
  "Llama",
  "DeepSeek",
];

const INTERVAL_MS = 2000;
const INITIAL_DELAY_MS = 1000;
const RESUME_DELAY_MS = 100;

// ─── メインコンポーネント ─────────────────────────────────────────
export default function AiModelPieChart() {
  const { status } = useSession();
  const [data, setData] = useState<ChartData[]>([]);
  const [myAnswer, setMyAnswer] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [voting, setVoting] = useState(false);

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

  // データ取得
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/survey");
      if (!res.ok) return;
      const json = await res.json();

      const rows: SurveyItem[] = json.aggregated?.aimodel ?? [];
      const total = rows.reduce((s, r) => s + r.count, 0);

      const chartData: ChartData[] = rows.slice(0, 10).map((r) => ({
        name: r.answer,
        value: r.count,
        percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
      }));

      setData(chartData);
      dataLengthRef.current = chartData.length;
      activeIndexRef.current = 0;
      setActiveIndex(0);

      setMyAnswer(json.myAnswers?.aimodel ?? undefined);

      if (chartData.length > 0) startLoop(INITIAL_DELAY_MS);
    } catch (e) {
      console.error("AI model survey fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [startLoop]);

  useEffect(() => {
    fetchData();
    return () => stopLoop();
  }, [fetchData, stopLoop]);

  // 投票
  const handleVote = async (answer: string) => {
    if (status !== "authenticated" || voting) return;
    setVoting(true);
    try {
      await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "aimodel", answer }),
      });
      await fetchData();
    } catch (e) {
      console.error("Vote failed:", e);
    } finally {
      setVoting(false);
    }
  };

  const handleCustomSubmit = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    handleVote(trimmed);
    setCustomInput("");
    setShowCustom(false);
  };

  const handleClear = async () => {
    if (status !== "authenticated" || voting) return;
    setVoting(true);
    try {
      await fetch("/api/survey?category=aimodel", { method: "DELETE" });
      await fetchData();
    } catch (e) {
      console.error("Clear failed:", e);
    } finally {
      setVoting(false);
    }
  };

  const totalVotes = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex h-112.5 w-full flex-col rounded-xl border border-[#2ea043]/40 bg-linear-to-br from-[#0d1117] to-[#181a26] p-4 shadow-[0_0_20px_rgba(88,101,242,0.15)] md:h-125 md:p-6">
      {/* ヘッダー */}
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-[#F2F3F5]">推しAI</h2>
          <p className="mt-0.5 text-xs text-[#636e7b]">
            メンバーが一番推しているAIモデル（再投票可）
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#484f58]">
          <span>{totalVotes} 票</span>
          {myAnswer && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                background: `${getModelColor(myAnswer)}22`,
                color: getModelColor(myAnswer),
                border: `1px solid ${getModelColor(myAnswer)}44`,
              }}
            >
              あなた: {myAnswer}
            </span>
          )}
        </div>
      </div>

      {/* 円グラフ */}
      <div className="flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center">
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
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-center text-sm text-[#636e7b]">
              まだ回答がありません
              <br />
              <span className="text-xs">下の選択肢から投票してください</span>
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
                dataKey="value"
                stroke="none"
                shape={renderShape}
                onMouseEnter={(_, index) => {
                  stopLoop();
                  setActiveIndex(index);
                  activeIndexRef.current = index;
                }}
                onMouseLeave={() => startLoop(RESUME_DELAY_MS)}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getModelColor(entry.name)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 投票UI */}
      <div className="mt-3 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {status === "unauthenticated" ? (
          <p className="text-center text-xs text-[#484f58]">
            投票するには GitHub でログインしてください
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[#636e7b]">あなたの推し AI を選んでください</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => {
                const selected = myAnswer === s;
                return (
                  <button
                    key={s}
                    onClick={() => (selected ? handleClear() : handleVote(s))}
                    disabled={voting}
                    className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 disabled:opacity-50"
                    style={{
                      borderColor: selected ? getModelColor(s) : "rgba(255,255,255,0.1)",
                      background: selected ? `${getModelColor(s)}22` : "transparent",
                      color: selected ? getModelColor(s) : "#8b949e",
                    }}
                  >
                    {selected && "✓ "}
                    {s}
                  </button>
                );
              })}
              <button
                onClick={() => setShowCustom((v) => !v)}
                className="rounded-full border border-dashed border-white/10 px-2.5 py-1 text-xs text-[#636e7b] transition-colors hover:border-white/20 hover:text-[#8b949e]"
              >
                + その他
              </button>
            </div>

            {showCustom && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                  placeholder="自由入力（例: Copilot Chat）"
                  maxLength={50}
                  className="flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-[#e6edf3] placeholder-[#484f58] focus:border-white/20 focus:outline-none"
                />
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customInput.trim() || voting}
                  className="rounded-md bg-[#2ea043] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  投票
                </button>
              </div>
            )}

            {myAnswer && (
              <button
                onClick={handleClear}
                className="text-[11px] text-[#484f58] transition-colors hover:text-[#636e7b]"
              >
                回答を取り消す
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
