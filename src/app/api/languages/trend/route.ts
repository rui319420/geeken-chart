import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

const CACHE_KEY = "languages:trend";
const CACHE_TTL = 60 * 60 * 6; // 6時間
const MONTHS_BACK = 12;

const EXCLUDED_LANGUAGES = new Set(["ShaderLab", "HLSL", "GLSL"]);

export async function GET() {
  // ──────────────────────────────────────
  // 1. Redis キャッシュチェック
  // ──────────────────────────────────────
  const cached = await redis.get(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  // ──────────────────────────────────────
  // 2. LanguageSnapshot テーブルから集計
  //    （refresh 時に github-history.ts が全ユーザー分を書き込んでいる）
  // ──────────────────────────────────────
  const months = getRecentMonths(MONTHS_BACK);

  const snapshots = await prisma.languageSnapshot.findMany({
    where: {
      month: { in: months },
      user: { showLanguages: true },
    },
    select: { language: true, bytes: true, month: true },
  });

  if (snapshots.length === 0) {
    return NextResponse.json([]);
  }

  // 月 × 言語 ごとに bytes を合算
  const byMonth: Record<string, Record<string, number>> = {};
  for (const row of snapshots) {
    if (EXCLUDED_LANGUAGES.has(row.language)) continue; // ★
    if (!byMonth[row.month]) byMonth[row.month] = {};
    byMonth[row.month][row.language] = (byMonth[row.month][row.language] ?? 0) + Number(row.bytes);
  }

  // 全期間トップ5言語を選定
  const totals: Record<string, number> = {};
  for (const langMap of Object.values(byMonth)) {
    for (const [lang, bytes] of Object.entries(langMap)) {
      totals[lang] = (totals[lang] ?? 0) + bytes;
    }
  }
  const topLangs = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang]) => lang);

  // DataPoint[] に変換（使用率 % に正規化）
  const result = months
    .filter((m) => byMonth[m])
    .map((m) => {
      const langMap = byMonth[m];
      const total = Object.values(langMap).reduce((s, b) => s + b, 0);
      const point: { month: string; [k: string]: string | number } = {
        month: formatMonth(m),
      };
      for (const lang of topLangs) {
        const bytes = langMap[lang] ?? 0;
        point[lang] = total > 0 ? Math.round((bytes / total) * 1000) / 10 : 0;
      }
      return point;
    });

  await redis.set(CACHE_KEY, result, { ex: CACHE_TTL });
  return NextResponse.json(result);
}

function getRecentMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function formatMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return `${y}/${parseInt(m, 10)}`;
}
