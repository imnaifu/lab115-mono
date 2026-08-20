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
  weight: 500 | 700;
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
 *
 * THE BODY WEIGHT IS 500, NOT 400. A poster is read at whatever size the app
 * that received it decides to show it — a chat thread scales a 1000px image down
 * to a third of that — and 400 survives none of it: at phone scale the strokes
 * of a 22px Chinese glyph land under a pixel and the paragraph turns grey. 500 is
 * the smallest step that holds up, and still reads as body text against the 700
 * of the headline. There is no 400 registered at all, so nothing can silently
 * fall back to it.
 */
export async function posterFonts(text: string): Promise<PosterFont[]> {
  const [latin500, latin700, cjk500, cjk700] = await Promise.all([
    loadSubset("Manrope", text, 500),
    loadSubset("Manrope", text, 700),
    loadSubset("Noto Sans SC", text, 500),
    loadSubset("Noto Sans SC", text, 700),
  ]);
  return [
    { name: "Manrope", data: latin500, weight: 500, style: "normal" },
    { name: "Manrope", data: latin700, weight: 700, style: "normal" },
    { name: "Noto Sans SC", data: cjk500, weight: 500, style: "normal" },
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

/**
 * The domain, as the poster prints it.
 *
 * Uppercased HERE rather than with `textTransform`, because the string also has
 * to be handed to `posterText` so Google subsets the font with those letters in
 * it — and a subset built from the lowercase form would leave the uppercase
 * render blank. One transform, done once, used by both.
 */
export function posterDomain(site: string): string {
  return new URL(site).host.toUpperCase();
}

export const POSTER_WIDTH = 1000;

/**
 * The poster's geometry, and the page's geometry it is copied from.
 *
 * The poster is meant to look like the article page's card, so every size below is
 * that card's Tailwind value times SCALE. The card is ~694px wide inside the 750px
 * column; the poster is 1000px, and 1.45 is the ratio — which also lands the body
 * text back on 22px, the size the line budget was measured at.
 *
 * Kept here rather than in the route because `posterHeight` has to agree with what
 * the route draws, and two copies of these numbers would drift the first time one
 * of them changed.
 */
export const POSTER = {
  /** Canvas edge → card. Matches the page's `px-4 sm:px-7` gutter. */
  pad: 40,
  /**
   * The domain chip above the wordmark: the page's masthead chip, scaled.
   *
   * The page sets it at `text-xs` with `px-3 py-1` and `tracking-widest`, and it
   * is the one element on the poster that is a chip rather than plain text — so
   * its padding is stated here too, or the height estimate below could not know
   * how tall the row is.
   */
  domainSize: 18,
  domainPadX: 16,
  domainPadY: 6,
  domainTracking: 2,
  /** Chip row → the wordmark lockup under it. The page's `mt-5`, scaled. */
  domainGap: 20,
  /** Inside the card: the page's `p-5`, scaled. */
  cardPad: 30,
  radius: 26,
  /** `size-28` on the page. */
  cover: 112,
  /** The page's `gap-5` between cover and text. */
  coverGap: 28,
  metaSize: 17,
  titleSize: 42,
  originalSize: 23,
  thesisSize: 26,
  /** The accent bar beside the thesis: the page's `border-l-[3px] pl-4`, scaled. */
  thesisRule: 4,
  thesisPad: 22,
  paraSize: 22,
} as const;

/** The width one line of body text actually has. */
export const POSTER_TEXT_WIDTH =
  POSTER_WIDTH - 2 * (POSTER.pad + POSTER.cardPad);

/**
 * The column beside the cover, holding the meta line and the headline.
 *
 * Stated explicitly because Satori will not derive it: the page constrains that
 * block with `min-w-0 flex-1`, and without an equivalent here a long English
 * headline ran straight off the card and off the canvas.
 */
export const POSTER_BESIDE_COVER =
  POSTER_TEXT_WIDTH - POSTER.cover - POSTER.coverGap;

/**
 * The cover gradient, as a plain `linear-gradient` string.
 *
 * The same artwork `Cover.tsx` draws, recomputed rather than shared, because that
 * one leans on `color-mix(in srgb, …)` and Satori has no colour functions. The mix
 * is done here in numbers instead, so the poster's placeholder and the page's are
 * the same two stops at the same angle.
 */
export function coverGradient(id: string, accent: string): string {
  const seed = parseInt(id.slice(0, 4), 16) || 0;
  const tilt = 120 + (seed % 90);
  return (
    `linear-gradient(${tilt}deg, ${accent} 0%, ${accent} 42%, ` +
    `${mix(accent, "#1d1a33", 0.55)} 100%)`
  );
}

/** `ratio` of `a` plus the rest of `b`, per sRGB channel — `color-mix` by hand. */
function mix(a: string, b: string, ratio: number): string {
  const channels = (hex: string) =>
    [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  const blend = (x: number, y: number) =>
    Math.round(x * ratio + y * (1 - ratio))
      .toString(16)
      .padStart(2, "0");
  return `#${blend(ar, br)}${blend(ag, bg)}${blend(ab, bb)}`;
}

/** A cover fetch that cannot hold up or blow up a poster. */
const COVER_TIMEOUT_MS = 4000;
const COVER_MAX_BYTES = 3_000_000;

/**
 * The article's cover as a data URI, or null to fall back to the gradient.
 *
 * Fetched HERE rather than handed to Satori as a URL, so the failure modes belong
 * to this function instead of to the renderer: a source's CDN that hangs, returns
 * HTML, or serves a 12 MB PNG would otherwise stall or fail the whole image. XDA's
 * did two of those three intermittently, which is why `Cover` on the page renders
 * the gradient underneath every photo rather than instead of one.
 *
 * Any problem at all returns null. A poster with a designed placeholder is a fine
 * outcome; a poster that 500s is not.
 */
export async function posterCover(url: string | null): Promise<string | null> {
  if (!url) return null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(COVER_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > COVER_MAX_BYTES) return null;

    const base64 = Buffer.from(bytes).toString("base64");
    return `data:${type.split(";")[0]};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Characters that may not begin a line, and ones that may not end it.
 *
 * Chinese line-breaking in one rule each: a closing mark never starts a line and
 * an opening one never ends it. Without these a line would begin with 「。」 or
 * finish on a dangling 「「」.
 */
const NO_LINE_START = "。，、；：？！）」』》〉】”’%…·";
const NO_LINE_END = "（「『《〈【“‘";

/** How wide one character is, in the full-width units `widthUnits` counts. */
function charUnits(ch: string): number {
  return /[　-〿㐀-鿿豈-﫿＀-￯]/.test(ch)
    ? 1
    : 0.5;
}

/**
 * Units per line when the POSTER breaks its own lines.
 *
 * DERIVED, not tuned: a CJK character is one unit wide at the body size, so the
 * column holds `POSTER_TEXT_WIDTH / paraSize` of them. Latin fits slightly more
 * than the half-width this counts it as — Manrope averages a shade under 0.5em —
 * so Chinese is the tighter case and the one to size against.
 *
 * The 1.4 units held back are insurance: a line that comes out slightly too long
 * makes its row wrap internally, which puts two lines in a box sized for one.
 */
const LINE_BUDGET = POSTER_TEXT_WIDTH / POSTER.paraSize - 1.4;

/**
 * One paragraph, broken into lines HERE rather than by Satori.
 *
 * This began as the machinery behind the highlighter wash, which needed one row
 * per line so a mark could cover exactly the characters on that line. The wash is
 * gone; the line breaking stays, because two things that were side effects of it
 * are worth more than the code costs:
 *
 *   - `posterHeight` COUNTS lines instead of estimating them. The estimate it
 *     replaced divided by a guessed units-per-line and then padded the result,
 *     and a canvas that has to be guessed at is a canvas that clips or empties.
 *   - Chinese line breaking gets the two rules below. Satori's own breaking has
 *     no notion of 避头尾, so a line could begin with 。 or end on a dangling 「.
 *
 * The cost is that the measurement is ours, in the same crude full-width units as
 * everything else here — accurate for Chinese, approximate for Latin, hence the
 * conservative LINE_BUDGET.
 */
export function layoutParagraph(text: string): string[] {
  const lines: string[] = [];
  let start = 0;

  while (start < text.length) {
    let units = 0;
    let at = start;
    // The last index a line could end at, so a long word is not cut mid-way.
    let candidate = -1;

    while (at < text.length) {
      units += charUnits(text[at]);
      if (units > LINE_BUDGET && at > start) break;

      const next = at + 1;
      if (
        next < text.length &&
        (/\s/.test(text[at]) ||
          charUnits(text[at]) === 1 ||
          charUnits(text[next]) === 1) &&
        !NO_LINE_START.includes(text[next]) &&
        !NO_LINE_END.includes(text[at])
      ) {
        candidate = next;
      }
      at += 1;
    }

    const cut = at >= text.length ? text.length : candidate > start ? candidate : at;
    // A leading space would indent the line and a trailing one is dropped at the
    // row's edge anyway, so neither belongs to the line.
    lines.push(text.slice(start, cut).trim());

    // Whitespace at a break belongs to neither line.
    start = cut;
    while (start < text.length && /\s/.test(text[start])) start += 1;
  }

  return lines.length ? lines : [text];
}

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
export function posterHeight(
  summary: SummaryText,
  title: string,
  /** The original headline, when the poster prints it under a Chinese one. Must
   *  be passed whenever the route renders it, or the height stops matching the
   *  image and og:image lies about its own dimensions. */
  original = "",
): number {
  // Every number is one measurement off the rendered poster, so the layout and
  // this arithmetic can be checked against each other. Line heights are
  // `fontSize x line-height`, taken from POSTER and the route's styles.
  const PADDING = (POSTER.pad + 16) * 2;
  /** The chip's text plus its own padding, top and bottom. */
  const DOMAIN_ROW =
    Math.round(POSTER.domainSize * 1.2) + POSTER.domainPadY * 2;
  const BRAND_ROW = 50;
  const CARD_TOP = 34;
  const CARD_PAD = POSTER.cardPad * 2;
  const META_LINE = 21;
  const TITLE_GAP = 10;
  const TITLE_LINE = Math.round(POSTER.titleSize * 1.25);
  const ORIGINAL_GAP = 8;
  const ORIGINAL_LINE = Math.round(POSTER.originalSize * 1.4);
  const THESIS_GAP = 24;
  const THESIS_LINE = Math.round(POSTER.thesisSize * 1.5);
  const PARAS_GAP = 18;
  const PARA_LINE = Math.round(POSTER.paraSize * 1.85);
  const PARA_GAP = 14; // between paragraphs
  const SLACK = 30; // most of a line, so a bad guess never clips

  /**
   * Two column widths, because the headline sits BESIDE the cover and the summary
   * runs under it. Getting these the wrong way round was the old bug this replaces
   * — the title was measured against the full width it does not have.
   */
  const besideCover = POSTER_BESIDE_COVER;
  const linesOf = (text: string, size: number, width: number) =>
    text ? Math.ceil(widthUnits(text) / (width / size - 1)) : 0;

  const titleLines = linesOf(title, POSTER.titleSize, besideCover);
  const originalLines = linesOf(original, POSTER.originalSize, besideCover);
  // The accent bar and its padding take width off the thesis, so it wraps sooner
  // than the paragraphs under it do.
  const thesisWidth = POSTER_TEXT_WIDTH - POSTER.thesisRule - POSTER.thesisPad;
  const thesisLines = linesOf(summary.thesis, POSTER.thesisSize, thesisWidth);

  /**
   * The paragraph line count is COUNTED, not estimated: the route breaks its own
   * lines, so asking `layoutParagraph` how many it produced is the same arithmetic
   * the renderer will do.
   */
  const paragraphs = summary.paragraphs ?? [];
  const bodyLines = paragraphs.reduce(
    (sum, paragraph) => sum + layoutParagraph(paragraph).length,
    0,
  );

  // The cover and the block beside it are centred on each other, so the header row
  // is as tall as whichever is taller.
  const headerText =
    META_LINE +
    TITLE_GAP +
    titleLines * TITLE_LINE +
    (originalLines ? ORIGINAL_GAP + originalLines * ORIGINAL_LINE : 0);

  return Math.round(
    PADDING +
      DOMAIN_ROW +
      POSTER.domainGap +
      BRAND_ROW +
      CARD_TOP +
      CARD_PAD +
      Math.max(POSTER.cover, headerText) +
      THESIS_GAP +
      thesisLines * THESIS_LINE +
      PARAS_GAP +
      bodyLines * PARA_LINE +
      Math.max(0, paragraphs.length - 1) * PARA_GAP +
      SLACK,
  );
}

