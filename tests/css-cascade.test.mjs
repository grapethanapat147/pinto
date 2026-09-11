import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * `app/globals.css` is a stack of five appended design layers. Each one used to end with
 * its own media queries, and the next layer's plain rules then silently beat them —
 * **media queries add no specificity**, so at equal specificity the later rule wins at every
 * width. 52 declarations were dead that way (PIN-0019), including the one that collapses the
 * dashboard grid on a phone.
 *
 * The fix moved every media query to the end of the file. These tests keep it that way: a
 * new plain rule appended below them would start the whole failure again, and that is
 * exactly the edit someone adding a sixth layer would make.
 */

const cssPath = new URL("../app/globals.css", import.meta.url);

/** -> [{ line, media, selector, props }] in source order. */
function parse(css) {
  const out = [];
  const stack = [];
  let i = 0;
  let buf = "";
  let line = 1;

  while (i < css.length) {
    if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? css.length : end + 2;
      line += count(css, i, stop);
      i = stop;
      buf = "";
      continue;
    }
    const ch = css[i];
    if (ch === "\n") line += 1;

    if (ch === "{") {
      const head = buf.trim();
      buf = "";
      if (head.startsWith("@")) {
        stack.push(head);
        i += 1;
        continue;
      }
      let depth = 1;
      let j = i + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === "{") depth += 1;
        else if (css[j] === "}") depth -= 1;
        j += 1;
      }
      const props = new Map();
      for (const decl of css.slice(i + 1, j - 1).split(";")) {
        const at = decl.indexOf(":");
        if (at === -1) continue;
        const key = decl.slice(0, at).trim().toLowerCase();
        if (key) props.set(key, decl.slice(at + 1).trim());
      }
      const media = stack.findLast((h) => h.startsWith("@media")) ?? null;
      for (const raw of head.split(",")) {
        const selector = raw.split(/\s+/).filter(Boolean).join(" ");
        if (selector) out.push({ line, media, selector, props });
      }
      line += count(css, i, j);
      i = j;
      continue;
    }
    if (ch === "}") {
      stack.pop();
      buf = "";
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  return out;
}

const count = (s, from, to) => {
  let n = 0;
  for (let k = from; k < to; k += 1) if (s[k] === "\n") n += 1;
  return n;
};

test("no media query is defeated by a later unconditional rule", async () => {
  const rules = parse(await readFile(cssPath, "utf8"));

  const defeated = [];
  rules.forEach((rule, index) => {
    if (!rule.media) return;
    for (const prop of rule.props.keys()) {
      const beater = rules
        .slice(index + 1)
        .find((r) => r.media === null && r.selector === rule.selector && r.props.has(prop));
      if (beater) {
        defeated.push(
          `${rule.selector} { ${prop} } — line ${rule.line} ${rule.media} sets ` +
            `"${rule.props.get(prop)}", but line ${beater.line} sets ` +
            `"${beater.props.get(prop)}" with no media query and therefore wins at every width`,
        );
      }
    }
  });

  assert.deepEqual(
    defeated,
    [],
    `${defeated.length} declaration(s) inside a media query never take effect:\n  ` +
      defeated.join("\n  "),
  );
});

test("every media query stays at the end of the stylesheet", async () => {
  const css = await readFile(cssPath, "utf8");
  const rules = parse(css);

  const firstMedia = rules.findIndex((r) => r.media !== null);
  assert.notEqual(firstMedia, -1, "the stylesheet should still have media queries");

  const strays = rules
    .slice(firstMedia)
    .filter((r) => r.media === null)
    .map((r) => `line ${r.line}: ${r.selector}`);

  assert.deepEqual(
    strays,
    [],
    "these plain rules sit below the responsive layer and will beat it at every width; " +
      `move them above the layer header:\n  ${strays.join("\n  ")}`,
  );
});

test("the panel that holds a wide table is allowed to shrink", async () => {
  const css = await readFile(cssPath, "utf8");

  // Grid and flex items default to `min-width: auto`, whose automatic minimum is the
  // content's min-content width. Without this, the Today view's 680px channel table pushed
  // its panel to 716px and the document to 744px inside a 390px phone.
  assert.match(css, /\.panel \{[^}]*min-width: 0/, ".panel must keep `min-width: 0`");

  // Wide rows are only acceptable because they scroll inside their own container.
  for (const row of ["table-row", "order-row", "stock-row", "campaign-row", "payout-row"]) {
    const rule = css.match(new RegExp(`\\.${row} \\{[^}]*\\}`));
    if (!rule || !/min-width: \d/.test(rule[0])) continue;
    assert.match(css, /\.table-scroll \{[^}]*overflow-x: auto/, `.${row} needs .table-scroll`);
  }
});
