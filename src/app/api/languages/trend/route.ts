import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

// フロントに返す型
interface DataPoint {
  month: string; // "2026/3"
  [lang: string]: string | number;
}

const CACHE_KEY = "languages:trend";
const CACHE_TTL = 60 * 60 * 6; // 6時間
const TOP_LANGUAGES = 5; // 折れ線グラフに表示する言語数
const MONTHS_BACK = 12; // 直近何ヶ月分を返すか

export async function GET() {
  // ──────────────────────────────────────
  // 1. キャッシュチェック
  // ──────────────────────────────────────
  const cached = await redis.get<DataPoint[]>(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  // ──────────────────────────────────────
  // 2. 直近 N ヶ月分のスナップショットを取得
  // ──────────────────────────────────────
  const months = getRecentMonths(MONTHS_BACK); // ["2025-03", "2025-04", ...]

  const snapshots = await prisma.languageSnapshot.findMany({
    where: {
      month: { in: months },
      // showLanguages=true のユーザーのみ集計
      user: { showLanguages: true },
    },
    select: {
      language: true,
      bytes: true,
      month: true,
    },
  });

  if (snapshots.length === 0) {
    return NextResponse.json([]);
  }

  // ──────────────────────────────────────
  // 3. 月 × 言語 ごとに bytes を合算
  // ──────────────────────────────────────
  // { "2025-03": { TypeScript: 123456, Python: 78900, ... }, ... }
  const byMonth: Record<string, Record<string, bigint>> = {};

  for (const row of snapshots) {
    if (!byMonth[row.month]) byMonth[row.month] = {};
    const cur = byMonth[row.month][row.language] ?? BigInt(0);
    byMonth[row.month][row.language] = cur + row.bytes;
  }

  // ──────────────────────────────────────
  // 4. 全期間で使用量トップ N の言語を選ぶ
  // ──────────────────────────────────────
  const totalByLang: Record<string, bigint> = {};
  for (const langMap of Object.values(byMonth)) {
    for (const [lang, bytes] of Object.entries(langMap)) {
      totalByLang[lang] = (totalByLang[lang] ?? BigInt(0)) + bytes;
    }
  }
  const topLangs = Object.entries(totalByLang)
    .sort((a, b) => (b[1] > a[1] ? 1 : -1))
    .slice(0, TOP_LANGUAGES)
    .map(([lang]) => lang);

  // ──────────────────────────────────────
  // 5. DataPoint[] に変換（使用率 % に正規化）
  // ──────────────────────────────────────
  const result: DataPoint[] = months
    .filter((m) => byMonth[m]) // スナップショットが存在する月のみ
    .map((m) => {
      const langMap = byMonth[m];
      const total = Object.values(langMap).reduce((sum, b) => sum + b, BigInt(0));

      const point: DataPoint = {
        month: formatMonth(m), // "2026/3"
      };

      for (const lang of topLangs) {
        const bytes = langMap[lang] ?? BigInt(0);
        point[lang] =
          total > BigInt(0) ? Math.round((Number(bytes) / Number(total)) * 1000) / 10 : 0;
      }

      return point;
    });

  // ──────────────────────────────────────
  // 6. キャッシュに保存して返す
  // ──────────────────────────────────────
  await redis.set(CACHE_KEY, result, { ex: CACHE_TTL });
  return NextResponse.json(result);
}

// ──────────────────────────────────────
// ユーティリティ
// ──────────────────────────────────────

/** 直近 n ヶ月の "YYYY-MM" 配列を返す（古い順） */
function getRecentMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months;
}

/** "2026-03" → "2026/3" */
function formatMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return `${y}/${parseInt(m, 10)}`;
}
