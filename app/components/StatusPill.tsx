"use client";

export function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

/** Marks a figure with no data behind it yet (PIN-0030) — it is an illustration, not a fact. */
export function ExampleTag() {
  return <StatusPill tone="demo">ตัวอย่าง</StatusPill>;
}
