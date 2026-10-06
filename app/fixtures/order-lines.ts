/**
 * What each seeded order contained, and what each product costs (PIN-0026).
 *
 * The lines were **solved for, not invented**: prices were searched within believable bands
 * for these home goods until every order's lines sum exactly to the `total` already in
 * `orders.ts`. Making up lines beside the existing totals would have produced two stories
 * about the same order, and the cost-and-profit spec's Q2 asks for them to agree.
 *
 * `ML-LN-012` (the linen tablecloth) is **deliberately uncosted**. It appears in four of the
 * six orders, so the demo has real partial coverage rather than a hypothetical one — which is
 * the state a merchant is actually in on their first day.
 */

/** Baht. `null` means not costed yet — distinct from zero, and must stay distinct.
 *  Costs sit near 55% of price: at 35–40% the demo showed a 54% net margin, which no
 *  marketplace home-goods reseller has (PIN-0027). */
export const productCosts: Record<string, { price: number; cost: number | null }> = {
  "ML-CV-018": { price: 450, cost: 250 }, // แจกันเซรามิกสีครีม
  "ML-CL-006": { price: 1100, cost: 600 }, // โคมไฟ Cloud
  "ML-AG-024": { price: 640, cost: 350 }, // ชุดแก้ว Amber 4 ใบ
  "ML-LN-012": { price: 440, cost: null }, // ผ้าปูโต๊ะ Linen Sand — uncosted on purpose
  "ML-TR-031": { price: 340, cost: 185 }, // ถาดไม้โค้ง Natural
};

/** Keyed by the order's external id, as in `orders.ts`. Quantities only; prices come from above. */
export const orderLines: Record<string, { sku: string; quantity: number }[]> = {
  "TT-10842": [
    { sku: "ML-CV-018", quantity: 1 },
    { sku: "ML-CL-006", quantity: 1 },
    { sku: "ML-TR-031", quantity: 1 },
  ],
  "SP-48219": [
    { sku: "ML-LN-012", quantity: 1 },
    { sku: "ML-TR-031", quantity: 1 },
  ],
  "TT-10841": [
    { sku: "ML-CV-018", quantity: 1 },
    { sku: "ML-LN-012", quantity: 3 },
    { sku: "ML-TR-031", quantity: 2 },
  ],
  "LN-39204": [
    { sku: "ML-LN-012", quantity: 1 },
    { sku: "ML-TR-031", quantity: 2 },
  ],
  "SP-48218": [{ sku: "ML-AG-024", quantity: 1 }],
  "TT-10840": [
    { sku: "ML-CL-006", quantity: 1 },
    { sku: "ML-AG-024", quantity: 2 },
    { sku: "ML-LN-012", quantity: 2 },
  ],
};
