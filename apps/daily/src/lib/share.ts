import type { Article, SummaryText } from "./types";

/**
 * Fonts for the share poster.
 *
 * Satori (what `next/og` renders with) needs real font data — it cannot use a
 * CSS @font-face or a webfont URL — and it cannot read woff2. That rules out
 * the stylesheet the site itself loads, and it rules out shipping 思源黑体
 * whole: the full face is over 10 MB.
 *
 * The way out is Google's `text=` parameter, which returns a face subsetted to
 * exactly the characters asked for. Measured on real articles, a title plus a
 * full Chinese summary is ~250 distinct characters and comes back at 54–59 KB.
 * Ask for more than that — every article on a day, say — and Google stops
 * subsetting and hands back the whole 10 MB face, so this must always be called
 * with ONE poster's text.
 *
 * The ancient User-Agent is not a mistake, and the exact one matters. Google
 * picks the format from it, and only some of what it serves is parseable here:
 *
 *   modern Chrome/Safari  → woff2   Satori cannot read it
 *   Firefox 27, Chrome 30 → woff    unreliable in Satori's parser
 *   MSIE 6                → eot     "Unsupported OpenType signature"
 *   Android 2.3, or none  → ttf     works
 *
 * Android 2.3 rather than sending no User-Agent at all — both yield ttf today,
 * but one is a stated request and the other is an accident of whatever the
 * runtime happens to omit.
 */
const LEGACY_UA =
  "Mozilla/5.0 (Linux; U; Android 2.3; en-us) AppleWebKit/533.1 " +
  "(KHTML, like Gecko) Version/4.0 Mobile Safari/533.1";

/** Keyed by weight + text so the two weights of one poster are cached apart. */
const fontCache = new Map<string, ArrayBuffer>();
/** Bounded so a long-lived server cannot accumulate a font per article. */
const FONT_CACHE_MAX = 48;

async function loadSubset(
  family: string,
  text: string,
  weight: number,
): Promise<ArrayBuffer> {
  const key = `${family}:${weight}:${text}`;
  const hit = fontCache.get(key);
  if (hit) return hit;

  const cssUrl =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}` +
    `:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await fetch(cssUrl, {
    headers: { "user-agent": LEGACY_UA },
  }).then((r) => r.text());

  const href = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!href) throw new Error(`no font url in Google's css for weight ${weight}`);

  const data = await fetch(href, {
    headers: { "user-agent": LEGACY_UA },
  }).then((r) => r.arrayBuffer());

  if (fontCache.size >= FONT_CACHE_MAX) {
    fontCache.delete(fontCache.keys().next().value!);
  }
  fontCache.set(key, data);
  return data;
}

export interface PosterFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
}

/**
 * BOTH families, in the order Satori should try them.
 *
 * The poster used to load 思源黑体 alone, which meant every Latin word — every
 * title, every source name, the brand itself — was drawn with that face's Latin
 * glyphs. They are perfectly good glyphs and completely wrong here: the site
 * sets Latin in Manrope, so the poster looked like a different publication than
 * the page it came from.
 *
 * Satori falls back in array order, so Manrope goes first and picks up the
 * Latin, and 思源黑体 catches everything Manrope has no glyph for. Manrope is
 * Latin-only, so its subset is tiny (~8.6 KB) — this costs two more requests
 * and no meaningful bytes.
 */
export async function posterFonts(text: string): Promise<PosterFont[]> {
  const [latin400, latin700, cjk400, cjk700] = await Promise.all([
    loadSubset("Manrope", text, 400),
    loadSubset("Manrope", text, 700),
    loadSubset("Noto Sans SC", text, 400),
    loadSubset("Noto Sans SC", text, 700),
  ]);
  return [
    { name: "Manrope", data: latin400, weight: 400, style: "normal" },
    { name: "Manrope", data: latin700, weight: 700, style: "normal" },
    { name: "Noto Sans SC", data: cjk400, weight: 400, style: "normal" },
    { name: "Noto Sans SC", data: cjk700, weight: 700, style: "normal" },
  ];
}

/** Every glyph the poster will draw, so the subset covers all of it. */
export function posterText(article: Article, summary: SummaryText, extra: string) {
  return [
    article.title,
    summary.thesis,
    ...(summary.paragraphs ?? []),
    extra,
    // Punctuation and digits the layout adds on its own.
    "0123456789·—、。，：；？！「」（）%",
  ].join("");
}

