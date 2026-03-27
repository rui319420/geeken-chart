import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

type Period = "24h" | "1w" | "1m" | "1y";

export interface TrendPoint {
  key: string;
  label: string;
  messages: number;
  reactions: number;
  score: number;
}

export interface TrendResponse {
  points: TrendPoint[];
  hottestChannel: string | null;
}

// ─── 定数 ─────────────────────────────────────────────────────────
const JST = 9 * 3_600_000;
const pad = (n: number) => String(n).padStart(2, "0");

const PERIOD_MS: Record<Period, number> = {
  "24h": 86_400_000,
  "1w": 7 * 86_400_000,
  "1m": 30 * 86_400_000,
  "1y": 365 * 86_400_000,
};

const CACHE_TTL: Record<Period, number> = {
  "24h": 300,
  "1w": 900,
  "1m": 1800,
  "1y": 3600,
};

// ─── weekKey + dayOfWeek + hour → UTC ms ──────────────────────────
function rowToUtcMs(weekKey: string, dayOfWeek: number, hour: number): number {
  const [yearStr, wStr] = weekKey.split("-W");
  const year = Number(yearStr);
  const weekNo = Number(wStr);
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Dow = jan1.getUTCDay();
  const approxOffset = weekNo * 7 - jan1Dow - 1;
  const monday = new Date(Date.UTC(year, 0, 1 + approxOffset));
  // 1 - dow で月曜に補正 (Sun→+1, Mon→0, Tue→-1 ... Sat→-5)
  monday.setUTCDate(monday.getUTCDate() + (1 - monday.getUTCDay()));
  // JST Monday 00:00 が基準; UTC = JST - 9h
  return monday.getTime() + dayOfWeek * 86_400_000 + hour * 3_600_000 - JST;
}

// ─── 対象 weekKey 一覧 ─────────────────────────────────────────────
function weekKeysFor(period: Period): string[] {
  const buffer: Record<Period, number> = { "24h": 2, "1w": 9, "1m": 33, "1y": 366 };
  const keys = new Set<string>();
  for (let i = 0; i <= buffer[period]; i++) {
    const jst = new Date(Date.now() - i * 86_400_000 + JST);
    const dow = jst.getUTCDay();
    const mon = new Date(jst.getTime() - ((dow + 6) % 7) * 86_400_000);
    const yr = mon.getUTCFullYear();
    const jan1 = new Date(Date.UTC(yr, 0, 1));
    const wn = Math.ceil(
      ((mon.getTime() - jan1.getTime()) / 86_400_000 + jan1.getUTCDay() + 1) / 7,
    );
    keys.add(`${yr}-W${pad(wn)}`);
  }
  return [...keys];
}

// ─── UTC ms → バケットキー ─────────────────────────────────────────
function toBucketKey(utcMs: number, period: Period): string {
  const d = new Date(utcMs + JST);
  if (period === "24h" || period === "1w") {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${pad(d.getUTCHours())}`;
  }
  if (period === "1m") {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  // 1y: JST 月曜日
  const dow = d.getUTCDay();
  const mon = new Date(utcMs + JST - ((dow + 6) % 7) * 86_400_000);
  return `${mon.getUTCFullYear()}-${pad(mon.getUTCMonth() + 1)}-${pad(mon.getUTCDate())}`;
}

// ─── バケットキー → 表示ラベル ─────────────────────────────────────
function toLabel(key: string, period: Period): string {
  const parts = key.split("-");
  const mm = parseInt(parts[1]);
  const dd = parseInt(parts[2]);
  const hh = parts[3] !== undefined ? parseInt(parts[3]) : 0;
  if (period === "24h") return `${hh}:00`;
  if (period === "1w") return `${mm}/${dd} ${hh}時`;
  return `${mm}/${dd}`;
}

// ─── 全バケットを生成（欠損を 0 埋め）─────────────────────────────
function generateAllBuckets(period: Period, fromMs: number, toMs: number): string[] {
  const buckets: string[] = [];
  if (period === "24h" || period === "1w") {
    const step = 3_600_000;
    const start = Math.floor((fromMs + JST) / step) * step - JST;
    for (let t = start; t <= toMs; t += step) {
      const d = new Date(t + JST);
      buckets.push(
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${pad(d.getUTCHours())}`,
      );
    }
  } else if (period === "1m") {
    const step = 86_400_000;
    const start = Math.floor((fromMs + JST) / step) * step - JST;
    for (let t = start; t <= toMs; t += step) {
      const d = new Date(t + JST);
      buckets.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
    }
  } else {
    // 1y: 週刻み
    const fromJst = fromMs + JST;
    const dow = new Date(fromJst).getUTCDay();
    const monJst = fromJst - ((dow + 6) % 7) * 86_400_000;
    const monMidnight = Math.floor(monJst / 86_400_000) * 86_400_000;
    for (let t = monMidnight; t <= toMs + JST; t += 7 * 86_400_000) {
      const d = new Date(t);
      buckets.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
    }
  }
  return buckets;
}

