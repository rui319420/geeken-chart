"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, type PieSectorDataItem } from "recharts";
import { useSession } from "next-auth/react";

// ─── カラー定義 ───────────────────────────────────────────────────
const AI_MODEL_COLORS: Record<string, string> = {
  ChatGPT: "#10a37f",
  Claude: "#d4813a",
  Gemini: "#4285f4",
  "GitHub Copilot": "#6e40c9",
  Cursor: "#5865f2",
  Perplexity: "#20b2aa",
  Grok: "#1da1f2",
  Mistral: "#ff6b35",
  Llama: "#0064e0",
  DeepSeek: "#4fc3f7",
};

function getModelColor(name: string): string {
  if (AI_MODEL_COLORS[name]) return AI_MODEL_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = Math.floor(Math.abs(((Math.sin(hash) * 10000) % 1) * 16777215)).toString(16);
  return "#" + "000000".substring(0, 6 - color.length) + color;
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

// ─── アクティブシェイプ ───────────────────────────────────────────
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
  const mx = (cx ?? 0) + ((outerRadius ?? 0) + 22) * cos;
  const my = (cy ?? 0) + ((outerRadius ?? 0) + 22) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 18;
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
        x={ex + (cos >= 0 ? 1 : -1) * 10}
        y={ey}
        textAnchor={textAnchor}
        fill="#F2F3F5"
        fontWeight="bold"
        fontSize={13}
      >
        {`${((percent ?? 0) * 100).toFixed(1)}%`}
      </text>
    </g>
  );
};

// ─── 型 ──────────────────────────────────────────────────────────
interface ChartData {
  name: string;
  value: number;
}

const INTERVAL_MS = 2000;
const INITIAL_DELAY_MS = 800;
const RESUME_DELAY_MS = 100;