/**
 * The brand mark, inlined as a data URI.
 *
 * Satori draws `<img>` but not inline `<svg>` elements, and it has no
 * filesystem, so the icon cannot simply be referenced by path. This is the same
 * artwork as `public/favicon.svg`, minified — if that file changes, regenerate
 * this string, because nothing enforces that the two agree.
 */
export const POSTER_MARK = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSLmr4/ml6XlubLotKcgRGFpbHkgVGFrZXMiPiA8cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSIxNCIgZmlsbD0iIzNCMzU2MyIvPiA8cGF0aCBmaWxsPSIjRkJGM0U5IiBkPSJNIDggMjMgQSAxMiAxMiAwIDEgMSAzMiAyMyBDIDMyIDM1LjAgMjUuNCA0NC4wIDE1LjggNDguOCBMIDguNiAzOS4yIEMgMTguOCAzNS42IDIzLjYgMzAuMiAyMy42IDIzIFoiLz4gPHBhdGggZmlsbD0iI0VGQTA1MCIgZD0iTSAzMyAyMyBBIDEyIDEyIDAgMSAxIDU3IDIzIEMgNTcgMzUuMCA1MC40IDQ0LjAgNDAuOCA0OC44IEwgMzMuNiAzOS4yIEMgNDMuOCAzNS42IDQ4LjYgMzAuMiA0OC42IDIzIFoiLz4gPC9zdmc+";

/**
 * Text width in full-width UNITS: CJK and CJK punctuation count 1, everything
 * else about a half.
 *
 * Counting raw characters was fine while the poster was Chinese-only. The
 * English poster broke it on the first render — the same summary is roughly
 * twice as many characters, each about half as wide — and the estimate asked
 * for a 2437px canvas to hold content that ended around 900. A poster
 * two-thirds empty is not a rounding error.
 */
function widthUnits(text: string): number {
  const wide = (
    text.match(/[\u3000-\u303f\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/g) ?? []
  ).length;
  return wide + (text.length - wide) * 0.5;
}

export const POSTER_WIDTH = 1000;

/**
 * Poster height, computed from the text rather than fixed.
 *
 * `ImageResponse` demands concrete dimensions, and the summaries are not a
 * fixed size — 100 characters on a link-roundup day, 600 on a heavy one. A
 * fixed canvas would either crop the long ones or leave the short ones mostly
 * empty, and the whole point of the image is that it carries the WHOLE summary.
 *
 * The estimate is deliberately generous; empty space at the bottom is a much
 * cheaper mistake than a clipped last paragraph.
 */
export function posterHeight(summary: SummaryText, title: string): number {
  // Every number here is one measurement off the rendered poster, so the layout
  // and this estimate can be checked against each other. The content column is
  // 880px wide (1000 less 60px of padding either side).
  const PADDING = 56 * 2;
  const HEADER = 50 + 40; // wordmark line, then its margin to the title
  const TITLE_LINE = 55; // 44px at line-height 1.25
  const SOURCE = 16 + 25; // margin, then one line
  const THESIS = 32 + 0; // margin above the block
  const THESIS_LINE = 45; // 30px at 1.5
  const PARAS = 28; // margin above the first paragraph
  const PARA_LINE = 41; // 22px at 1.85
  const PARA_GAP = 14; // between paragraphs
  // No footer any more: the permalink and the reading time were the only
  // things in it, and both were removed.
  const SLACK = 30; // most of a line, so a bad guess never clips

  /**
   * 39 full-width UNITS per line, against the 40 that fit on an 880px line at
   * 22px. Erring low errs toward more lines, and the two errors are not
   * symmetric: an over-tall poster ends in white space, an under-tall one
   * silently crops the last paragraph.
   */
  const UNITS_PER_LINE = 39;

  const paragraphs = summary.paragraphs ?? [];
  const lines = paragraphs.reduce(
    (sum, p) => sum + Math.ceil(widthUnits(p) / UNITS_PER_LINE),
    0,
  );

  return Math.round(
    PADDING +
      HEADER +
      Math.ceil(widthUnits(title) / 22) * TITLE_LINE +
      SOURCE +
      THESIS +
      Math.ceil(widthUnits(summary.thesis) / 24) * THESIS_LINE +
      PARAS +
      lines * PARA_LINE +
      Math.max(0, paragraphs.length - 1) * PARA_GAP +
      SLACK,
  );
}

