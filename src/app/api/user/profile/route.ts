import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateUserProfile } from "@/services/profileService";

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    await updateUserProfile(session.user.id, body);

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
