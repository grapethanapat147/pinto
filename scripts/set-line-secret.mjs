/**
 * Writes the LINE channel secret into `.dev.vars` (PIN-0014).
 *
 * It is prompted rather than passed as an argument so it never reaches shell history or the
 * process list, and written by string replacement rather than `sed` so a secret containing
 * `/`, `&` or a quote cannot corrupt the file or the command.
 *
 * Usage: npm run auth:set-line-secret
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { prompt } from "./prompt.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, ".dev.vars");
const example = join(root, ".dev.vars.example");

if (!existsSync(target)) {
  copyFileSync(example, target);
  console.log("Created .dev.vars from .dev.vars.example.");
}

const secret = await prompt("LINE channel secret (input hidden): ", { hidden: true });

if (!secret) {
  console.error("Nothing entered — .dev.vars left unchanged.");
  process.exit(1);
}
// LINE channel secrets are 32 hex characters. Catching a mistyped paste here beats a 400
// from the token endpoint an hour later.
if (!/^[0-9a-f]{32}$/i.test(secret)) {
  console.error(
    `That does not look like a LINE channel secret (32 hex characters, got ${secret.length}).\n` +
      "Copy it from the LINE Developers Console, Basic settings tab. Nothing was written."
  );
  process.exit(1);
}

const lines = readFileSync(target, "utf8").split("\n");
let replaced = false;
const updated = lines.map((line) => {
  if (!line.startsWith("LINE_CHANNEL_SECRET=")) return line;
  replaced = true;
  return `LINE_CHANNEL_SECRET=${secret}`;
});
if (!replaced) updated.push(`LINE_CHANNEL_SECRET=${secret}`);

writeFileSync(target, updated.join("\n"));
console.log("Wrote the secret to .dev.vars (gitignored).");
console.log("Restart the dev server so the Worker reads it: these are read at startup.");
