/**
 * Whether a marketplace can actually be connected yet (PIN-0025).
 *
 * This is the `lineConfig()` pattern from PIN-0014, which is already proven in this codebase:
 * a provider reports whether it is configured, and the UI renders a live control or a
 * disabled one **with the reason**. It never renders a control that looks live and does
 * nothing — that is what PIN-0001 exists to prevent.
 *
 * Shopee and TikTok Shop both report unconfigured today because neither has credentials.
 * When เกรพ has them, `credentials()` starts returning a value and the screen needs no change.
 */
import { env } from "cloudflare:workers";

export type ProviderStatus =
  | { configured: true }
  /** `reason` is shown to the shop owner, so it says what is missing in their language. */
  | { configured: false; reason: string };

type ProviderDefinition = {
  code: string;
  /** Env keys that must all be present for this provider to be usable. */
  requires: readonly string[];
  /** Shown when they are not. */
  missingReason: string;
};

/**
 * Keyed by `channels.code`, so a channel row that has no provider here is simply not
 * connectable — which is the honest answer for a chat channel or an ad platform.
 */
const PROVIDERS: readonly ProviderDefinition[] = [
  {
    code: "shopee",
    requires: ["SHOPEE_PARTNER_ID", "SHOPEE_PARTNER_KEY"],
    missingReason: "ยังไม่ได้ตั้งค่า Shopee Open Platform สำหรับการติดตั้งนี้",
  },
  {
    code: "tiktok",
    requires: ["TIKTOK_APP_KEY", "TIKTOK_APP_SECRET"],
    missingReason: "ยังไม่ได้ตั้งค่า TikTok Shop Partner สำหรับการติดตั้งนี้",
  },
];

export function providerFor(channelCode: string): ProviderDefinition | null {
  return PROVIDERS.find((provider) => provider.code === channelCode) ?? null;
}

/**
 * Reading `env` can throw outside a Worker, so this never lets that reach a page — an
 * unreadable environment means unconfigured, which is the safe answer.
 */
export function providerStatus(channelCode: string): ProviderStatus | null {
  const provider = providerFor(channelCode);
  if (!provider) return null;

  let source: Record<string, string | undefined> = {};
  try {
    source = env as unknown as Record<string, string | undefined>;
  } catch {
    return { configured: false, reason: provider.missingReason };
  }

  const ready = provider.requires.every((key) => {
    const value = source[key];
    return typeof value === "string" && value.length > 0;
  });

  return ready ? { configured: true } : { configured: false, reason: provider.missingReason };
}
