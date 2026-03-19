// src/app/api/survey/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

const CACHE_TTL = 60 * 5; // 5分
const VALID_CATEGORIES = ["language", "os", "tool", "aimodel"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

// ──────────────────────────────────────
// GET  /api/survey
// カテゴリ別集計 + ログイン中ユーザーの回答を返す
// ──────────────────────────────────────
export async function GET() {
  const session = await auth();

  const cacheKey = "survey:aggregated";
  const cached = await redis.get(cacheKey);

  let aggregated: Record<Category, { answer: string; count: number }[]>;

  if (cached) {
    aggregated = cached as typeof aggregated;
  } else {
    const rows = await prisma.surveyResponse.groupBy({
      by: ["category", "answer"],
      _count: { userId: true },
      orderBy: { _count: { userId: "desc" } },
    });

    aggregated = { language: [], os: [], tool: [], aimodel: [] };
    for (const row of rows) {
      const cat = row.category as Category;
      if (!VALID_CATEGORIES.includes(cat)) continue;
      aggregated[cat].push({ answer: row.answer, count: row._count.userId });
    }

    await redis.set(cacheKey, aggregated, { ex: CACHE_TTL });
  }

  // ログイン中ユーザーの回答
  let myAnswers: Record<string, string> = {};
  if (session?.user?.id) {
    const mine = await prisma.surveyResponse.findMany({
      where: { userId: session.user.id },
      select: { category: true, answer: true },
    });
    myAnswers = Object.fromEntries(mine.map((r) => [r.category, r.answer]));
  }

  return NextResponse.json({ aggregated, myAnswers });
}

// ──────────────────────────────────────
// POST /api/survey
// body: { category: string, answer: string }
// ──────────────────────────────────────
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { category, answer } = body as { category: string; answer: string };

  if (!VALID_CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (typeof answer !== "string" || answer.trim().length === 0 || answer.length > 50) {
    return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  }

  await prisma.surveyResponse.upsert({
    where: { userId_category: { userId: session.user.id, category } },
    update: { answer: answer.trim(), updatedAt: new Date() },
    create: { userId: session.user.id, category, answer: answer.trim() },
  });

  await redis.del("survey:aggregated");
  return NextResponse.json({ ok: true });
}

// ──────────────────────────────────────
// DELETE /api/survey?category=aimodel
// ──────────────────────────────────────
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  if (!category || !VALID_CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  await prisma.surveyResponse.deleteMany({
    where: { userId: session.user.id, category },
  });

  await redis.del("survey:aggregated");
  return NextResponse.json({ ok: true });
}
