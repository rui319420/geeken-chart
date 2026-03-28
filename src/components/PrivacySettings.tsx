"use client";

import { signOut, useSession } from "next-auth/react";
import { useState, useEffect } from "react";

interface Settings {
  includePrivate: boolean;
  showCommits: boolean;
  showLanguages: boolean;
  joinRanking: boolean;
  isAnonymous: boolean;
  githubReauthRequired?: boolean;
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
        </div>
        <p className="mt-0.5 text-xs text-[#636e7b]">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        id={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
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
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/user/settings")
        .then((res) => res.json())
        .then((data) => setSettings(data))
        .catch(console.error);
    }
  }, [status]);

  const update = async (key: keyof Settings, value: boolean) => {
    if (!settings) return;
    const prev = settings[key];
    setSettings({ ...settings, [key]: value });
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
      // Fix #91: 言語チャート・トレンドチャートに設定変更を通知する
      if (key === "includePrivate" || key === "showLanguages") {
        window.dispatchEvent(new CustomEvent("geeken:settings-changed"));
      }
    } catch {
      setSettings({ ...settings, [key]: prev });
      setMessage("保存に失敗しました");
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteDataAndSignOut = async () => {
    const ok = window.confirm(
      "この操作であなたの集計データ（言語・スナップショット・統計・草グラフキャッシュ）が削除されます。続行しますか？",
    );
    if (!ok) return;

    setDeleting(true);
    setMessage("");

    try {
      const res = await fetch("/api/user/delete-and-signout", { method: "POST" });
      if (!res.ok) throw new Error("Failed");

      await signOut({ callbackUrl: "/" });
    } catch {
      setMessage("データ削除に失敗しました");
      setDeleting(false);
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
        <div className="divide-y divide-white/4">
          {settings.githubReauthRequired && (
            <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
              <p className="text-xs text-amber-100">
                GitHub
                連携トークンの有効期限が切れている可能性があります。草グラフ・コミット推移の反映のため、
                一度ログアウトして GitHub で再ログインしてください。
              </p>
            </div>
          )}
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

      <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3">
        <p className="text-xs text-red-100">
          必要に応じて、あなたの集計データを削除したうえでログアウトできます。
        </p>
        <button
          type="button"
          onClick={handleDeleteDataAndSignOut}
          disabled={deleting}
          className="mt-2 rounded-md border border-red-400/40 bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? "処理中..." : "データを消してログアウト"}
        </button>
      </div>
    </div>
  );
}
