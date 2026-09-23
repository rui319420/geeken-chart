import { auth } from "@/auth";
import { pool } from "@/lib/prisma";
import { issueLinkCode, LinkError } from "../../../../../bot/discord-link";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  // A browser POST must originate from this site; never accept a user ID in the body.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    return Response.json(await issueLinkCode(pool, session.user.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status = error instanceof LinkError ? error.status : 503;
    return Response.json(
      {
        error:
          error instanceof LinkError
            ? error.message
            : "コードを発行できません。後ほどお試しください。",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
