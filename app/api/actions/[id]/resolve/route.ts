import { resolveAction } from "../../../../../db/mutations";
import { getSession } from "../../../../session";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  // PIN-0011 gated the page but not this route: before PIN-0012 an anonymous POST here
  // resolved a real action. The session is the authority on *which shop* is being written
  // to, so it has to be resolved before anything else happens.
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "authentication required" }, { status: 401 });
  }

  const { id } = await context.params;
  const actionId = Number(id);
  if (!Number.isInteger(actionId)) {
    return Response.json({ error: "invalid action id" }, { status: 400 });
  }

  try {
    const resolved = await resolveAction(session, actionId);
    if (!resolved) {
      return Response.json({ error: "action not found or already resolved" }, { status: 404 });
    }
    return Response.json({ resolved: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "unexpected error" },
      { status: 500 }
    );
  }
}
