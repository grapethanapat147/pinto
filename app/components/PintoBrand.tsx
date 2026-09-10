/**
 * Brand marks (PIN-0017). Artwork lives in `public/pinto/`; see
 * `.codex/specs/design-system-brief.md` for the decisions behind it.
 *
 * Adapted from the `react/PintoAssets.jsx` supplied with the handoff — same files and
 * intrinsic sizes, rewritten as typed named exports to match this codebase.
 *
 * The three mascot crops exist because detail that reads at 300px turns to mush at 40px:
 * `full` carries the notification chip, `bust` drops it, `head` is just her face for
 * anywhere a mark is needed. `favicon.svg` is a further-simplified fourth crop for 16px.
 */

/*
 * `next/image` is not the right tool here and the lint rule cannot tell: every asset in this
 * file is an SVG, which that pipeline passes through unoptimised, and this app builds through
 * vinext to a Cloudflare Worker with no image loader configured. Plain `<img>` with explicit
 * width and height already reserves the box, so there is no layout shift to fix.
 */
/* eslint-disable @next/next/no-img-element */

/*
 * Sizes are the handoff's recommended display sizes, not the raw `viewBox` — `fit()` only
 * needs the ratio, and these double as the default when the caller gives neither dimension.
 * Ratios match the artwork exactly: full 550x465, bust 440x440, head 240x240.
 */
const MASCOT = {
  full: { file: "mascot-full.svg", width: 330, height: 279 },
  bust: { file: "mascot-bust.svg", width: 240, height: 240 },
  head: { file: "mascot-head.svg", width: 40, height: 40 },
} as const;

/** viewBox 270x78. The wordmark is drawn as paths, so it carries no font dependency. */
const LOCKUP = { w: 270, h: 78 };
/** viewBox 240x240. `logo-mark.svg` and `mascot-head.svg` are the same artwork, shipped
 *  under both names because the handoff gives them different roles. */
const MARK = { w: 40, h: 40 };

export type MascotVariant = keyof typeof MASCOT;

/**
 * Emit both dimensions, deriving whichever was not given from the artwork's own ratio.
 *
 * Emitting the intrinsic width alongside a caller-supplied height distorts the image —
 * `height={30}` on the 199×68 lockup rendered it 199×30. Keeping both attributes (rather
 * than dropping one) also means the browser reserves the right box before the SVG loads.
 */
function fit(intrinsic: { w: number; h: number }, width?: number, height?: number) {
  if (width && height) return { width, height };
  if (width) return { width, height: Math.round((width / intrinsic.w) * intrinsic.h) };
  if (height) return { width: Math.round((height / intrinsic.h) * intrinsic.w), height };
  return { width: intrinsic.w, height: intrinsic.h };
}


export function PintoMascot({
  variant = "full",
  width,
  height,
  alt,
  className,
}: {
  variant?: MascotVariant;
  width?: number;
  height?: number;
  /** Omit for decorative use — the image is then hidden from screen readers. */
  alt?: string;
  className?: string;
}) {
  const { file, width: w, height: h } = MASCOT[variant];
  const box = fit({ w, h }, width, height);
  return (
    <img
      src={`/pinto/${file}`}
      width={box.width}
      height={box.height}
      alt={alt ?? ""}
      // a decorative illustration beside text that already says the same thing
      aria-hidden={alt ? undefined : true}
      className={className}
    />
  );
}

/**
 * `markOnly` is the head on its own — for spaces too small for the wordmark to be legible.
 * The lockup already contains the word "pinto", so it never needs a text label beside it.
 */
export function PintoLogo({
  markOnly = false,
  width,
  height,
  className,
}: {
  markOnly?: boolean;
  width?: number;
  height?: number;
  className?: string;
}) {
  const file = markOnly ? "logo-mark.svg" : "logo-lockup.svg";
  const box = fit(markOnly ? MARK : LOCKUP, width, height);
  return (
    <img
      src={`/pinto/${file}`}
      width={box.width}
      height={box.height}
      alt="pinto"
      className={className}
    />
  );
}
