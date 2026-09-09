/**
 * Reading the session from a request (PIN-0011).
 *
 * `next/headers` works in this stack — verified before the spec was written — so a server
 * component can resolve the caller without threading a request object through the tree.
 */
import { cookies } from "next/headers";

import { readSession, type SessionUser } from "../db/auth";

export const SESSION_COOKIE = "pinto_session";

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
}
