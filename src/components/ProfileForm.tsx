"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PLATFORMS } from "@/lib/constants";

// 親コンポーネント(page.tsx)から受け取るデータの型定義
type LinkData = { id?: string; platform: string; url: string };
type UserData = {
  nickname: string | null;
  githubName: string;
  links: LinkData[];
};

export default function ProfileForm({ initialData }: { initialData: UserData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // フォームの状態管理
  const [nickname, setNickname] = useState(initialData.nickname || "");
  const [links, setLinks] = useState<LinkData[]>(
    initialData.links.length > 0
      ? initialData.links.map((l) => ({ id: l.id, platform: l.platform, url: l.url }))
      : [],
  );

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // リンクの追加・削除・更新ロジック
  const addLink = () => setLinks([...links, { platform: "X", url: "" }]);

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const updateLink = (index: number, field: keyof LinkData, value: string) => {
    const newLinks = [...links];
    newLinks[index][field] = value;
    setLinks(newLinks);
  };

  // 保存処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    // 空のURLはフィルタリングして除外する
    const validLinks = links.filter((l) => l.url.trim() !== "");

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          links: validLinks.map((l) => ({ platform: l.platform, url: l.url })),
        }),
      });

      if (!res.ok) throw new Error("Failed to update profile");

      setMessage({ type: "success", text: "プロフィールを保存しました！" });

      // サーバー側のデータを再取得して画面を更新
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "保存に失敗しました。" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ニックネーム入力 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-300">ニックネーム</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={initialData.githubName}
          className="w-full rounded-md border border-gray-700 bg-[#161b22] px-4 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          未入力の場合はGitHub名（{initialData.githubName}）が表示されます。
        </p>
      </div>

      {/* SNSリンク入力エリア */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">
            SNS・ポートフォリオリンク
          </label>
          <button
            type="button"
            onClick={addLink}
            className="text-xs font-medium text-blue-400 hover:text-blue-300"
          >
            + リンクを追加
          </button>
        </div>

        <div className="space-y-3">
          {links.length === 0 ? (
            <p className="text-sm text-gray-500">リンクは登録されていません。</p>
          ) : (
            links.map((link, index) => (
              <div key={link.id || crypto.randomUUID()} className="flex items-center gap-2">
                <select
                  value={link.platform}
                  onChange={(e) => updateLink(index, "platform", e.target.value)}
                  className="rounded-md border border-gray-700 bg-[#161b22] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(index, "url", e.target.value)}
                  placeholder="https://..."
                  className="flex-1 rounded-md border border-gray-700 bg-[#161b22] px-4 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => removeLink(index)}
                  className="p-2 text-gray-500 hover:text-red-400"
                  title="削除"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* メッセージ表示エリア */}
      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-green-900/30 text-green-400"
              : "bg-red-900/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 保存ボタン */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSaving || isPending}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving || isPending ? "保存中..." : "変更を保存する"}
        </button>
      </div>
    </form>
  );
}
