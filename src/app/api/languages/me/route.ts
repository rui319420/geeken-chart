import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();

    // ログインしていない場合は弾く（idもチェック）
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const myLanguages = await prisma.userLanguage.findMany({
      where: { userId: session.user.id },
    });

    // 全バイト数を計算
    const totalBytes = myLanguages.reduce((sum, lang) => sum + lang.bytes, 0);

    // 画面表示用（LangData型）にフォーマットし、多い順に並べる
    const result = myLanguages
      .map((lang) => ({
        name: lang.language,
        bytes: lang.bytes,
        percentage: totalBytes > 0 ? Math.round((lang.bytes / totalBytes) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.bytes - a.bytes);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch my languages:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
