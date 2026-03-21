import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

const CACHE_TTL = 60 * 60 * 6; // 6時間
const MONTHS_BACK = 12;

const EXCLUDED_LANGUAGES = new Set(["ShaderLab", "HLSL", "GLSL", "Jupyter Notebook"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "average" ? "average" : "total";

  const CACHE_KEY = `languages:trend:${mode}`;

  // ──────────────────────────────────────
  // 1. Redis キャッシュチェック
  // ──────────────────────────────────────
  const cached = await redis.get(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  // ──────────────────────────────────────
  // 2. LanguageSnapshot テーブルから集計
  // ──────────────────────────────────────
  const months = getRecentMonths(MONTHS_BACK);

  const snapshots = await prisma.languageSnapshot.findMany({
    where: {
      month: { in: months },
      user: { showLanguages: true },
    },
    select: { userId: true, language: true, bytes: true, month: true },
  });

  if (snapshots.length === 0) {
    return NextResponse.json([]);
  }

  let result;

  if (mode === "total") {
    // ── 合計モード: 全ユーザーのbytesを月×言語で合算 ──
    const byMonth: Record<string, Record<string, number>> = {};
    for (const row of snapshots) {
      if (EXCLUDED_LANGUAGES.has(row.language)) continue;
      if (!byMonth[row.month]) byMonth[row.month] = {};
      byMonth[row.month][row.language] =
        (byMonth[row.month][row.language] ?? 0) + Number(row.bytes);
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

    result = months
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
  } else {
    // ── 平均モード: ユーザーごとに割合を出してから月ごとに平均 ──
    // { month -> { userId -> { language -> bytes } } }
    const byMonthUser: Record<string, Record<string, Record<string, number>>> = {};
    for (const row of snapshots) {
      if (EXCLUDED_LANGUAGES.has(row.language)) continue;
      if (!byMonthUser[row.month]) byMonthUser[row.month] = {};
      if (!byMonthUser[row.month][row.userId]) byMonthUser[row.month][row.userId] = {};
      byMonthUser[row.month][row.userId][row.language] =
        (byMonthUser[row.month][row.userId][row.language] ?? 0) + Number(row.bytes);
    }

    // 全期間の言語スコア合計（トップ5選定用）
    const scoreMap: Record<string, number> = {};
    for (const userMap of Object.values(byMonthUser)) {
      for (const langBytes of Object.values(userMap)) {
        const userTotal = Object.values(langBytes).reduce((s, b) => s + b, 0);
        if (userTotal === 0) continue;
        for (const [lang, bytes] of Object.entries(langBytes)) {
          scoreMap[lang] = (scoreMap[lang] ?? 0) + bytes / userTotal;
        }
      }
    }
    const topLangs = Object.entries(scoreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang]) => lang);

    result = months
      .filter((m) => byMonthUser[m])
      .map((m) => {
        const userMap = byMonthUser[m];
        const users = Object.values(userMap).filter(
          (lb) => Object.values(lb).reduce((s, b) => s + b, 0) > 0,
        );
        const userCount = users.length;

        const point: { month: string; [k: string]: string | number } = {
          month: formatMonth(m),
        };
        for (const lang of topLangs) {
          const sumPct = users.reduce((s, langBytes) => {
            const userTotal = Object.values(langBytes).reduce((t, b) => t + b, 0);
            return s + (userTotal > 0 ? (langBytes[lang] ?? 0) / userTotal : 0);
          }, 0);
          point[lang] = userCount > 0 ? Math.round((sumPct / userCount) * 1000) / 10 : 0;
        }
        return point;
      });
  }

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
