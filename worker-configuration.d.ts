/// <reference types="@cloudflare/workers-types" />

// `cloudflare:workers` exports `env` typed as `Cloudflare.Env`, which the runtime types
// leave empty for projects to extend by declaration merging. Keep this in sync with the
// bindings registered in vite.config.ts and declared on the Env interface in worker/index.ts.
declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    DB: D1Database;

    // LINE Login (PIN-0014). Optional: with none of them set the login page says LINE is
    // not connected instead of offering a button that fails. Supplied from `.dev.vars` in
    // development and from Cloudflare secrets in production — never `.env.local`, which
    // does not reach this env, and never `.openai/hosting.json`.
    LINE_CHANNEL_ID?: string;
    LINE_CHANNEL_SECRET?: string;
    LINE_CALLBACK_URL?: string;
  }
}
