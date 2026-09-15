import vinext from "vinext";
import { defineConfig } from "vite";

/*
 * These two values name the LOCAL miniflare database and nothing else. The real one lives in
 * `wrangler.deploy.jsonc` and is merged in at deploy time by `scripts/deploy.mjs`.
 *
 * They read like leftovers and they are, but **do not tidy them**: miniflare derives the
 * on-disk filename from them, so changing either orphans the local database — the seeded demo
 * shop and any LINE account granted access.
 *
 * They used to come from `.openai/hosting.json`, which PIN-0024 removed along with the
 * OpenAI Sites plugin. `git revert` that commit to get the Sites target back.
 */
const LOCAL_DATABASE_NAME = "site-creator-d1";
const LOCAL_DATABASE_ID = "00000000-0000-4000-8000-000000000000";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [
    {
      binding: "DB",
      database_name: LOCAL_DATABASE_NAME,
      database_id: LOCAL_DATABASE_ID,
    },
  ],
  r2_buckets: [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
