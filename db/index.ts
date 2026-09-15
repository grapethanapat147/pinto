import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Locally that means the dev server was not " +
        "started through vite.config.ts; in production it means the deploy did not carry the " +
        "binding — check `wrangler.deploy.jsonc` and `scripts/deploy.mjs`."
    );
  }

  return drizzle(env.DB, { schema });
}
