/**
 * Short-lived cookies carrying `state` and `nonce` across the redirect to LINE (PIN-0014).
 *
 * `state` is the CSRF guard: a callback whose state does not match the one this browser was
 * issued is rejected before any lookup. `nonce` is handed to LINE and echoed inside the ID
 * token, so a token minted for a different attempt cannot be replayed here.
 *
 * Ten minutes is generous for a login and short enough that a stale value cannot sit around.
 */
const MAX_AGE_SECONDS = 600;

export const STATE_COOKIE = "pinto_line_state";
export const NONCE_COOKIE = "pinto_line_nonce";

function cookie(name: string, value: string, maxAge: number): string {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (!import.meta.env.DEV) parts.push("Secure");
  return parts.join("; ");
}

export function issuedCookies(state: string, nonce: string): string[] {
  return [cookie(STATE_COOKIE, state, MAX_AGE_SECONDS), cookie(NONCE_COOKIE, nonce, MAX_AGE_SECONDS)];
}

/** Cleared on every callback, success or failure, so one attempt cannot be replayed. */
export function clearedCookies(): string[] {
  return [cookie(STATE_COOKIE, "", 0), cookie(NONCE_COOKIE, "", 0)];
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || undefined;
  }
  return undefined;
}

/**
 * Constant-time comparison. `state` is not a secret in the way a password is, but comparing
 * it with `===` leaks length and prefix through timing for no benefit.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
