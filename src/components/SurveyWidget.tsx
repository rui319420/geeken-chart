"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";

// ─── 質問定義（aimodel はAiModelPieChart側で管理） ─────────────────
const QUESTIONS = [
  {
    key: "language" as const,
    label: "おすすめの言語",
    emoji: "💬",
    description: "一番推したいプログラミング言語は？",
    color: "#3178c6",
    suggestions: [
      "Python",
      "JavaScript",
      "TypeScript",
      "Rust",
      "C",
      "C++",
      "Go",
      "Kotlin",
      "Swift",
      "Java",
      "C#",
      "Ruby",
      "Zig",
    ],
  },
  {
    key: "os" as const,
    label: "おすすめのOS",
    emoji: "🖥️",
    description: "開発環境として最高のOSは？",
    color: "#e8614a",
    suggestions: [
      "Windows 11",
      "macOS",
      "Ubuntu",
      "Arch Linux",
      "Fedora",
      "Debian",
      "NixOS",
      "openSUSE",
      "WSL2",
    ],
  },
  {
    key: "tool" as const,
    label: "おすすめのツール",
    emoji: "🔧",
    description: "これなしでは生きられないツールは？",
    color: "#f39c12",
    suggestions: [
      "VSCode",
      "Cursor",
      "Neovim",
      "Docker",
      "Git",
      "Tmux",
      "Wezterm",
      "Raycast",
      "Figma",
      "Obsidian",
      "Valgrind",
      "Make",
      "Zsh",
      "GDB/LLDB",
      "Postman",
    ],
  },
] as const;

type CategoryKey = (typeof QUESTIONS)[number]["key"];

interface AggregatedItem {
  answer: string;
  count: number;
}

interface SurveyData {
  aggregated: Record<CategoryKey, AggregatedItem[]>;
  myAnswers: Record<string, string>;
}

// ─── 結果バー ────────────────────────────────────────────────────
function ResultBar({
  item,
  max,
  color,
  isMyAnswer,
}: {
  item: AggregatedItem;
  max: number;
  color: string;
  isMyAnswer: boolean;
}) {
  const pct = max > 0 ? (item.count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-right text-xs text-[#8b949e]">{item.answer}</div>
      <div className="relative flex h-6 flex-1 items-center overflow-hidden rounded-sm bg-white/[0.04]">
        <div
          className="absolute top-0 left-0 h-full rounded-sm transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: isMyAnswer ? color : `${color}66`,
          }}
        />
        {isMyAnswer && (
          <span className="absolute right-2 text-[10px] font-bold" style={{ color }}>
            ✓ あなた
          </span>
        )}
      </div>
      <div className="w-6 shrink-0 text-right text-xs font-bold text-[#636e7b] tabular-nums">
        {item.count}
      </div>
    </div>
  );
}

