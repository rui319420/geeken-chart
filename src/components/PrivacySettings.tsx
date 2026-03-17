"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface Settings {
  includePrivate: boolean;
  showCommits: boolean;
  showLanguages: boolean;
  joinRanking: boolean;
  isAnonymous: boolean;
  nickname?: string;
}

interface ToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  highlight?: boolean;
}

function Toggle({ id, label, description, checked, onChange, disabled, highlight }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[#e6edf3]">{label}</p>
          {highlight && (
            <span className="rounded bg-[#388bfd]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#388bfd]">
              NEW
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-[#636e7b]">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        id={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
          checked ? "bg-[#2ea043]" : "bg-[#30363d]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export default function PrivacySettings() {
  const { status } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState<keyof Settings | null>(null);
  const [message, setMessage] = useState("");
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((data: Settings) => {
        setSettings(data);
        if (data.nickname) setNickname(data.nickname);
      })
      .catch((e) => console.error("Settings fetch failed:", e));
  }, [status]);

  const update = async (key: keyof Settings, value: boolean) => {
    if (!settings) return;
    const prev = settings[key];
    setSettings({ ...settings, [key]: value }); // 楽観的更新
    setSaving(key);
    setMessage("");

    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error("Failed");
      setMessage("保存しました");
      setTimeout(() => setMessage(""), 2000);
    } catch {
      setSettings({ ...settings, [key]: prev }); // ロールバック
      setMessage("保存に失敗しました");
    } finally {
      setSaving(null);
    }
  };

  const updateNickname = async () => {
    setSaving("nickname");
    setMessage("");

    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setMessage("ニックネームを保存しました");
      setTimeout(() => setMessage(""), 2000);
    } catch {
      setMessage("保存に失敗しました");
    } finally {
      setSaving(null);
    }
  };

  if (status === "unauthenticated") return null;

  return (
    <div className="rounded-xl border border-white/5 bg-[#0d1117] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#388bfd]/10">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#388bfd"
              strokeWidth="2.5"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#e6edf3]">プライバシー設定</p>
        </div>
        {message && (
          <span
            className={`text-xs ${message.includes("失敗") ? "text-red-400" : "text-[#3fb950]"}`}
          >
            {message}
          </span>
        )}
      </div>

      {!settings ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="space-y-1.5">
                <div className="h-3.5 w-32 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-48 animate-pulse rounded bg-white/5" />
              </div>
              <div className="h-5 w-9 animate-pulse rounded-full bg-white/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {/* ニックネーム */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#e6edf3]">ニックネーム</p>
              <p className="mt-0.5 text-xs text-[#636e7b]">ランキング等で表示される名前です。</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="新しい名前"
                maxLength={20}
                className="rounded-md border border-white/10 bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3] focus:border-[#388bfd] focus:ring-1 focus:ring-[#388bfd] focus:outline-none"
              />
              <button
                onClick={updateNickname}
                disabled={saving === "nickname" || nickname.trim() === ""}
                className="rounded-md bg-[#238636] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
          {/* プライベートリポジトリ */}
          <Toggle
            id="includePrivate"
            label="プライベートリポジトリを含める"
            description="自分のプライベートリポジトリの言語データも集計に含めます。データはあなた自身のOAuthトークンで取得されます。"
            checked={settings.includePrivate}
            onChange={(v) => update("includePrivate", v)}
            disabled={saving === "includePrivate"}
            highlight
          />

          <Toggle
            id="showLanguages"
            label="使用言語を公開"
            description="自分の使用言語をランキングや集計に含めます。"
            checked={settings.showLanguages}
            onChange={(v) => update("showLanguages", v)}
            disabled={saving === "showLanguages"}
          />

          <Toggle
            id="showCommits"
            label="コミット数を公開"
            description="自分のコミット数をランキングや集計に含めます。"
            checked={settings.showCommits}
            onChange={(v) => update("showCommits", v)}
            disabled={saving === "showCommits"}
          />

          <Toggle
            id="joinRanking"
            label="ランキングに参加"
            description="コミット数・言語使用量のランキングに表示されます。"
            checked={settings.joinRanking}
            onChange={(v) => update("joinRanking", v)}
            disabled={saving === "joinRanking"}
          />

          <Toggle
            id="isAnonymous"
            label="匿名モード"
            description="名前を伏せて全体集計のみに参加します。個人の活動は表示されません。"
            checked={settings.isAnonymous}
            onChange={(v) => update("isAnonymous", v)}
            disabled={saving === "isAnonymous"}
          />
        </div>
      )}

      {settings?.includePrivate && (
        <div className="mt-3 rounded-lg border border-[#388bfd]/20 bg-[#388bfd]/5 p-3">
          <p className="text-xs text-[#8b949e]">
            <span className="font-medium text-[#388bfd]">ℹ プライベートリポジトリ有効</span>
            <br />
            「今すぐ更新」を実行するとプライベートリポジトリのデータも取得されます。
            あなたのデータのみ更新されます（他のメンバーには影響しません）。
          </p>
        </div>
      )}
    </div>
  );
}
