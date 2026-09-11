/**
 * LINE Login, OAuth 2.0 / OIDC (PIN-0014). See `.codex/specs/auth-and-roles.md`.
 *
 * Configuration comes from `.dev.vars` in development and from Cloudflare secrets in
 * production. **Not `.env.local`** — that file populates `import.meta.env`, which never
 * reaches the Worker's `env`; this was verified with a probe route rather than assumed.
 */
import { env } from "cloudflare:workers";

const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export type LineConfig = {
  channelId: string;
  channelSecret: string;
  callbackUrl: string;
};

/**
 * Returns null when the channel is not configured, so callers can stay honest about it
 * instead of rendering a button that fails on click — the PIN-0001 rule.
 */
export function lineConfig(): LineConfig | null {
  const source = env as unknown as Record<string, string | undefined>;
  const channelId = source.LINE_CHANNEL_ID;
  const channelSecret = source.LINE_CHANNEL_SECRET;
  const callbackUrl = source.LINE_CALLBACK_URL;

  if (!channelId || !channelSecret || !callbackUrl) return null;
  return { channelId, channelSecret, callbackUrl };
}

/** Pure: everything the browser is sent to, so it can be asserted without a network call. */
export function authorizeUrl(config: LineConfig, state: string, nonce: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.channelId);
  url.searchParams.set("redirect_uri", config.callbackUrl);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  // `profile` for the display name and picture, `openid` for the ID token that carries the
  // verified user id. No `email` — nothing in Pinto uses it, so it is not requested.
  url.searchParams.set("scope", "openid profile");
  return url.toString();
}

/** URL-safe random value for `state` and `nonce`, from the platform CSPRNG. */
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type LineIdentity = {
  providerUserId: string;
  displayName: string;
  pictureUrl: string | null;
};

/**
 * Exchanges the authorization code and returns the identity LINE vouches for.
 *
 * The ID token is verified by LINE's own `verify` endpoint, which checks signature, issuer,
 * audience, expiry and the nonce against the channel. Verifying locally would mean caching
 * JWKS and implementing signature checks to reach the same answer with more to get wrong.
 *
 * Throws with a short reason; the caller turns that into an honest page. The reason never
 * contains the channel secret or the authorization code.
 */
export async function exchangeCode(
  config: LineConfig,
  code: string,
  nonce: string,
): Promise<LineIdentity> {
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.callbackUrl,
      client_id: config.channelId,
      client_secret: config.channelSecret,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`LINE rejected the authorization code (HTTP ${tokenResponse.status})`);
  }

  const tokens = (await tokenResponse.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("LINE returned no ID token");

  const verifyResponse = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: tokens.id_token,
      client_id: config.channelId,
      nonce,
    }),
  });

  if (!verifyResponse.ok) {
    throw new Error(`LINE could not verify the ID token (HTTP ${verifyResponse.status})`);
  }

  const claims = (await verifyResponse.json()) as {
    sub?: string;
    name?: string;
    picture?: string;
  };

  if (!claims.sub) throw new Error("the verified ID token carried no subject");

  return {
    providerUserId: claims.sub,
    displayName: claims.name?.trim() || "ผู้ใช้ LINE",
    pictureUrl: claims.picture ?? null,
  };
}
