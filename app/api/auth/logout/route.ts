import { cookies } from "next/headers";

import { revokeSession } from "../../../../db/auth";
import { clearedSessionCookie } from "../cookie";
import { SESSION_COOKIE } from "../../../session";

/** Deletes the session row, so logout revokes rather than merely forgetting. */
export async function POST() {
  const jar = await cookies();
  await revokeSession(jar.get(SESSION_COOKIE)?.value);

  return new Response(null, {
    status: 303,
    headers: { location: "/login", "set-cookie": clearedSessionCookie() },
  });
}
