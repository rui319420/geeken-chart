import { auth } from "@/auth";

export async function withAdmin(
  action: "clear-depfile-cache" | "refresh",
  operation: () => Promise<Response>,
): Promise<Response> {
  let actor: string | null = null;
  let status = 500;
  try {
    const session = await auth();
    actor = session?.user?.id ?? null;
    const administrators = (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (!actor) {
      status = 401;
      return Response.json({ error: "Unauthorized" }, { status });
    }
    if (!administrators.includes(actor)) {
      status = 403;
      return Response.json({ error: "Forbidden" }, { status });
    }
    const response = await operation();
    status = response.status;
    return response;
  } catch {
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    // Do not log request bodies, tokens or raw provider/DB errors.
    console.info("[admin]", { actor, action, status, success: status < 400 });
  }
}
