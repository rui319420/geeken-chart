import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

interface SettingsBody {
  includePrivate?: boolean;
  showCommits?: boolean;
  showLanguages?: boolean;
  joinRanking?: boolean;
  isAnonymous?: boolean;
  excludedLanguages?: string[];
}

const userSettingsSelect = {
  includePrivate: true,
  showCommits: true,
  showLanguages: true,
  joinRanking: true,
  isAnonymous: true,
  excludedLanguages: true,
};

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const data: Partial<SettingsBody> = {};

  if (Array.isArray(body.excludedLanguages)) {
    const isValidArray = body.excludedLanguages.every((item: unknown) => typeof item === "string");
    if (isValidArray) {
      data.excludedLanguages = body.excludedLanguages as string[];
    }
  }

  // booleanのフィールドだけを配列にまとめる
  const booleanFields: (keyof Omit<SettingsBody, "nickname" | "excludedLanguages">)[] = [
    "includePrivate",
    "showCommits",
    "showLanguages",
    "joinRanking",
    "isAnonymous",
  ];

  for (const key of booleanFields) {
    if (typeof body[key] === "boolean") {
      data[key] = body[key];
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: userSettingsSelect,
  });

  // プライベートや言語公開設定が変わった時のみ、個人の言語データをリセットする
  if ("includePrivate" in data || "showLanguages" in data) {
    await redis.del("languages:all:aggregated:total:v7");
    await redis.del("languages:all:aggregated:average:v7");

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { githubName: true },
    });
    if (user) {
      await prisma.userLanguage.deleteMany({ where: { userId: session.user.id } });
    }
  }

  if ("includePrivate" in data || "showLanguages" in data || "showCommits" in data) {
    await redis.del("stats:dashboard");
  }

  return NextResponse.json(updated);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: userSettingsSelect,
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(user);
}
