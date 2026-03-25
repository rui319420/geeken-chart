"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GITHUB_LANGUAGE_COLORS, getRandomColor } from "@/lib/constants";

type LanguageData = {
  id: string;
  language: string;
  bytes: number;
  isHiddenProfile: boolean;
};

export default function ProfileLanguageVisibility({
  initialLanguages,
}: {
  initialLanguages: LanguageData[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [languages, setLanguages] = useState<LanguageData[]>(initialLanguages);

  useEffect(() => {
    setLanguages(initialLanguages);
  }, [initialLanguages]);

  // トグルスイッチを押した時の処理
  const handleToggle = async (langId: string, currentIsHidden: boolean) => {
    const newIsHidden = !currentIsHidden;

    setLanguages((prev) =>
      prev.map((l) => (l.id === langId ? { ...l, isHiddenProfile: newIsHidden } : l)),
    );

    try {
      const res = await fetch("/api/user/languages/visibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId: langId, isHiddenProfile: newIsHidden }),
      });

      if (!res.ok) throw new Error("API Error");

      // サーバー側の最新データを再取得
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to update visibility:", error);
      // 失敗したら画面のスイッチを元の状態に戻す
      setLanguages((prev) =>
        prev.map((l) => (l.id === langId ? { ...l, isHiddenProfile: currentIsHidden } : l)),
      );
      alert("設定の保存に失敗しました。");
    }
  };

  // バイト数が多い順（よく書いている言語順）に並び替え
  const sortedLanguages = [...languages].sort((a, b) => b.bytes - a.bytes);

  return (
    <div className="mt-8 rounded-xl border border-gray-800 bg-[#161b22] p-6 shadow-xl">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">公開プロフィールの言語表示設定</h2>
        <p className="mt-1 text-sm text-gray-400">
          公開プロフィール画面の円グラフに表示する言語を選べます。（OFFにしても全体のランキング集計には影響しません）
        </p>
      </div>

      {sortedLanguages.length === 0 ? (
        <p className="text-sm text-gray-500">言語データがありません。</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {sortedLanguages.map((lang) => {
            const isVisible = !lang.isHiddenProfile;
            const color = GITHUB_LANGUAGE_COLORS[lang.language] ?? getRandomColor(lang.language);

            return (
              <label
                key={lang.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-blue-500 ${
                  !isVisible
                    ? "border-gray-800 bg-[#0d1117] opacity-60 hover:bg-[#161b22]"
                    : "border-gray-700 bg-[#0d1117] hover:border-gray-600 hover:bg-[#21262d]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: !isVisible ? "#484f58" : color }}
                  />
                  <span
                    className={`text-sm font-medium ${!isVisible ? "text-gray-500 line-through" : "text-gray-200"}`}
                  >
                    {lang.language}
                  </span>
                </div>

                {/* トグルスイッチ */}
                <div
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isVisible ? "bg-blue-600" : "bg-gray-700"
                  } ${isPending ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isVisible}
                    onChange={() => handleToggle(lang.id, lang.isHiddenProfile)}
                    disabled={isPending}
                  />
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isVisible ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
