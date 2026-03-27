import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { languageId, isHiddenProfile } = body;

    if (!languageId || typeof isHiddenProfile !== "boolean") {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    const updated = await prisma.userLanguage.updateMany({
      where: {
        id: languageId,
        userId: session.user.id,
      },
      data: {
        isHiddenProfile: isHiddenProfile,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Language not found or permission denied" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update language visibility:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
