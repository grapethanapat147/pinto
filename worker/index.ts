/**
 * Cloudflare Worker entry point.
 *
 * The template shipped a `/_vinext/image` branch backed by an `IMAGES` binding. That binding
 * was never declared anywhere — not in `vite.config.ts`, not in the generated manifest — so
 * the route would have thrown the first time anything reached it. Nothing does: every image
 * in Pinto is a plain `<img>` pointing at `public/pinto/`, and `PintoBrand.tsx` explains why
 * `next/image` is the wrong tool for this artwork.
 *
 * Deleted rather than bound, because dead code that fails at runtime is worse than absent
 * code — the same rule PIN-0001 applied to buttons, applied to a route. If image
 * optimisation is ever wanted, add the binding and the branch back together.
 */
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
