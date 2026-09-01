"use client";

import { Check } from "lucide-react";

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span><Check size={20} /></span><h3>{title}</h3><p>{detail}</p></div>;
}