// ─── メインコンポーネント ─────────────────────────────────────────
export default function AiModelPieChart() {
  const { status } = useSession();

  // サーバーから取得した自分の回答
  const [myAnswer, setMyAnswer] = useState<string | undefined>(undefined);
  // チャートデータ
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  // 再選択モード（回答済みでも投票UIを表示）
  const [reselecting, setReselecting] = useState(false);
  // カスタム入力
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [voting, setVoting] = useState(false);

  // アニメーション
  const [activeIndex, setActiveIndex] = useState(0);
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

  // ─── データ取得 ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/survey");
      if (!res.ok) return;
      const json = await res.json();

      const rows: { answer: string; count: number }[] = json.aggregated?.aimodel ?? [];
      const data: ChartData[] = rows.slice(0, 10).map((r) => ({
        name: r.answer,
        value: r.count,
      }));
      setChartData(data);
      dataLengthRef.current = data.length;

      const answered = json.myAnswers?.aimodel as string | undefined;
      setMyAnswer(answered);

      // 回答済みでチャートがある → ループ開始
      if (answered && data.length > 0) {
        startLoop(INITIAL_DELAY_MS);
      }
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

  // チャート表示に切り替わったらループ開始
  useEffect(() => {
    if (myAnswer && !reselecting && chartData.length > 0) {
      startLoop(INITIAL_DELAY_MS);
    } else {
      stopLoop();
    }
  }, [myAnswer, reselecting, chartData.length, startLoop, stopLoop]);

  // ─── 投票処理 ──────────────────────────────────────────────────
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
      setReselecting(false); // 投票完了 → チャート表示へ
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

  const totalVotes = chartData.reduce((s, d) => s + d.value, 0);

  // ─── 表示モードの判定 ──────────────────────────────────────────
  // 「投票UIを見せるか」= 未回答 OR 再選択中
  const showVoteUI = !myAnswer || reselecting;

  // ─── ローディング ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-112.5 w-full items-center justify-center rounded-xl border border-[#2ea043]/40 bg-linear-to-br from-[#0d1117] to-[#181a26] md:h-125">
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
    );
  }

  // ─── 投票UI（未回答 or 再選択中） ─────────────────────────────
  if (showVoteUI) {
    return (
      <div className="flex h-112.5 w-full flex-col rounded-xl border border-[#2ea043]/40 bg-linear-to-br from-[#0d1117] to-[#181a26] p-4 shadow-[0_0_20px_rgba(88,101,242,0.15)] md:h-125 md:p-6">
        {/* ヘッダー */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-wider text-[#F2F3F5]">
              ❤ 推しAIの教え合い ❤
            </h2>
            <p className="mt-0.5 text-xs text-[#636e7b]">
              あなたが今一番おすすめするAIモデルを教えてください
            </p>
          </div>
          {/* 再選択中は戻るボタン */}
          {reselecting && (
            <button
              onClick={() => setReselecting(false)}
              className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-[#636e7b] transition-colors hover:border-white/20 hover:text-[#8b949e]"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              結果に戻る
            </button>
          )}
        </div>

        {/* 未ログイン */}
        {status === "unauthenticated" ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-sm text-[#636e7b]">
              投票するには GitHub でログインしてください
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-between">
            <div className="space-y-4">
              {/* 回答促進メッセージ（初回のみ） */}
              {!reselecting && (
                <div className="flex items-start gap-3 rounded-lg border border-[#2ea043]/20 bg-[#2ea043]/5 px-4 py-3">
                  <span className="mt-0.5 text-base">💡</span>
                  <p className="text-xs leading-relaxed text-[#8b949e]">
                    あなたの推しAIを選ぶと、
                    <span className="font-semibold text-[#3fb950]">メンバー全体の結果</span>
                    を見られるようになります。
                  </p>
                </div>
              )}

              {/* 選択肢 */}
              <div>
                <p className="mb-3 text-xs font-medium text-[#636e7b]">AIを選んでください</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => {
                    const color = getModelColor(s);
                    const selected = myAnswer === s && reselecting;
                    return (
                      <button
                        key={s}
                        onClick={() => handleVote(s)}
                        disabled={voting}
                        className="group flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-all duration-150 disabled:opacity-50"
                        style={{
                          borderColor: selected ? color : "rgba(255,255,255,0.1)",
                          background: selected ? `${color}22` : "transparent",
                          color: selected ? color : "#8b949e",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = color;
                          e.currentTarget.style.background = `${color}18`;
                          e.currentTarget.style.color = color;
                        }}
                        onMouseLeave={(e) => {
                          if (!selected) {
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "#8b949e";
                          }
                        }}
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: color }}
                        />
                        {s}
                        {selected && <span className="ml-0.5">✓</span>}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setShowCustom((v) => !v)}
                    className="rounded-full border border-dashed border-white/10 px-3 py-2 text-xs text-[#636e7b] transition-colors hover:border-white/20 hover:text-[#8b949e]"
                  >
                    + その他
                  </button>
                </div>
              </div>

              {/* カスタム入力 */}
              {showCustom && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                    placeholder="自由入力（例: Copilot Chat）"
                    maxLength={50}
                    className="flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[#e6edf3] placeholder-[#484f58] focus:border-white/20 focus:outline-none"
                  />
                  <button
                    onClick={handleCustomSubmit}
                    disabled={!customInput.trim() || voting}
                    className="rounded-md bg-[#2ea043] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#3fb950] disabled:opacity-40"
                  >
                    投票
                  </button>
                </div>
              )}
            </div>

            {/* 総票数（再選択時は表示） */}
            {reselecting && totalVotes > 0 && (
              <p className="mt-4 text-right text-xs text-[#484f58]">{totalVotes} 票</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── チャートUI（回答済み） ────────────────────────────────────
  return (
    <div className="flex h-112.5 w-full flex-col rounded-xl border border-[#ff79c6]/40 bg-linear-to-br from-[#0d1117] to-[#181a26] p-4 shadow-[0_0_20px_rgba(255,121,198,0.15)] md:h-125 md:p-6">
      {/* ヘッダー */}
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        {" "}
        <div>
          <h2 className="text-xl font-bold tracking-wider text-[#F2F3F5]">❤ 推しAIの教え合い ❤</h2>
          <p className="mt-0.5 text-xs text-[#636e7b]">
            メンバーが今1番おすすめするAIモデル（再選択可）
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 自分の回答バッジ */}
          {myAnswer && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{
                background: `${getModelColor(myAnswer)}22`,
                color: getModelColor(myAnswer),
                border: `1px solid ${getModelColor(myAnswer)}44`,
              }}
            >
              ✓ {myAnswer}
            </span>
          )}
          {/* 再選択ボタン */}
          <button
            onClick={() => setReselecting(true)}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-[#636e7b] transition-colors hover:border-white/20 hover:text-[#8b949e]"
          >
            再選択
          </button>
        </div>
      </div>

      {/* 円グラフ */}
      <div className="flex-1">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[#636e7b]">まだ回答がありません</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 16, right: 80, bottom: 16, left: 80 }}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="42%"
                outerRadius="68%"
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
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getModelColor(entry.name)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* フッター */}
      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {chartData.slice(0, 5).map((d) => (
            <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-[#636e7b]">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: getModelColor(d.name) }}
              />
              {d.name}
              <span className="text-[#484f58] tabular-nums">{d.value}</span>
            </span>
          ))}
        </div>
        <span className="shrink-0 text-xs text-[#484f58]">{totalVotes} 票</span>
      </div>
    </div>
  );
}
