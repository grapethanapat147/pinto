/**
 * Display formatting for values the database stores as numbers.
 *
 * The store keeps money as integer satang and times as ISO-8601 UTC. The worker runs in
 * UTC, so every date format here pins Asia/Bangkok explicitly — the seed wrote 10:36
 * local as 03:36Z, and naive formatting would render it seven hours out.
 */
const BANGKOK = "Asia/Bangkok";

/** 189000 -> "฿1,890". Whole baht, matching the fixtures. */
export function formatBaht(satang: number): string {
  return `฿${Math.round(satang / 100).toLocaleString("en-US")}`;
}

/** ISO -> "10:36" */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** ISO -> "26 ส.ค." */
export function formatThaiDay(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: BANGKOK,
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/** The calendar date in Bangkok, for same-day comparisons that must not use UTC. */
export function bangkokDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** ISO -> "อัปเดต 10:38 น." */
export function formatUpdatedAt(iso: string): string {
  return `อัปเดต ${formatTime(iso)} น.`;
}

/**
 * Message stamps show a clock time on the day itself and "เมื่อวาน" the day before,
 * reproducing the fixtures' mixed display while staying correct as the demo ages.
 */
export function formatMessageStamp(iso: string, now: Date = new Date()): string {
  const day = bangkokDay(iso);
  if (day === bangkokDay(now.toISOString())) return formatTime(iso);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === bangkokDay(yesterday.toISOString())) return "เมื่อวาน";
  return formatThaiDay(iso);
}

/** Derived, never stored: 2018000/642000 -> "3.14". */
export function formatRoas(spendSatang: number, revenueSatang: number): string {
  return (revenueSatang / spendSatang).toFixed(2);
}

/** 12684000 satang -> "฿126.8k", for the waterfall's abbreviated labels. */
export function formatCompactBaht(satang: number): string {
  return `฿${(satang / 100_000).toFixed(1)}k`;
}

/** "12.4" -> "12.4%", trimming a trailing ".0" the way the fixtures wrote it. */
export function formatPercent(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}

/**
 * Percentage change, signed by its arrow rather than a minus: 1100 vs 1000 -> "10%", up.
 *
 * A zero or negative baseline has no meaningful percentage — a loss turning into a profit is
 * not "+250%" — so it reads "—" with no direction rather than a number that misleads.
 */
export function formatChange(current: number, previous: number): { text: string; trend: "up" | "down" | "flat" } {
  if (previous <= 0) return { text: "—", trend: "flat" };
  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 0.05) return { text: "0%", trend: "flat" };
  return { text: formatPercent(Math.abs(percent)), trend: percent > 0 ? "up" : "down" };
}

/** The arrow that goes with a trend. */
export function trendArrow(trend: "up" | "down" | "flat"): string {
  return trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
}
