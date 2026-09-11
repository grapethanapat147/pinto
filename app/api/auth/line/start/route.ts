import { authorizeUrl, lineConfig, randomToken } from "../provider";
import { issuedCookies } from "../state";

/**
 * Begins LINE Login (PIN-0014). A GET because it is reached by a normal link click, and it
 * has no side effect beyond issuing this browser a `state` and `nonce` to come back with.
 */
export async function GET() {
  const config = lineConfig();
  if (!config) {
    return Response.json(
      { error: "LINE Login is not configured for this deployment" },
      { status: 503 },
    );
  }

  const state = randomToken();
  const nonce = randomToken();
  const headers = new Headers({ location: authorizeUrl(config, state, nonce) });
  for (const value of issuedCookies(state, nonce)) headers.append("set-cookie", value);

  return new Response(null, { status: 302, headers });
}
