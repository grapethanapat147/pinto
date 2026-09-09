import { createSession, findUserByProvider } from "../../../../db/auth";
import { sessionCookie } from "../cookie";

/** Only these two demo identities can be requested; anything else is rejected. */
const DEMO_USERS: Record<string, string> = {
  owner: "demo-owner",
  staff: "demo-staff",
};

/**
 * The one-click demo sign-in (auth spec, "the demo problem").
 *
 * A real `demo` provider row rather than a bypass, so it is visible in the database and
 * goes through exactly the same session machinery as LINE Login will. The staff identity
 * exists so the role difference can be demonstrated live.
 */
export async function POST(request: Request) {
  const requested = new URL(request.url).searchParams.get("as") ?? "owner";
  const providerUserId = DEMO_USERS[requested];
  if (!providerUserId) {
    return Response.json({ error: "unknown demo identity" }, { status: 400 });
  }

  const user = await findUserByProvider("demo", providerUserId);
  if (!user) {
    return Response.json({ error: `demo user ${providerUserId} is not seeded` }, { status: 500 });
  }

  const { token, expiresAt } = await createSession(user);
  return new Response(null, {
    status: 303,
    headers: { location: "/", "set-cookie": sessionCookie(token, expiresAt) },
  });
}
