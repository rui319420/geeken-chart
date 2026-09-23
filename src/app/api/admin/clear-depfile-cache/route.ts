import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin";
import { requireRedis } from "@/lib/redis";

export async function POST() {
  return withAdmin("clear-depfile-cache", async () => {
    const redis = requireRedis();
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
  });
}