// ─── 1カテゴリのカード ─────────────────────────────────────────────
function QuestionCard({
  question,
  results,
  myAnswer,
  onVote,
  onClear,
  loading,
}: {
  question: (typeof QUESTIONS)[number];
  results: AggregatedItem[];
  myAnswer: string | undefined;
  onVote: (category: CategoryKey, answer: string) => void;
  onClear: (category: CategoryKey) => void;
  loading: boolean;
}) {
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [activeTab, setActiveTab] = useState<"vote" | "results">("vote");

  const maxCount = results.length > 0 ? results[0].count : 0;
  const totalVotes = results.reduce((s, r) => s + r.count, 0);

  const handleCustomSubmit = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    onVote(question.key, trimmed);
    setCustomInput("");
    setShowCustom(false);
  };

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border transition-all duration-200"
      style={{
        background: "#0d1117",
        borderColor: myAnswer ? `${question.color}44` : "rgba(255,255,255,0.06)",
        boxShadow: myAnswer ? `0 0 20px ${question.color}18` : "none",
      }}
    >
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{question.emoji}</span>
          <div>
            <p className="text-sm font-bold text-[#e6edf3]">{question.label}</p>
            <p className="text-xs text-[#636e7b]">{question.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {myAnswer && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                background: `${question.color}22`,
                color: question.color,
                border: `1px solid ${question.color}44`,
              }}
            >
              {myAnswer}
            </span>
          )}
          <span className="text-xs text-[#484f58]">{totalVotes}票</span>
        </div>
      </div>

      {/* タブ */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }} className="flex">
        {(["vote", "results"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2.5 text-xs font-medium transition-colors"
            style={{
              color: activeTab === tab ? question.color : "#636e7b",
              borderBottom:
                activeTab === tab ? `2px solid ${question.color}` : "2px solid transparent",
              background: "transparent",
            }}
          >
            {tab === "vote" ? "投票する" : "結果を見る"}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      <div className="flex-1 p-5">
        {activeTab === "vote" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {question.suggestions.map((s) => {
                const selected = myAnswer === s;
                return (
                  <button
                    key={s}
                    onClick={() => (selected ? onClear(question.key) : onVote(question.key, s))}
                    disabled={loading}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 disabled:opacity-50"
                    style={{
                      borderColor: selected ? question.color : "rgba(255,255,255,0.1)",
                      background: selected ? `${question.color}22` : "transparent",
                      color: selected ? question.color : "#8b949e",
                    }}
                  >
                    {selected && "✓ "}
                    {s}
                  </button>
                );
              })}
              <button
                onClick={() => setShowCustom((v) => !v)}
                className="rounded-full border border-dashed border-white/10 px-3 py-1.5 text-xs text-[#636e7b] transition-colors hover:border-white/20 hover:text-[#8b949e]"
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
                  placeholder="自由入力（50文字以内）"
                  maxLength={50}
                  className="flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-[#e6edf3] placeholder-[#484f58] focus:border-white/20 focus:outline-none"
                />
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customInput.trim() || loading}
                  className="rounded-md px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                  style={{ background: question.color, color: "#0d1117" }}
                >
                  投票
                </button>
              </div>
            )}

            {myAnswer && (
              <button
                onClick={() => onClear(question.key)}
                className="text-xs text-[#484f58] transition-colors hover:text-[#636e7b]"
              >
                回答を取り消す
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {results.length === 0 ? (
              <p className="py-4 text-center text-xs text-[#484f58]">まだ回答がありません</p>
            ) : (
              results
                .slice(0, 8)
                .map((item) => (
                  <ResultBar
                    key={item.answer}
                    item={item}
                    max={maxCount}
                    color={question.color}
                    isMyAnswer={myAnswer === item.answer}
                  />
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────
export default function SurveyWidget() {
  const { status } = useSession();
  const [data, setData] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/survey");
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("Survey fetch failed:", e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVote = async (category: CategoryKey, answer: string) => {
    if (status !== "authenticated") return;
    setLoading(true);

    // 楽観的更新
    setData((prev) => {
      if (!prev) return prev;
      const myOld = prev.myAnswers[category];
      const list = [...(prev.aggregated[category] ?? [])];

      if (myOld) {
        const idx = list.findIndex((r) => r.answer === myOld);
        if (idx !== -1) {
          const updated = { ...list[idx], count: list[idx].count - 1 };
          if (updated.count <= 0) list.splice(idx, 1);
          else list[idx] = updated;
        }
      }
      const existIdx = list.findIndex((r) => r.answer === answer);
      if (existIdx !== -1) {
        list[existIdx] = { ...list[existIdx], count: list[existIdx].count + 1 };
      } else {
        list.push({ answer, count: 1 });
      }
      list.sort((a, b) => b.count - a.count);

      return {
        aggregated: { ...prev.aggregated, [category]: list },
        myAnswers: { ...prev.myAnswers, [category]: answer },
      };
    });

    try {
      await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, answer }),
      });
    } catch (e) {
      console.error("Vote failed:", e);
      fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async (category: CategoryKey) => {
    if (status !== "authenticated") return;
    setLoading(true);

    setData((prev) => {
      if (!prev) return prev;
      const myOld = prev.myAnswers[category];
      if (!myOld) return prev;
      const list = [...(prev.aggregated[category] ?? [])];
      const idx = list.findIndex((r) => r.answer === myOld);
      if (idx !== -1) {
        const updated = { ...list[idx], count: list[idx].count - 1 };
        if (updated.count <= 0) list.splice(idx, 1);
        else list[idx] = updated;
      }
      const rest = { ...prev.myAnswers };
      delete rest[category];
      return { aggregated: { ...prev.aggregated, [category]: list }, myAnswers: rest };
    });

    try {
      await fetch(`/api/survey?category=${category}`, { method: "DELETE" });
    } catch (e) {
      console.error("Clear failed:", e);
      fetchData();
    } finally {
      setLoading(false);
    }
  };

  const totalResponders = Math.max(
    ...QUESTIONS.map((q) => data?.aggregated[q.key]?.reduce((s, r) => s + r.count, 0) ?? 0),
    0,
  );

  return (
    <div className="w-full">
      {/* ページヘッダー */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">アンケート</h1>
          <p className="mt-1 text-sm text-[#636e7b]">
            メンバーのおすすめ設定を集計しています。1カテゴリにつき1票です。
          </p>
        </div>
        {totalResponders > 0 && (
          <span className="text-xs text-[#484f58]">{totalResponders} 人が回答済み</span>
        )}
      </div>

      {/* 未ログイン時バナー */}
      {status === "unauthenticated" && (
        <div className="mb-5 rounded-xl border border-[#2ea043]/20 bg-[#2ea043]/5 px-4 py-3 text-sm text-[#8b949e]">
          投票するには GitHub でログインしてください
        </div>
      )}

      {/* カード3列 */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {QUESTIONS.map((q) => (
          <QuestionCard
            key={q.key}
            question={q}
            results={data?.aggregated[q.key] ?? []}
            myAnswer={data?.myAnswers[q.key]}
            onVote={handleVote}
            onClear={handleClear}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
}
