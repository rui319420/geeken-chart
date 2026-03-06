import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "技研チャート",
  description: "技術研究会のGitHub活動を可視化するダッシュボード",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="dark">
      <body className="min-h-screen bg-[#0d1117] antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
