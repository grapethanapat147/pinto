import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Two resolutions Node cannot do on its own for this source tree:
 *
 * 1. `cloudflare:workers` — not a real ESM specifier, so it is pointed at a stub.
 * 2. Extensionless relative imports (`./index`, `../app/types`) — vite resolves these for
 *    the app, but a test importing `db/*.ts` directly needs the `.ts` filled in.
 */
export async function resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") {
    return { url: new URL("./cloudflare-workers-stub.mjs", import.meta.url).href, shortCircuit: true };
  }

  if (specifier.startsWith(".") && !/\.[mc]?[jt]sx?$/.test(specifier) && context.parentURL) {
    const base = new URL(specifier, context.parentURL);
    for (const candidate of [`${base.href}.ts`, `${base.href}.tsx`, `${base.href}/index.ts`]) {
      if (existsSync(fileURLToPath(candidate))) {
        return { url: candidate, shortCircuit: true };
      }
    }
  }

  return next(specifier, context);
}
