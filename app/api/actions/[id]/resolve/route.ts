import { resolveAction } from "../../../../../db/mutations";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const actionId = Number(id);
  if (!Number.isInteger(actionId)) {
    return Response.json({ error: "invalid action id" }, { status: 400 });
  }

  try {
    const resolved = await resolveAction(actionId);
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
