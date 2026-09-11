/**
 * Session storage and identity lookup (PIN-0011). See `.codex/specs/auth-and-roles.md`.
 *
 * Two rules hold this together:
 *
 * 1. **No secret is stored on a user row.** Identity is `(provider, providerUserId)`;
 *    LINE Login is the destination, so there is no password anywhere in this system.
 * 2. **The database never sees the session token.** The cookie holds a random 32-byte
 *    value; `sessions.id` is its SHA-256. A database leak therefore does not hand over
 *    live sessions, because the stored digest cannot be replayed as a cookie.
 */
import { and, eq, lt } from "drizzle-orm";

import { getDb } from "./index";
import { sessions, users } from "./schema";

/** Thirty days, matched by both the row's `expires_at` and the cookie's Max-Age. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type SessionUser = {
  userId: number;
  shopId: number;
  role: "owner" | "staff";
  displayName: string;
  pictureUrl: string | null;
};

/** URL-safe token from the platform CSPRNG. Returned once, never stored. */
export function createSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * SHA-256 of the token, used as the primary key.
 *
 * A plain digest is right here and a password hash would not be: the input is 256 bits of
 * CSPRNG output, so there is nothing to brute-force and no salt to add — the slow hashing
 * that protects low-entropy passwords would only cost latency on every request.
 */
async function tokenDigest(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function findUserByProvider(
  provider: "line" | "demo",
  providerUserId: string
): Promise<SessionUser | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.provider, provider), eq(users.providerUserId, providerUserId)));

  if (!row) return null;
  return {
    userId: row.id,
    shopId: row.shopId,
    role: row.role,
    displayName: row.displayName,
    pictureUrl: row.pictureUrl,
  };
}

/**
 * Writes back the display name and picture the provider just vouched for (PIN-0014).
 *
 * A user row is created before its owner has ever signed in — `scripts/grant-line-access.mjs`
 * has only the LINE user id to go on, so it writes a placeholder name. Refreshing here is
 * what makes that placeholder temporary, and it keeps a later rename on LINE from leaving a
 * stale name in Pinto.
 *
 * The write is skipped when nothing changed, so a normal sign-in stays a read.
 */
export async function refreshProfile(
  user: SessionUser,
  profile: { displayName: string; pictureUrl: string | null }
): Promise<SessionUser> {
  if (user.displayName === profile.displayName && user.pictureUrl === profile.pictureUrl) {
    return user;
  }

  await getDb()
    .update(users)
    .set({ displayName: profile.displayName, pictureUrl: profile.pictureUrl })
    .where(eq(users.id, user.userId));

  return { ...user, displayName: profile.displayName, pictureUrl: profile.pictureUrl };
}

/** Returns the raw token for the cookie; only its digest reaches the database. */
export async function createSession(user: SessionUser): Promise<{ token: string; expiresAt: string }> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await getDb().insert(sessions).values({
    id: await tokenDigest(token),
    userId: user.userId,
    shopId: user.shopId,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Resolves a cookie token to its user, or null.
 *
 * Expiry is checked against the stored row rather than trusting the cookie's own lifetime,
 * so a copied cookie cannot outlive the session it came from.
 */
export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  const db = getDb();
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      userId: users.id,
      shopId: users.shopId,
      role: users.role,
      displayName: users.displayName,
      pictureUrl: users.pictureUrl,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, await tokenDigest(token)));

  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) return null;

  return {
    userId: row.userId,
    shopId: row.shopId,
    role: row.role,
    displayName: row.displayName,
    pictureUrl: row.pictureUrl,
  };
}

/** Deletes the row, so the session is revoked server-side rather than merely forgotten. */
export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await getDb().delete(sessions).where(eq(sessions.id, await tokenDigest(token)));
}

/** Housekeeping for expired rows. Safe to call at any time. */
export async function purgeExpiredSessions(): Promise<void> {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString()));
}