// ─── Handler ──────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") ?? "1w") as Period;

  if (!PERIOD_MS[period]) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const cacheKey = `discord:trend:${period}:v5`;

  try {
    const cached = await redis.get<TrendResponse>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const weekKeys = weekKeysFor(period);
    let hasChannelData = true;

    const nowMs = Date.now();
    const fromMs = nowMs - PERIOD_MS[period];

    const map = new Map<string, { msg: number; rxn: number }>();
    const channelScoreMap = new Map<string, number>();
    try {
      const rows = await prisma.rawDiscordActivity.groupBy({
        by: ["weekKey", "dayOfWeek", "hour", "channelId", "channelName"],
        where: { weekKey: { in: weekKeys } },
        _sum: {
          messageCount: true,
          reactionCount: true,
        },
      });

      for (const row of rows) {
        const t = rowToUtcMs(row.weekKey, row.dayOfWeek, row.hour);
        if (t < fromMs || t > nowMs) continue;
        const k = toBucketKey(t, period);
        const s = map.get(k) ?? { msg: 0, rxn: 0 };
        const msg = row._sum.messageCount ?? 0;
        const rxn = row._sum.reactionCount ?? 0;
        s.msg += msg;
        s.rxn += rxn;
        map.set(k, s);

        // presence polling 用の疑似チャネルは除外
        if (row.channelId !== "__presence__") {
          const current = channelScoreMap.get(row.channelName) ?? 0;
          channelScoreMap.set(row.channelName, current + msg * 2 + rxn * 1);
        }
      }
    } catch {
      // マイグレーション前は channel 列が無いため、旧集計にフォールバック
      hasChannelData = false;
      const rows = await prisma.rawDiscordActivity.groupBy({
        by: ["weekKey", "dayOfWeek", "hour"],
        where: { weekKey: { in: weekKeys } },
        _sum: {
          messageCount: true,
          reactionCount: true,
        },
      });

      for (const row of rows) {
        const t = rowToUtcMs(row.weekKey, row.dayOfWeek, row.hour);
        if (t < fromMs || t > nowMs) continue;
        const k = toBucketKey(t, period);
        const s = map.get(k) ?? { msg: 0, rxn: 0 };
        s.msg += row._sum.messageCount ?? 0;
        s.rxn += row._sum.reactionCount ?? 0;
        map.set(k, s);
      }
    }

    const points: TrendPoint[] = generateAllBuckets(period, fromMs, nowMs).map((k) => {
      const s = map.get(k) ?? { msg: 0, rxn: 0 };
      return {
        key: k,
        label: toLabel(k, period),
        messages: s.msg,
        reactions: s.rxn,
        score: Math.round(s.msg * 2 + s.rxn * 1),
      };
    });

    const hottestChannel = hasChannelData
      ? ([...channelScoreMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null)
      : null;

    const result: TrendResponse = { points, hottestChannel };

    await redis.set(cacheKey, result, { ex: CACHE_TTL[period] });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Discord trend fetch failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
