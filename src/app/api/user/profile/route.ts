import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateUserProfile } from "@/services/profileService";
import { z } from "zod";
import { PLATFORMS } from "@/lib/constants";

const profileSchema = z.object({
  nickname: z.string().max(20, "ニックネームは20文字以内にしてください").nullable().optional(),
  links: z
    .array(
      z.object({
        platform: z.enum(PLATFORMS, {
          message: "無効なプラットフォームです",
        }),
        url: z
          .string()
          .url("正しいURL形式で入力してください")
          .startsWith("https://", "URLはhttps://から始める必要があります"),
      }),
    )
    .max(10, "リンクは最大10個までです"),
});

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (body.nickname === "") {
      body.nickname = null;
    }

    const validatedData = profileSchema.parse(body);

    const updatedUser = await updateUserProfile(session.user.id, validatedData);

    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
