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
