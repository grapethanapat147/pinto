/**
 * Stands in for the `cloudflare:workers` built-in, which plain Node cannot resolve
 * (ERR_UNSUPPORTED_ESM_URL_SCHEME). `resolve-hooks.mjs` points the specifier here.
 *
 * A Proxy rather than a plain object so the test can install the env after this module is
 * first imported — the page chunk that reads `env` is loaded lazily during render.
 */
export const env = new Proxy(
  {},
  {
    get: (_target, prop) => globalThis.__PINTO_TEST_ENV__?.[prop],
    has: (_target, prop) => prop in (globalThis.__PINTO_TEST_ENV__ ?? {}),
  }
);
