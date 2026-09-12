import { readFileSync } from "node:fs";

/**
 * Reads `wrangler.deploy.jsonc` (PIN-0021).
 *
 * Wrangler accepts JSONC and that file carries comments explaining two traps that cost real
 * time — the filename collision with the vite plugin, and where `migrations_dir` belongs.
 * `JSON.parse` will not read it, so strip the comments first, tracking string state rather
 * than running a regex over the whole file: a `//` inside a string is data, not a comment.
 */
export function readJsonc(path) {
  const source = readFileSync(path, "utf8");
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    out += char;
  }

  return JSON.parse(out);
}
