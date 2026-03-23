/**
 * PageShell
 *
 * デスクトップ: サイドバー(56px)分の左パディング
 * モバイル:     左パディングなし、ボトムナビ分の下パディング(60px)
 *
 * 使い方:
 *   // Before
 *   <div style={{ paddingLeft: "56px" }}>
 *     <Header />
 *     <main ...>...</main>
 *   </div>
 *
 *   // After
 *   <PageShell>
 *     <Header />
 *     <main ...>...</main>
 *   </PageShell>
 */
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="lg:pl-[56px]"
      // モバイルはボトムナビ(約60px) + safe-area-inset-bottom 分の余白
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 60px)" }}
    >
      {children}
    </div>
  );
}
