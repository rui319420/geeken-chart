"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useMemo } from "react";
import { GITHUB_LANGUAGE_COLORS, getRandomColor } from "@/lib/constants";

// 言語データの型（APIからのレスポンス想定）
interface LangData {
  name: string;
  bytes?: number;
  percentage: number;
}

export default function ExcludedLanguagesSettings() {
  const { data: session, status } = useSession();
  const [excluded, setExcluded] = useState<string[]>([]);
  const [myLanguages, setMyLanguages] = useState<LangData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 初回マウント時に「自分の設定」と「自分の言語一覧」を取得
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.name) return;

    const fetchAllData = async () => {
      setLoading(true);
      try {
        // 現在の設定（除外リスト）を取得
        const settingsRes = await fetch("/api/user/settings");
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.excludedLanguages) {
            setExcluded(settingsData.excludedLanguages);
          }
        }

        // 自分のGitHubから取得した言語データ一覧を取得（ユーザー名を使ってAPIを叩く想定）
        const langRes = await fetch(`/api/languages/me`);
        if (langRes.ok) {
          const langData: LangData[] = await langRes.json();
          setMyLanguages(langData);
        }
      } catch (e) {
        console.error("Failed to fetch language settings data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [status, session]);

  // バイト数が多い順にソート（使用量の多い言語から順に表示するため）
  const sortedLanguages = useMemo(() => {
    return [...myLanguages].sort((a, b) => (b.bytes || 0) - (a.bytes || 0));
  }, [myLanguages]);

  // トグルスイッチの切り替え処理
  const handleToggle = (langName: string, isExcluded: boolean) => {
    let newExcluded;
    if (isExcluded) {
      // 既に除外されているなら、リストから外す（含めるようにする）
      newExcluded = excluded.filter((lang) => lang !== langName);
    } else {
      // 除外されていないなら、リストに追加する
      newExcluded = [...excluded, langName];
    }
    setExcluded(newExcluded);
  };

  // APIにデータを送信して保存する
  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludedLanguages: excluded }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMessage("保存しました");
      setTimeout(() => setMessage(""), 2000);
    } catch {
      setMessage("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (status === "unauthenticated") return null;

  return (
    <div className="rounded-xl border border-white/5 bg-[#0d1117] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* フィルターアイコン */}
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#d29922]/10">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d29922"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#e6edf3]">グラフから除外する言語</p>
        </div>
        {message && (
          <span
            className={`text-xs ${message.includes("失敗") ? "text-red-400" : "text-[#3fb950]"}`}
          >
            {message}
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-[#949BA4]">
        ※この設定は今後のアップデートで追加される「マイページ（個人統計）」に反映されます。サークル全体の集計グラフには影響しません。
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <p className="animate-pulse text-xs text-[#8b949e]">言語データを読み込み中...</p>
        </div>
      ) : sortedLanguages.length === 0 ? (
        <div className="flex justify-center rounded-lg border border-white/5 bg-white/2 py-6">
          <p className="text-xs text-[#636e7b]">あなたの言語データがまだありません。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {sortedLanguages.map((lang) => {
            const isExcluded = excluded.includes(lang.name);
            const color = GITHUB_LANGUAGE_COLORS[lang.name] ?? getRandomColor(lang.name);

            return (
              <label
                key={lang.name}
                className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                  isExcluded
                    ? "border-white/5 bg-[#161b22]/50 opacity-60 hover:bg-[#161b22]"
                    : "border-white/10 bg-[#161b22] hover:border-white/20 hover:bg-[#21262d]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: isExcluded ? "#484f58" : color }}
                  />
                  <span
                    className={`text-sm font-medium ${isExcluded ? "text-[#8b949e] line-through" : "text-[#e6edf3]"}`}
                  >
                    {lang.name}
                  </span>
                </div>

                {/* カスタムトグルスイッチ */}
                <div
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${!isExcluded ? "bg-[#2ea043]" : "bg-[#30363d]"}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={!isExcluded}
                    onChange={() => handleToggle(lang.name, isExcluded)}
                  />
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${!isExcluded ? "translate-x-4" : "translate-x-0"}`}
                  />
                </div>
              </label>
            );
          })}
        </div>
      )}

      <div className="mt-6 border-t border-white/5 pt-4">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full rounded-md bg-[#238636] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "保存中..." : "変更を保存"}
        </button>
      </div>
    </div>
  );
}
