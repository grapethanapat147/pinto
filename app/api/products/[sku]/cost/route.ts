import { setProductCost } from "../../../../../db/mutations";
import { getSession } from "../../../../session";

/** ฿1,000,000 per unit: anything above is a typo, not a product this shop sells. */
const MAX_COST_SATANG = 100_000_000;

/**
 * Baht as typed — "250", "250.5", 250 — to integer satang, or a reason it is not a cost.
 * A string must be plain digits with at most two decimals, so "1e3", "0x10" and "250,00"
 * are refused rather than read as something the owner did not type.
 */
function parseCost(value: unknown): { satang: number } | { error: string } {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : null;
  if (text === null || !/^\d+(\.\d{1,2})?$/.test(text)) {
    return { error: "ใส่ต้นทุนเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง" };
  }
  const satang = Math.round(Number(text) * 100);
  if (satang <= 0) return { error: "ต้นทุนต้องมากกว่า 0 บาท" };
  if (satang > MAX_COST_SATANG) return { error: "ต้นทุนต่อชิ้นต้องไม่เกิน ฿1,000,000" };
  return { satang };
}

/** Sets a product's cost per unit (PIN-0028). Owner only, enforced here rather than by hiding a field. */
export async function POST(request: Request, context: { params: Promise<{ sku: string }> }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "authentication required" }, { status: 401 });
  }
  if (session.role !== "owner") {
    return Response.json({ error: "เฉพาะเจ้าของร้านแก้ต้นทุนได้" }, { status: 403 });
  }

  const { sku } = await context.params;
  if (!/^[A-Za-z0-9-]{1,40}$/.test(sku)) {
    return Response.json({ error: "invalid sku" }, { status: 400 });
  }

  let body: { cost?: unknown; fillPast?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "expected a JSON body" }, { status: 400 });
  }
  const cost = parseCost(body?.cost);
  if ("error" in cost) {
    return Response.json({ error: cost.error }, { status: 400 });
  }
  if (body?.fillPast !== undefined && typeof body.fillPast !== "boolean") {
    return Response.json({ error: "fillPast must be true or false" }, { status: 400 });
  }

  try {
    const result = await setProductCost(session, sku, cost.satang, body?.fillPast === true);
    if (result.status === "not_found") {
      return Response.json({ error: "ไม่พบสินค้านี้ในร้าน" }, { status: 404 });
    }
    if (result.status === "already_costed") {
      return Response.json(
        { error: "เติมต้นทุนให้ออเดอร์เก่าได้ครั้งเดียว ตอนใส่ต้นทุนครั้งแรก" },
        { status: 409 }
      );
    }
    return Response.json({ saved: true, unitCostSatang: cost.satang, filled: result.filled });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "unexpected error" },
      { status: 500 }
    );
  }
}
