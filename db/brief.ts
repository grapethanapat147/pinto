/**
 * The daily brief: the Action Center as rules over the shop's data (PIN-0031).
 *
 * Until this ticket the Action Center was four rows typed into a fixture — two of them about
 * data Pinto does not have (cancellation patterns, carrier weights) — with a "92%" confidence
 * nothing computed. Now every card is a rule applied to rows that exist, and says three things:
 * why it appeared, what happens if it is skipped, and where to go to deal with it.
 *
 * Rules, in display order within each urgency (spec `.codex/specs/daily-brief.md`, Q2):
 * stock running out · orders waiting past the pack window · orders under review · unread
 * chats · ad spend unusually high for its sales (owner) · products without a cost (owner).
 *
 * Amounts appear only where they are facts (Q5): the value of the orders involved, a
 * product's sales per day, yesterday's spend. Nothing here forecasts a loss.
 */
import { and, asc, eq, gt, gte, isNull, lt, lte, sql } from "drizzle-orm";

import { getDb } from "./index";
import { actionSnoozes, adSpendDaily, channels, conversations, inventoryLevels, orders, products, shops } from "./schema";
import { bangkokDate, bangkokDayStart, loadAnchor, salesVelocity, VELOCITY_DAYS } from "./performance";
import { formatBaht, formatThaiDay, formatTime } from "../app/format";
import type { SessionUser } from "./auth";
import type { ShopAction } from "../app/types";

const DAY_MS = 24 * 60 * 60_000;
const HOUR_MS = 60 * 60_000;

/** Under this many days of stock, a product gets a card; under the second, it is urgent. */
export const STOCK_WARN_DAYS = 7;
export const STOCK_URGENT_DAYS = 3;
/** Order stock to cover this many days of sales. */
const RESTOCK_COVER_DAYS = 14;
/** Yesterday's ad spend ÷ sales above this multiple of the prior week's ratio is unusual. */
export const AD_RATIO_ALERT = 1.25;

/** Every rule a card key can start with, and whether staff may see it (PIN-0013's line). */
export const RULES = {
  stock: { ownerOnly: false },
  pack: { ownerOnly: false },
  review: { ownerOnly: false },
  chat: { ownerOnly: false },
  ads: { ownerOnly: true },
  cost: { ownerOnly: true },
  // not a card: the new-seller checklist's "ปิด" (PIN-0032), stored the same way
  checklist: { ownerOnly: true },
} as const;
export type Rule = keyof typeof RULES;

/** `rule:subject`, as stored in `action_snoozes`. Null for anything else. */
export function parseCardKey(key: unknown): { rule: Rule; key: string } | null {
  if (typeof key !== "string" || key.length > 80) return null;
  const match = key.match(/^([a-z]+):[A-Za-z0-9_-]+$/);
  if (!match || !(match[1] in RULES)) return null;
  return { rule: match[1] as Rule, key };
}

/** Days of stock left at the current sales rate, or null when it has not sold. */
export function daysLeftOf(onHand: number, unitsPerDay: number | undefined): number | null {
  if (!unitsPerDay) return null;
  return onHand / unitsPerDay;
}

/** The new-seller checklist's dismissal (PIN-0032): a snooze that never ends. */
export const CHECKLIST_KEY = "checklist:onboarding";
export const FOREVER = "9999-12-31T00:00:00.000Z";

export async function checklistDismissed(session: SessionUser): Promise<boolean> {
  const [row] = await getDb()
    .select({ key: actionSnoozes.cardKey })
    .from(actionSnoozes)
    .where(and(eq(actionSnoozes.shopId, session.shopId), eq(actionSnoozes.cardKey, CHECKLIST_KEY)));
  return Boolean(row);
}

/** Units to order so the stock covers `RESTOCK_COVER_DAYS` at the current rate — the brief and Stock's list agree. */
export function restockQuantity(onHand: number, unitsPerDay: number): number {
  return Math.max(1, Math.ceil(unitsPerDay * RESTOCK_COVER_DAYS - Math.max(onHand, 0)));
}

/** Next Bangkok midnight after `now` — when "ซ่อนถึงพรุ่งนี้" ends. */
export function nextBangkokMidnight(now: number): string {
  return new Date(bangkokDayStart(now) + DAY_MS).toISOString();
}

const oneDecimal = (value: number) => Number(value.toFixed(1)).toLocaleString("en-US");

