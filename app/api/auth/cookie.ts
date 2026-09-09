import { SESSION_TTL_SECONDS } from "../../../db/auth";
import { SESSION_COOKIE } from "../../session";

/**
 * HttpOnly so script cannot read it, Lax so it survives a normal top-level navigation
 * back from an OAuth redirect without being sent on cross-site subrequests, and Secure
 * everywhere except local dev, where there is no https.
 */
export function sessionCookie(token: string, expiresAt: string): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (!import.meta.env.DEV) parts.push("Secure");
  return parts.join("; ");
}

export function clearedSessionCookie(): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (!import.meta.env.DEV) parts.push("Secure");
  return parts.join("; ");
}
