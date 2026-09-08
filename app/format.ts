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
function bangkokDay(iso: string): string {
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
