import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

const CACHE_KEY_WEEKLY = "discord:trend:weekly";
const CACHE_KEY_DAILY = "discord:trend:daily";
const TTL_WEEKLY = 60 * 30; // 30分
const TTL_DAILY = 60 * 15; // 15分（直近データなので短め）

// "2026-W11" + dayOfWeek(0=月...6=日) → "2026-03-09" (ISO date string)
function weekDayToDateStr(weekKey: string, dayOfWeek: number): string | null {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);

  // Jan 4 は常に ISO week 1 に含まれる
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // 日曜=0 → 7 に変換
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);

  // dayOfWeek: 0=月, 1=火, ..., 6=日
  const target = new Date(monday);
  target.setUTCDate(monday.getUTCDate() + dayOfWeek);

  return target.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export async function GET() {
  try {
    // ── 週次データ ──────────────────────────────────────
    const cachedWeekly = await redis.get(CACHE_KEY_WEEKLY);
    let weekly: { weekKey: string; messageCount: number; presenceCount: number }[];

    if (cachedWeekly) {
      weekly = cachedWeekly as typeof weekly;
    } else {
      const rows = await prisma.rawDiscordActivity.groupBy({
        by: ["weekKey"],
        where: { weekKey: { not: "" } },
        _sum: { messageCount: true, presenceCount: true },
        orderBy: { weekKey: "asc" },
      });

      weekly = rows.map((r) => ({
        weekKey: r.weekKey,
        messageCount: r._sum.messageCount ?? 0,
        presenceCount: r._sum.presenceCount ?? 0,
      }));

      await redis.set(CACHE_KEY_WEEKLY, weekly, { ex: TTL_WEEKLY });
    }

    // ── 日次データ（直近 14 日分のみ取得） ──────────────
    const cachedDaily = await redis.get(CACHE_KEY_DAILY);
    let daily: { date: string; messageCount: number; presenceCount: number }[];

    if (cachedDaily) {
      daily = cachedDaily as typeof daily;
    } else {
      // 直近 14 日が属する週キーを算出してフィルタ
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const recentWeekKeys = weekly
        .filter((w) => {
          const match = w.weekKey.match(/^(\d{4})-W(\d{2})$/);
          if (!match) return false;
          const year = parseInt(match[1]);
          const week = parseInt(match[2]);
          const jan4 = new Date(Date.UTC(year, 0, 4));
          const jan4Day = jan4.getUTCDay() || 7;
          const monday = new Date(jan4);
          monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
          return monday >= twoWeeksAgo;
        })
        .map((w) => w.weekKey);

      if (recentWeekKeys.length === 0) {
        daily = [];
      } else {
        const dailyRows = await prisma.rawDiscordActivity.groupBy({
          by: ["weekKey", "dayOfWeek"],
          where: { weekKey: { in: recentWeekKeys } },
          _sum: { messageCount: true, presenceCount: true },
          orderBy: [{ weekKey: "asc" }, { dayOfWeek: "asc" }],
        });

        const today = new Date().toISOString().slice(0, 10);

        daily = dailyRows
          .map((r) => {
            const date = weekDayToDateStr(r.weekKey, r.dayOfWeek);
            if (!date) return null;
            return {
              date,
              messageCount: r._sum.messageCount ?? 0,
              presenceCount: r._sum.presenceCount ?? 0,
            };
          })
          .filter((d): d is NonNullable<typeof d> => d !== null && d.date <= today)
          .sort((a, b) => a.date.localeCompare(b.date));
      }

      await redis.set(CACHE_KEY_DAILY, daily, { ex: TTL_DAILY });
    }

    return NextResponse.json({ weekly, daily });
  } catch (error) {
    console.error("Discord trend fetch failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