export async function listBrief(session: SessionUser, now: number = Date.now()): Promise<ShopAction[]> {
  const db = getDb();
  const isOwner = session.role === "owner";
  const { anchor } = await loadAnchor(session);
  const anchorIso = new Date(anchor).toISOString();
  const asOf = `ข้อมูลถึง ${formatThaiDay(anchorIso)} ${formatTime(anchorIso)} น.`;

  const [shop] = await db
    .select({ packWindowHours: shops.packWindowHours })
    .from(shops)
    .where(eq(shops.id, session.shopId));
  const packWindowHours = shop?.packWindowHours ?? 24;
  const packCutoff = new Date(anchor - packWindowHours * HOUR_MS).toISOString();

  const [velocity, stock, late, review, unread, snoozed] = await Promise.all([
    salesVelocity(session, anchor),
    db
      .select({ productId: products.id, sku: products.sku, name: products.name, onHand: inventoryLevels.onHand })
      .from(inventoryLevels)
      .innerJoin(products, eq(products.id, inventoryLevels.productId))
      .where(eq(inventoryLevels.shopId, session.shopId))
      .orderBy(asc(inventoryLevels.id)),
    db
      .select({
        n: sql<number>`count(*)`.as("n"),
        value: sql<number>`coalesce(sum(${orders.totalSatang}), 0)`.as("value"),
        oldest: sql<string | null>`min(${orders.placedAt})`.as("oldest"),
      })
      .from(orders)
      .where(and(eq(orders.shopId, session.shopId), eq(orders.status, "รอแพ็ก"), lte(orders.placedAt, packCutoff))),
    db
      .select({
        n: sql<number>`count(*)`.as("n"),
        value: sql<number>`coalesce(sum(${orders.totalSatang}), 0)`.as("value"),
      })
      .from(orders)
      .where(and(eq(orders.shopId, session.shopId), eq(orders.status, "ตรวจสอบ"), lte(orders.placedAt, anchorIso))),
    db
      .select({
        messages: sql<number>`coalesce(sum(${conversations.unreadCount}), 0)`.as("messages"),
        chats: sql<number>`count(*)`.as("chats"),
      })
      .from(conversations)
      .where(and(eq(conversations.shopId, session.shopId), gt(conversations.unreadCount, 0))),
    db
      .select({ key: actionSnoozes.cardKey })
      .from(actionSnoozes)
      .where(and(eq(actionSnoozes.shopId, session.shopId), gt(actionSnoozes.until, new Date(now).toISOString()))),
  ]);

  const cards: ShopAction[] = [];

  // --- stock running out ---------------------------------------------------------------
  for (const row of stock) {
    const rate = velocity.get(row.productId);
    const daysLeft = daysLeftOf(row.onHand, rate?.unitsPerDay);
    const out = row.onHand <= 0;
    if (!out && (daysLeft === null || daysLeft >= STOCK_WARN_DAYS)) continue;

    const perDay = rate ? `ขายเฉลี่ย ${oneDecimal(rate.unitsPerDay)} ชิ้น/วัน (${VELOCITY_DAYS} วันล่าสุด)` : `ไม่มียอดขายใน ${VELOCITY_DAYS} วันล่าสุด`;
    const need = rate ? restockQuantity(row.onHand, rate.unitsPerDay) : null;
    const urgent = out || (daysLeft !== null && daysLeft < STOCK_URGENT_DAYS);
    cards.push({
      key: `stock:${row.sku}`,
      tone: urgent ? "danger" : "warning",
      urgent,
      label: "สต๊อก",
      title: out ? `${row.name} หมดสต๊อก` : `${row.name} จะหมดในราว ${oneDecimal(daysLeft!)} วัน`,
      detail: `เหลือ ${Math.max(row.onHand, 0).toLocaleString("en-US")} ชิ้น · ${perDay}`,
      consequence: out
        ? "ตอนนี้ขายสินค้านี้ไม่ได้ทุกช่องทาง จนกว่าจะเติมสต๊อก"
        : "ถ้าไม่เติม จะขายสินค้านี้ไม่ได้ทุกช่องทางเมื่อของหมด",
      recommendation: need
        ? `สั่งเพิ่มอย่างน้อย ${need.toLocaleString("en-US")} ชิ้น ให้พอขายอีก ${RESTOCK_COVER_DAYS} วันตามยอดขายตอนนี้`
        : "ตรวจว่ายังจะขายสินค้านี้ต่อหรือไม่ ก่อนสั่งเพิ่ม",
      amount: rate ? `ยอดขาย ${formatBaht(rate.revenuePerDaySatang)}/วัน` : null,
      channel: "ทุกช่องทาง",
      basis: `สต๊อกคงเหลือ และยอดขาย ${VELOCITY_DAYS} วันล่าสุด · ${asOf}`,
      cta: { label: "ดูสต๊อก", view: "stock" },
    });
  }

  // --- orders waiting past the pack window ----------------------------------------------
  const [lateRow] = late;
  if (lateRow && Number(lateRow.n) > 0) {
    const oldest = lateRow.oldest!;
    cards.push({
      key: "pack:late",
      tone: "danger",
      urgent: true,
      label: "ออเดอร์",
      title: `${Number(lateRow.n).toLocaleString("en-US")} ออเดอร์รอแพ็กเกิน ${packWindowHours} ชม.`,
      detail: `ออเดอร์ที่เก่าที่สุดสั่งเมื่อ ${formatThaiDay(oldest)} ${formatTime(oldest)} น.`,
      consequence: "ลูกค้ารอนานขึ้น และอาจกระทบคะแนนการจัดส่งของร้านบนแพลตฟอร์ม",
      recommendation: "แพ็กออเดอร์ที่เก่าที่สุดก่อน",
      amount: `มูลค่า ${formatBaht(Number(lateRow.value))}`,
      channel: "ทุกช่องทาง",
      basis: `กฎของร้าน: รอแพ็กเกิน ${packWindowHours} ชม. ตามที่ร้านตั้งไว้ · ${asOf}`,
      cta: { label: "ไปที่ออเดอร์", view: "orders" },
    });
  }

  // --- orders under review --------------------------------------------------------------
  const [reviewRow] = review;
  if (reviewRow && Number(reviewRow.n) > 0) {
    cards.push({
      key: "review:orders",
      tone: "warning",
      urgent: true,
      label: "ออเดอร์",
      title: `${Number(reviewRow.n).toLocaleString("en-US")} ออเดอร์รอตรวจสอบ`,
      detail: "ออเดอร์เหล่านี้ถูกพักไว้ในสถานะ ตรวจสอบ และยังไม่ถูกแพ็ก",
      consequence: "ออเดอร์จะค้างอยู่และไม่ถูกส่ง จนกว่าจะมีคนตรวจ",
      recommendation: "เปิดดูทีละออเดอร์ แล้วยืนยันหรือยกเลิก",
      amount: `มูลค่า ${formatBaht(Number(reviewRow.value))}`,
      channel: "ทุกช่องทาง",
      basis: `ออเดอร์สถานะ ตรวจสอบ · ${asOf}`,
      cta: { label: "ไปที่ออเดอร์", view: "orders" },
    });
  }

  // --- unread chats ----------------------------------------------------------------------
  const [unreadRow] = unread;
  if (unreadRow && Number(unreadRow.messages) > 0) {
    cards.push({
      key: "chat:unread",
      tone: "warning",
      urgent: true,
      label: "แชต",
      title: `${Number(unreadRow.messages).toLocaleString("en-US")} ข้อความรอตอบ`,
      detail: `จาก ${Number(unreadRow.chats).toLocaleString("en-US")} แชตที่ยังไม่ได้อ่าน`,
      consequence: "ลูกค้าอาจไปซื้อร้านอื่น และอัตราการตอบแชตของร้านลดลง",
      recommendation: "ตอบแชตที่เกี่ยวกับออเดอร์ก่อน",
      amount: null,
      channel: "ทุกช่องทาง",
      basis: "แชตที่มีข้อความยังไม่ได้อ่าน",
      cta: { label: "ไปที่ข้อความลูกค้า", view: "inbox" },
    });
  }

  if (isOwner) {
    cards.push(...(await adCards(session, anchor, asOf)));

    // --- products without a cost ---------------------------------------------------------
    const uncosted = await db
      .select({ name: products.name })
      .from(products)
      .where(and(eq(products.shopId, session.shopId), isNull(products.unitCostSatang)))
      .orderBy(asc(products.name));
    if (uncosted.length > 0) {
      cards.push({
        key: "cost:missing",
        tone: "warning",
        urgent: false,
        label: "ต้นทุน",
        title: `สินค้า ${uncosted.length.toLocaleString("en-US")} รายการยังไม่มีต้นทุน`,
        detail: uncosted.map((row) => row.name).join(", "),
        consequence: "กำไรที่แสดงจะสูงกว่าความจริง เพราะยอดขายของสินค้าเหล่านี้ไม่ถูกหักต้นทุน",
        recommendation: "ใส่ต้นทุนต่อชิ้นของสินค้าเหล่านี้",
        amount: null,
        channel: "ทุกช่องทาง",
        basis: "สินค้าที่ยังไม่มีต้นทุนต่อชิ้น",
        cta: { label: "ดูสต๊อก", view: "stock" },
      });
    }
  }

  const hidden = new Set(snoozed.map((row) => row.key));
  // urgent first; within each, the order the rules were written in
  return cards.filter((card) => !hidden.has(card.key)).sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

/**
 * A channel whose ad spend ate an unusually large share of its sales yesterday, compared with
 * the seven days before. "Yesterday" is the last full Bangkok day before the anchor — today
 * is still in progress and its spend and sales do not move together hour by hour.
 */
async function adCards(session: SessionUser, anchor: number, asOf: string): Promise<ShopAction[]> {
  const db = getDb();
  const yesterdayStart = bangkokDayStart(anchor) - DAY_MS;
  const weekStart = yesterdayStart - 7 * DAY_MS;
  const yesterday = bangkokDate(yesterdayStart);

  const [spend, sales, known] = await Promise.all([
    db
      .select({ channelId: adSpendDaily.channelId, day: adSpendDaily.day, spend: adSpendDaily.spendSatang })
      .from(adSpendDaily)
      .where(
        and(
          eq(adSpendDaily.shopId, session.shopId),
          gte(adSpendDaily.day, bangkokDate(weekStart)),
          lte(adSpendDaily.day, yesterday)
        )
      ),
    db
      .select({
        channelId: orders.channelId,
        day: sql<string>`date(${orders.placedAt}, '+7 hours')`.as("day"),
        sales: sql<number>`sum(${orders.totalSatang})`.as("sales"),
      })
      .from(orders)
      .where(
        and(
          eq(orders.shopId, session.shopId),
          gte(orders.placedAt, new Date(weekStart).toISOString()),
          lt(orders.placedAt, new Date(yesterdayStart + DAY_MS).toISOString())
        )
      )
      .groupBy(orders.channelId, sql`date(${orders.placedAt}, '+7 hours')`),
    db.select({ id: channels.id, name: channels.displayName }).from(channels).where(eq(channels.shopId, session.shopId)),
  ]);

  const salesOf = new Map(sales.map((row) => [`${row.channelId}:${row.day}`, Number(row.sales)]));
  const byChannel = new Map<number, { spendY: number; salesY: number; spendW: number; salesW: number }>();
  for (const row of spend) {
    const entry = byChannel.get(row.channelId) ?? { spendY: 0, salesY: 0, spendW: 0, salesW: 0 };
    const daySales = salesOf.get(`${row.channelId}:${row.day}`) ?? 0;
    if (row.day === yesterday) {
      entry.spendY += row.spend;
      entry.salesY += daySales;
    } else {
      entry.spendW += row.spend;
      entry.salesW += daySales;
    }
    byChannel.set(row.channelId, entry);
  }

  const names = new Map(known.map((row) => [row.id, row.name]));
  const cards: ShopAction[] = [];
  for (const [channelId, entry] of byChannel) {
    if (entry.spendY <= 0 || entry.salesY <= 0 || entry.salesW <= 0) continue;
    const ratioY = entry.spendY / entry.salesY;
    const ratioW = entry.spendW / entry.salesW;
    if (ratioY <= ratioW * AD_RATIO_ALERT) continue;
    const name = names.get(channelId) ?? "ช่องทางนี้";
    cards.push({
      key: `ads:${channelId}`,
      tone: "warning",
      urgent: false,
      label: "โฆษณา",
      title: `ค่าโฆษณา ${name} สูงกว่าปกติ`,
      detail: `เมื่อวานค่าโฆษณาเท่ากับ ${oneDecimal(ratioY * 100)}% ของยอดขาย จากปกติ ${oneDecimal(ratioW * 100)}% (7 วันก่อนหน้า)`,
      consequence: "กำไรต่อออเดอร์ของช่องทางนี้ลดลง",
      recommendation: "ตรวจแคมเปญที่ใช้งบมากที่สุดของช่องทางนี้",
      amount: `ค่าโฆษณาเมื่อวาน ${formatBaht(entry.spendY)}`,
      channel: name,
      basis: `ค่าโฆษณาและยอดขายรายวันของช่องทาง · ${asOf}`,
      cta: { label: "ดูการเติบโต", view: "growth" },
    });
  }
  return cards;
}
