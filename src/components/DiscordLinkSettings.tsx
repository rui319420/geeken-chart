"use client";

import { useState } from "react";

export default function DiscordLinkSettings() {
  const [link, setLink] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function issue() {
    setBusy(true);
    setError("");
    setLink(null);
    try {
      const response = await fetch("/api/user/discord-link", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "発行に失敗しました。");
      setLink(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "発行に失敗しました。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6 rounded-xl border border-white/5 bg-[#0d1117] p-5">
      <h2 className="font-semibold text-[#e6edf3]">Discord連携</h2>
      <p className="my-3 text-sm text-gray-400">
        コードを発行して、サークルのDiscordサーバーで下のコマンドを実行してください。
        コードは5分間・一度だけ有効です。他の人には共有しないでください。
        再発行すると前のコードは使えなくなります。解除はDiscordで /unlink を実行します。
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={issue}
        className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
      >
        {busy ? "発行中…" : "連携コードを発行"}
      </button>
      {link && (
        <div className="mt-3">
          <label htmlFor="discord-link-code" className="text-sm text-gray-300">
            Discordで実行するコマンド
          </label>
          <input
            id="discord-link-code"
            readOnly
            value={"/link code:" + link.code}
            onFocus={(e) => e.target.select()}
            className="mt-1 w-full rounded border border-gray-600 bg-gray-900 p-2 text-white"
          />
          <p className="mt-2 text-sm text-gray-400">
            有効期限: {new Date(link.expiresAt).toLocaleTimeString("ja-JP")}
          </p>
        </div>
      )}
      <p role="status" className="mt-2 text-sm text-red-300">
        {error}
      </p>
    </section>
  );
}
