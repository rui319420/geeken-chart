import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { clearUserAggregatedData } from "@/services/userService";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await clearUserAggregatedData(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to clear user aggregated data:", error);
    return NextResponse.json({ error: "Failed to clear user data" }, { status: 500 });
  }
}
