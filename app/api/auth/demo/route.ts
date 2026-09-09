import { createSession, findUserByProvider } from "../../../../db/auth";
import { sessionCookie } from "../cookie";

/**
 * The one-click demo sign-in (auth spec, "the demo problem").
 *
 * A real `demo` provider row rather than a bypass, so it is visible in the database and
 * goes through exactly the same session machinery as LINE Login will.
 */
export async function POST() {
  const user = await findUserByProvider("demo", "demo-owner");
  if (!user) {
    return Response.json({ error: "demo user is not seeded" }, { status: 500 });
  }

  const { token, expiresAt } = await createSession(user);
  return new Response(null, {
    status: 303,
    headers: { location: "/", "set-cookie": sessionCookie(token, expiresAt) },
  });
}
