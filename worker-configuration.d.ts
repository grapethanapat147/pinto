/// <reference types="@cloudflare/workers-types" />

// `cloudflare:workers` exports `env` typed as `Cloudflare.Env`, which the runtime types
// leave empty for projects to extend by declaration merging. Keep this in sync with the
// bindings registered in vite.config.ts and declared on the Env interface in worker/index.ts.
declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
  }
}
