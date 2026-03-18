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
  nickname?: string;
  excludedLanguages?: string[];
}

const userSettingsSelect = {
  includePrivate: true,
  showCommits: true,
  showLanguages: true,
  joinRanking: true,
  isAnonymous: true,
  nickname: true,
  excludedLanguages: true,
};

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const data: Partial<SettingsBody> = {};

  // ニックネームの処理
  if (typeof body.nickname === "string") {
    const trimmedNickname = body.nickname.trim();
    if (trimmedNickname.length > 20) {
      return NextResponse.json(
        { error: "ニックネームは20文字以内で入力してください" },
        { status: 400 },
      );
    }
    data.nickname = trimmedNickname;
  }

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

  if ("includePrivate" in data || "showLanguages" in data || "excludedLanguages" in data) {
    await redis.del("languages:all:aggregated:total");
    await redis.del("languages:all:aggregated:average");
    await redis.del("languages:all:aggregated:total:v2");
    await redis.del("languages:all:aggregated:average:v2");

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { githubName: true },
    });
    // includePrivateやshowLanguagesが変わった時は個人の言語データもリセットする
    if (user && ("includePrivate" in data || "showLanguages" in data)) {
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
