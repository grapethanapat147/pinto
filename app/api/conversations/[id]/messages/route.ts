import { addShopMessage } from "../../../../../db/mutations";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const conversationId = Number(id);
  if (!Number.isInteger(conversationId)) {
    return Response.json({ error: "invalid conversation id" }, { status: 400 });
  }

  try {
    const payload = (await request.json()) as { body?: string };
    const body = payload.body?.trim() ?? "";
    if (!body) {
      return Response.json({ error: "body is required" }, { status: 400 });
    }

    const added = await addShopMessage(conversationId, body);
    if (!added) {
      return Response.json({ error: "conversation not found" }, { status: 404 });
    }
    return Response.json({ sent: true }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "unexpected error" },
      { status: 500 }
    );
  }
}
