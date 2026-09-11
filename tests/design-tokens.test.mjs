import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * PIN-0018 adopted the delivered design system. `.codex/specs/design-system/` holds the
 * files exactly as they arrived, and these tests keep the app honest against them.
 *
 * Before this ticket the stylesheet had two `:root` blocks: the vinext template's green
 * palette, and an orange block 235 lines below that overrode the six values it cared about.
 * Everything the second block did not mention was still the template's — including the
 * focus ring, which drew green on an orange UI. `--green` also held an orange and was doing
 * double duty as the brand accent and the success colour, so every positive number was
 * orange and the accent budget went on decoration.
 */

const appCss = () => readFile(new URL("../app/globals.css", import.meta.url), "utf8");
/** Comments explain the old names on purpose; only real declarations should be checked. */
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const deliveredCss = () =>
  readFile(new URL("../.codex/specs/design-system/design-tokens.css", import.meta.url), "utf8");

const parseTokens = (css) => {
  const root = css.match(/:root\s*\{([\s\S]*?)\}/);
  assert.ok(root, "expected a :root block");
  return new Map(
    [...root[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim().toLowerCase()]),
  );
};

test("exactly one :root, and no token from the vinext template survives", async () => {
  const css = withoutComments(await appCss());

  const roots = css.match(/:root\s*\{/g) ?? [];
  assert.equal(roots.length, 1, `expected one :root block, found ${roots.length}`);

  for (const dead of ["--green", "--red", "--amber", "--white"]) {
    assert.doesNotMatch(
      css,
      new RegExp(`\\${dead}(?![a-z-])`),
      `${dead} is a template name the delivered system replaced; use --brand / --danger / --warning / --surface`,
    );
  }
});

test("every delivered colour token is carried at its delivered value", async () => {
  const delivered = parseTokens(await deliveredCss());
  const app = parseTokens(await appCss());

  const wrong = [];
  for (const [name, value] of delivered) {
    if (!value.startsWith("#")) continue; // fonts and sizes are checked separately
    const mine = app.get(name);
    if (mine === undefined) wrong.push(`${name} is missing (delivered ${value})`);
    else if (mine !== value) wrong.push(`${name} is ${mine}, delivered ${value}`);
  }
  assert.deepEqual(wrong, [], `app palette has drifted from the delivered file:\n  ${wrong.join("\n  ")}`);
});

test("the delivered radius scale is carried and actually used", async () => {
  const css = await appCss();
  const delivered = parseTokens(await deliveredCss());
  const app = parseTokens(css);

  for (const name of ["--radius-card", "--radius-button"]) {
    assert.equal(app.get(name), delivered.get(name), `${name} must match the delivered file`);
  }
  // A token nothing references is decoration, not a system.
  assert.ok(css.includes("var(--radius-card)"), "cards must use --radius-card");
  assert.ok(css.includes("var(--radius-button)"), "buttons must use --radius-button");
});

test("no drop shadows, per the delivered tone rules", async () => {
  const css = await appCss();

  const drops = [];
  for (const [, head, body] of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    for (const [, value] of body.matchAll(/box-shadow:\s*([^;}]+)/g)) {
      const v = value.trim();
      // `inset` is a structural rail marker and `0 0 0 Npx` is a ring, not elevation
      if (v === "none" || v.startsWith("inset") || /^0 0 0 \d/.test(v)) continue;
      drops.push(`${head.trim().split("\n").pop().slice(-50)} -> ${v.slice(0, 40)}`);
    }
  }
  assert.deepEqual(drops, [], `the delivered system has no shadows:\n  ${drops.join("\n  ")}`);
});

test("the focus ring is drawn in the brand colour", async () => {
  const css = await appCss();
  const rule = css.match(/:focus-visible[^{]*\{[^}]*\}/);
  assert.ok(rule, "there must be a visible focus style");
  assert.match(rule[0], /rgba\(200, 84, 16/, "focus ring must be the brand orange, not the template green");
});
