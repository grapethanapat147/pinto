"use client";

import { AlertTriangle, CircleAlert, TrendingUp } from "lucide-react";

import type { ActionTone } from "../types";

export function ActionToneIcon({ tone, size = 17 }: { tone: ActionTone; size?: number }) {
  const Icon = tone === "danger" ? AlertTriangle : tone === "warning" ? CircleAlert : TrendingUp;
  return <Icon size={size} strokeWidth={1.9} aria-hidden="true" />;
}
