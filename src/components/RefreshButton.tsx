"use client";

import { useState } from "react";

interface RefreshResult {
  username: string;
  languages: number;
  commits: number;
  snapshotMonths: number;
  frameworks: number;
  usedPrivateToken: boolean;
  skipped?: boolean;
  error?: string;
}

interface RefreshResponse {
  message: string;
  updatedUsers: number;
  skippedUsers: number;
  force: boolean;
  results: RefreshResult[];
}

type Status = "idle" | "loading" | "done" | "error";

export default function RefreshButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<RefreshResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const [cacheStatus, setCacheStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [cacheDeleted, setCacheDeleted] = useState(0);

  const handleRefresh = async () => {
    setStatus("loading");
    setResponse(null);
    setErrorMsg("");

    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 200);

    try {
      const res = await fetch("/api/admin/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      clearInterval(timer);
      setElapsed(Math.floor((Date.now() - start) / 1000));

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data: RefreshResponse = await res.json();
      setResponse(data);
      setStatus("done");
    } catch (e) {
      clearInterval(timer);
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  };

  const handleClearCache = async () => {
    setCacheStatus("loading");
    setCacheDeleted(0);
    try {
      const res = await fetch("/api/admin/clear-depfile-cache", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data: { deleted: number } = await res.json();
      setCacheDeleted(data.deleted);
      setCacheStatus("done");
    } catch {
      setCacheStatus("error");
    }
  };

  return (
    <div className="space-y-3">
      {/* ── データ手動更新 ── */}
      <div className="rounded-xl border border-white/5 bg-[#0d1117] p-5">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#f78166]/10">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f78166"
              strokeWidth="2.5"
            >
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#e6edf3]">データ手動更新</p>
            <p className="text-xs text-[#636e7b]">
              開発用 — 全メンバーのデータを再取得してDBに保存
            </p>
          </div>
        </div>

        {/* ボタン */}
        <button
          onClick={handleRefresh}
          disabled={status === "loading"}
          className="flex items-center gap-2 rounded-lg border border-[#f78166]/30 bg-[#f78166]/10 px-4 py-2 text-sm font-medium text-[#f78166] transition-all duration-200 hover:border-[#f78166]/60 hover:bg-[#f78166]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? (
            <>
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
              更新中... ({elapsed}s)
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M1 4v6h6M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
              今すぐ更新
            </>
          )}
        </button>

        {/* 更新中のプログレス表示 */}
        {status === "loading" && (
          <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="text-xs text-[#8b949e]">
              全メンバーの GitHub データを取得しています。
              <br />
              メンバー数によっては1〜2分かかる場合があります。
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded bg-white/5">
              <div className="h-full animate-pulse rounded bg-[#f78166]/50" />
            </div>
          </div>
        )}

        {/* エラー */}
        {status === "error" && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-xs text-red-400">エラー: {errorMsg}</p>
          </div>
        )}

        {/* 完了結果 */}
        {status === "done" && response && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-[#3fb950]">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {response.updatedUsers}人を更新
              {response.skippedUsers > 0 && (
                <span className="text-[#636e7b]">/ {response.skippedUsers}人スキップ</span>
              )}
              <span className="text-[#636e7b]">（{elapsed}秒）</span>
            </div>

            {/* ユーザーごとの結果 */}
            <div className="max-h-48 overflow-y-auto rounded-lg border border-white/5 bg-white/[0.02]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-[#636e7b]">
                    <th className="px-3 py-2 text-left font-medium">ユーザー</th>
                    <th className="px-3 py-2 text-right font-medium">言語</th>
                    <th className="px-3 py-2 text-right font-medium">コミット</th>
                    <th className="px-3 py-2 text-right font-medium">履歴</th>
                    <th className="px-3 py-2 text-right font-medium">FW</th>
                    <th className="px-3 py-2 text-left font-medium">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {response.results.map((r) => (
                    <tr key={r.username} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-3 py-2 text-[#e6edf3]">
                        {r.username}
                        {r.usedPrivateToken && (
                          <span className="ml-1.5 rounded bg-[#388bfd]/15 px-1 py-0.5 text-[10px] text-[#388bfd]">
                            private
                          </span>
                        )}
                      </td>
                      {r.skipped ? (
                        <td colSpan={4} className="px-3 py-2 text-center text-[#636e7b]">
                          スキップ（1時間以内に更新済み）
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right text-[#8b949e]">{r.languages}種</td>
                          <td className="px-3 py-2 text-right text-[#8b949e]">
                            {r.commits.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-[#8b949e]">
                            {r.snapshotMonths}ヶ月
                          </td>
                          <td className="px-3 py-2 text-right text-[#8b949e]">{r.frameworks}種</td>
                        </>
                      )}
                      <td className="px-3 py-2">
                        {r.error ? (
                          <span className="text-red-400" title={r.error}>
                            ⚠ 部分失敗
                          </span>
                        ) : r.skipped ? null : (
                          <span className="text-[#3fb950]">✓ OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[#636e7b]">
              ページをリロードするとグラフに最新データが反映されます。
            </p>
          </div>
        )}
      </div>

      {/* ── depfile キャッシュクリア ── */}
      <div className="rounded-xl border border-white/5 bg-[#0d1117] p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#388bfd]/10">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#388bfd"
              strokeWidth="2.5"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#e6edf3]">フレームワークキャッシュクリア</p>
            <p className="text-xs text-[#636e7b]">
              package.json 等の取得キャッシュをリセット。フレームワーク表示がおかしい時に使用
            </p>
          </div>
        </div>

        <button
          onClick={handleClearCache}
          disabled={cacheStatus === "loading"}
          className="flex items-center gap-2 rounded-lg border border-[#388bfd]/30 bg-[#388bfd]/10 px-4 py-2 text-sm font-medium text-[#388bfd] transition-all duration-200 hover:border-[#388bfd]/60 hover:bg-[#388bfd]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cacheStatus === "loading" ? (
            <>
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
              クリア中...
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
              キャッシュをクリア
            </>
          )}
        </button>

        {cacheStatus === "done" && (
          <div className="mt-3 flex items-center gap-2 text-xs text-[#3fb950]">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            {cacheDeleted}件のキャッシュを削除しました。次の更新で再取得されます。
          </div>
        )}

        {cacheStatus === "error" && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-xs text-red-400">キャッシュクリアに失敗しました</p>
          </div>
        )}
      </div>
    </div>
  );
}
