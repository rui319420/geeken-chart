import { NextResponse } from "next/server";
import { auth } from "@/auth";
import redis from "@/lib/redis";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let cursor: string = "0";
  let deleted = 0;

  do {
    const result = await redis.scan(cursor, { match: "depfile:*", count: 100 });
    cursor = result[0];
    const keys = result[1];
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== "0");

  return NextResponse.json({ deleted });
}
