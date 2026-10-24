import { strings } from "./i18n";
import type { Lang } from "./lang";
import { blocksOf } from "./paragraphs";
// Pure: it imports nothing but types, so the rule below still holds with it here.
import { summaryFor } from "./take";
import type { Article, PublishedArticle, SummaryText } from "./types";

/**
 * The poster's LAYOUT: its canvas, its type scale, its line breaking and its
 * pagination. Arithmetic over strings, and nothing else.
 *
 * NOTHING IN HERE MAY TOUCH THE NETWORK, THE FILESYSTEM OR A NATIVE MODULE, and
 * that is a hard rule with a build error behind it rather than a preference.
 * `posterParts` below is called by ArticleCards, which is reached from DigestBody,
 * which is `"use client"` — so this module is in the browser bundle. When the font
 * fetcher and the cover decoder still lived here, adding `import("sharp")` to the
 * latter made webpack follow it into that bundle and fail on `fs` and
 * `child_process`, and every article page 500'd.
 *
 * Everything that was in violation now lives in lib/poster-assets.ts, which only
 * the renderer and the job import. If something here starts needing I/O, it
 * belongs over there.
 */

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
 * The domain, as the poster prints it: LOWERCASE, the way a URL is actually
 * written and the way the masthead chip on the page now prints it too.
 *
 * The case is applied HERE rather than with `textTransform`, because the string
 * also has to be handed to `posterText` so Google subsets the font with those
 * letters in it — a subset built from one case leaves the other case blank. One
 * transform, done once, used by both. That is why this is still a function doing
 * something that looks redundant against an already-lowercase host: it is the
 * single place the two callers agree on.
 */
export function posterDomain(site: string): string {
  return new URL(site).host.toLowerCase();
}

/**
 * The canvas, FIXED at 小红书's best size: 1080x1440, which is 3:4.
 *
 * 3:4 is the tallest ratio that platform displays without cropping, so it is the
 * most of a phone screen one image can occupy, and 1080 is its native width —
 * an image that arrives at exactly that width is never resampled.
 *
 * FIXED IS THE WHOLE POINT, and it replaces a variable height computed from the
 * summary. A carousel of images has to be one shape: two images of different
 * heights are letterboxed against each other by every app that shows a set, and
 * the reader swiping sees the frame jump. It also retires a standing hazard —
 * the old `posterHeight` had to agree with what the route drew or og:image
 * declared dimensions the image did not have. Now the canvas is a constant and
 * the arithmetic below decides only what FITS on it.
 */
export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1440;

/**
 * The poster's geometry.
 *
 * It USED TO BE the article page's card times 1.45 — same layout, bigger. That
 * premise is gone: the body text is 32px here against the page's 16px, which is
 * 2x, not 1.45x. The poster is not a screenshot of the page any more, it is a
 * carousel card read at arm's length on a phone, and the number it is designed
 * around is LINE LENGTH — 876px of text at 32px is about 25 Chinese characters a
 * line, which is inside the 20-26 that reads comfortably. At the old 22px the
 * same column held 39, and a 39-character line is what "the text looks small"
 * actually means.
 *
 * Everything else here is that 32 scaled by 32/22, rounded — so the proportions
 * of the old design survive at the new size.
 *
 * Kept in this module rather than in the route because the pagination below has
 * to agree with what the route draws, and two copies of these numbers would
 * drift the first time one of them changed. THE GAPS ARE HERE FOR THAT REASON
 * TOO: they used to be literals in both places.
 */
/**
 * The lockup's text metrics, hoisted out of POSTER because `markSize` is derived
 * from them and an object literal cannot read its own fields.
 *
 * BOTH ROWS ARE DRAWN AT `lineHeight: 1`, and that is what lets the arithmetic
 * below describe what the eye actually sees.
 *
 * It used to be Satori's default 1.2, with `markSize` summing the two LINE BOXES.
 * The boxes did add up — and the mark still did not line up with the words, by 6px
 * in Chinese and 12px in English. A line box is the font's ascent and descent, not
 * the glyphs: at 1.2 there is ~6px of leading above a 58px CJK row and ~9px below,
 * so `alignItems: center` put the mark's top edge above the wordmark's cap and its
 * bottom edge above the tagline's, which is the one thing a lockup must not do.
 * Measured off a rendered poster rather than argued from the spec.
 *
 * At `lineHeight: 1` a row is its own em box, the glyphs very nearly fill it, and
 * the mark's edges land on the text's. THE GAP HAD TO GROW TO PAY FOR IT: at 1.2
 * the two rows were 28px apart on the canvas even though this constant said 9,
 * because each box brought its own leading. 18 is what keeps the optical gap close
 * to where it was now that nothing else is padding it.
 */
const BRAND_SIZE = 58;
const TAGLINE_SIZE = 26;
const TAGLINE_GAP = 18;

export const POSTER = {
  /** Canvas edge → card. */
  pad: 58,
  /**
   * The domain chip above the wordmark.
   *
   * It is the one element on the poster that is a chip rather than plain text, so
   * its padding is stated here as well — the frame arithmetic below has to know
   * how tall the row is.
   */
  domainSize: 26,
  domainPadX: 23,
  domainPadY: 9,
  domainTracking: 3,
  /**
   * The masthead row's height, STATED HERE AND SET ON THE ROW rather than left to
   * come out of the chip's own line box.
   *
   * `POSTER_FRAME` used to predict it as `round(domainSize * 1.2) + 2 * domainPadY`
   * = 49, on the assumption that Satori's default line height is 1.2. Measured off
   * a rendered poster the row is 54: the chip's line box comes out at 1.385em, not
   * 1.2em, so every page of prose was planned against a card 5px taller than the
   * one it got.
   *
   * 54 is that measurement, and the renderer now sets it as the row's `height` —
   * which is the whole point of moving it here. A number that PREDICTS what Satori
   * will do is wrong the day Satori changes its mind about a default; a number the
   * layout is told to use cannot drift from the number the arithmetic uses. It is
   * also exactly what the row renders at today, so nothing moves on the canvas.
   */
  domainRow: 54,
  /** Chip row → the wordmark lockup under it. */
  domainGap: 29,
  /**
   * The lockup: the mark, and the wordmark beside it.
   *
   * THE MARK IS EXACTLY AS TALL AS THE COLUMN NEXT TO IT — the wordmark's em box,
   * the gap, and the tagline's — rather than the flat 70 it was, which was the
   * wordmark alone and left the mark floating against the middle of a two-line
   * block. Computed rather than written down so that changing either font size
   * moves the mark with it; the alternative is a number that is right on the day
   * it is typed.
   *
   * The sum is the plain one only because both rows are drawn at `lineHeight: 1`.
   * See the note on BRAND_SIZE above for what happened when they were not.
   */
  markSize: BRAND_SIZE + TAGLINE_GAP + TAGLINE_SIZE,
  markGap: 23,
  brandSize: BRAND_SIZE,
  /**
   * The tagline under the wordmark, on the identity card only.
   *
   * 26 is the domain chip's size, which is the poster's own smallest step, and
   * the gap is measured rather than borrowed — see BRAND_SIZE. Deliberately
   * NOT scaled from the page's 12/14px subtitle: the page sets it against a
   * 36px wordmark and this one sits under a 58px one, so copying the ratio
   * would put it at 19px — under the size at which anything on this canvas is
   * meant to be read at arm's length.
   *
   * It grows the lockup row by roughly 35px and takes that out of the card
   * below, which has `flexGrow: 1`. POSTER_FRAME is untouched on purpose: the
   * lockup is drawn on part 1 only, and part 1 carries no prose to paginate.
   */
  taglineSize: TAGLINE_SIZE,
  taglineGap: TAGLINE_GAP,
  dateSize: 32,
  /** Lockup → card. */
  cardTop: 49,
  /** Inside the card. */
  cardPad: 44,
  radius: 38,
  cover: 163,
  coverGap: 41,
  /**
   * 25, which is 32/22 scaled — and it only fits because the stars are gone.
   *
   * The meta row is the one element here whose width is set by its CONTENT rather
   * than by the canvas. With five star glyphs and a dot in front of them it came
   * to ~730px against the 672 the column beside the cover has, so it wrapped, and
   * wrapping a row of separated items leaves a dangling dot at the end of one line
   * and two orphaned words on the next. It was dropped to 20 for that. Source,
   * reading time and author alone are ~570px, so the row is back at its proper
   * size with room to spare.
   */
  metaSize: 25,
  titleSize: 61,
  titleGap: 15,
  /**
   * The headline's and the original title's leading. They were literals in the
   * renderer, and moved here the day something had to PREDICT the height of the
   * block they set: `posterHeaderHeight` plans a short take's card around it, and
   * a second copy of either number is a card planned for a header it does not get.
   */
  titleLeading: 1.25,
  originalSize: 33,
  originalGap: 12,
  originalLeading: 1.4,
  /** The accent bar beside the thesis. */
  thesisRule: 6,
  thesisPad: 32,
  thesisSize: 38,
  /**
   * The TL;DR label above the thesis, at the page's proportions rather than at
   * numbers of its own: 26/38 is the page's 11px label against its 16px thesis,
   * and the tracking and the gap are that same ratio applied to `tracking-
   * [0.08em]` and `mb-1`. The label is the one part of the lead that has to be
   * legible at thumbnail scale, which is why it is drawn at 700 — see the
   * weights `posterFonts` actually embeds.
   */
  thesisLabelSize: 26,
  thesisLabelTracking: 2,
  thesisLabelGap: 9,
  /** Headline block → thesis. */
  thesisGap: 35,
  paraSize: 32,
  /** Between two paragraphs, and above a section heading — the heading gets the
   *  taller one, exactly as `Summary` gives it `-mb-1` against the page's gap. */
  paraGap: 20,
  /**
   * The opening indent: two characters in, ONCE PER ARTICLE.
   *
   * Not once per paragraph — the full 段首缩进 convention indents every one, and
   * here the paragraphs are already separated by a gap, so indenting each marks
   * the same break twice. Not once per image either, which was tried: the indent
   * says where the writing starts, and it starts once.
   *
   * Two full-width characters, so it is `paraSize * 2` rather than a number of its
   * own. INDENT_UNITS is this in the line breaker's units and has to stay in step
   * with it, and the page's `indent-[2em]` is the same measure in the unit a
   * browser has — see `opening` in Summary.tsx, which picks the same paragraph the
   * same way.
   */
  indent: 64,
  headingGap: 26,
  /** The `2/4` in the bottom corner. Its row is part of the frame whether or not
   *  it is drawn, so a one-image share and a four-image one put the card in the
   *  same place. */
  pageSize: 24,
  pageRow: 40,
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
 * The body copy's leading, and the ONE place it is written down.
 *
 * It used to be the literal 1.85 here and the literal 1.85 in the renderer's
 * `lineHeight`, which is two copies of the number that decides both how tall a
 * drawn row is and how many rows the packer thinks fit. Change one and pagination
 * plans for a page height the poster does not have — the failure being a page
 * whose last line is drawn past the card's edge, which is invisible in the arithmetic
 * and obvious in the PNG. `Summary.tsx` sets the same leading on the page, in the
 * unit Tailwind takes.
 */
export const PARA_LEADING = 1.85;

/**
 * One drawn line of body text, top to top.
 *
 * ROUNDED, and the rounding is not a fudge: Satori lays rows out on whole pixels,
 * and the ink bands on a rendered page are 59px apart to the pixel — `32 * 1.85`
 * is 59.2 and what gets drawn is 59. Measured on both languages, since the leading
 * is a multiple of the font SIZE and so is the same in either face.
 */
const PARA_LINE = Math.round(POSTER.paraSize * PARA_LEADING);

/**
 * Everything on a BODY PAGE that is not the body copy: the two canvas margins,
 * the domain chip's row, the gap down to the card, the card's own padding, and
 * the page counter's row.
 *
 * The route's outer padding is `pad + 16` top and bottom — the extra 16 is there
 * so the chip does not sit on the canvas edge — hence the +16 here.
 *
 * NO WORDMARK LOCKUP, which is `markSize + domainGap` and the single biggest thing
 * that used to be in here. The renderer draws the mark and the brand name on part
 * 1 only: a page of prose is an interior page of a deck, the domain chip above it
 * already says where the image came from, and 99px of masthead repeated on every
 * page was costing between one and two lines of the summary each time. That is the
 * trade — brand furniture, or the text it was framing.
 */
const POSTER_FRAME =
  (POSTER.pad + 16) * 2 +
  POSTER.domainRow +
  POSTER.cardTop +
  POSTER.cardPad * 2 +
  POSTER.pageRow;

/**
 * The paint-rounding allowance, and it is now the ONLY thing held back.
 *
 * It was half a line — 30px — and that was insurance against an arithmetic nobody
 * had checked against a rendered image. Checked, the arithmetic is exact: the ink
 * bands on a page of prose are 59px apart where `PARA_LINE` says 59, a paragraph
 * boundary measures 79 where the model says 79, and the card's bottom edge lands
 * on the pixel `POSTER_FRAME` puts it on. The one term that was wrong is fixed at
 * source — see `POSTER.domainRow`, which was over-predicted by 5px — so the other
 * 25 were buying nothing, and they were not free: they cost a whole page on 36 of
 * the article/language pairs in the archive. One of them put four lines alone on a
 * fourth image while the third sat 249px empty, because a 4-line paragraph missed
 * fitting by 27px of margin that did not exist on the canvas.
 *
 * 8px is what an integer layout can still be off by once at paint time, and there
 * is another ~9px of slack under it that costs nothing: a row's ink sits inside its
 * 59px box, ~9px clear of the bottom, so a page filled to the last pixel loses no
 * ink even if this is wrong by a line's descender.
 *
 * The asymmetry the old comment named is still real — under-filling is invisible,
 * over-filling clips — which is why this is 8 and not 0. What changed is that it is
 * now an allowance for rounding rather than a hedge against the model.
 */
const BODY_SLACK = 8;

/** How much of a body page is left for lines. */
const BODY_BUDGET = POSTER_HEIGHT - POSTER_FRAME - BODY_SLACK;

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

/**
 * Characters that may not begin a line, and ones that may not end it.
 *
 * Chinese line-breaking in one rule each: a closing mark never starts a line and
 * an opening one never ends it. Without these a line would begin with 「。」 or
 * finish on a dangling 「「」.
 */
/**
 * What the poster's two faces can actually draw: ASCII and Latin-1 from Lora,
 * general and CJK punctuation, and the CJK blocks from 思源黑体.
 *
 * Deliberately the same ranges `charUnits` below measures with. A character this
 * does not match is a character the width arithmetic does not know either.
 */
const DRAWABLE =
  /[\u0020-\u007e\u00a0-\u00ff\u2000-\u206f\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;

/**
 * A few symbols worth keeping as words rather than dropping.
 *
 * Small on purpose. The whole archive — two months of summaries — contains
 * exactly two characters this file cannot draw, so this is not a table that wants
 * filling in; it is here so the one that carries meaning in a sentence survives
 * as something readable.
 */
const SUBSTITUTES = new Map([
  ["\u2260", "!="],
  ["\u2264", "<="],
  ["\u2265", ">="],
  ["\u2248", "~"],
  ["\u2192", "->"],
  ["\u2190", "<-"],
]);

/**
 * Text with every character the poster cannot draw taken out of it.
 *
 * SATORI GOES TO THE NETWORK FOR A GLYPH IT CANNOT FIND. That is the bug this
 * exists for: `@vercel/og` reacts to a missing glyph by calling its own
 * `loadGoogleFont` for that one character, which answers 400 for anything the
 * Google Fonts API has no family for — so an article containing `≠` logged a
 * stack trace per render and drew nothing where the symbol should be. The subset
 * request cannot help, because asking Google for a character a font does not have
 * returns a font that still does not have it.
 *
 * Two things get removed. U+FFFD, the replacement character, is dropped outright:
 * it means "a character was lost decoding this" and there is nothing to draw for
 * it — one is sitting in a real archived digest right now. Everything else outside
 * DRAWABLE is either substituted from the table above or dropped.
 *
 * CALLED INSIDE `posterPages`, not by its callers, and that placement is
 * load-bearing: pagination and the renderer must agree on the text down to the
 * character, and `posterParts` is called from a component while the drawing
 * happens in the job. If cleaning were the caller's job, one of them would forget
 * and the sheet would ask for a page the renderer does not produce.
 */
export function posterClean(text: string): string {
  let out = "";
  for (const ch of text) {
    if (ch === "\n" || DRAWABLE.test(ch)) out += ch;
    else out += SUBSTITUTES.get(ch) ?? "";
  }
  return out;
}

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
 * than the half-width this counts it as — Lora's lower case averages 0.542em at
 * 700, a shade over —
 * so Chinese is the tighter case and the one to size against.
 *
 * The 1.4 units held back are insurance: a line that comes out slightly too long
 * makes its row wrap internally, which puts two lines in a box sized for one.
 */
const LINE_BUDGET = POSTER_TEXT_WIDTH / POSTER.paraSize - 1.4;

/**
 * The author, trimmed to whatever room the meta row has left.
 *
 * THE META ROW IS THE ONE CONTENT-SIZED THING ON THE POSTER, and the author is
 * the one part of it that arrives from a feed rather than from config. Everything
 * else has a bound: the canvas is fixed, the summary is paginated, source names
 * are curated in config.json. An author is whatever the byline said — measured
 * over the archive they run 13 to 31 characters, and "Steven Strogatz and Janna
 * Levin" next to "Quanta Magazine" overran the 672px the column beside the cover
 * has. Satori wrapped it, which in a row of dot-separated items means a dangling
 * separator on one line and two orphaned words on the next.
 *
 * Trimmed rather than solved by shrinking the type: the row had already been
 * dropped from 25px to 20 once for this, and 20px only moved the failure to a
 * slightly longer byline. A ceiling holds for any input.
 *
 * The row was tighter still when it carried a reading time as well. That is gone
 * and the space came back here, which is why nothing in the current archive
 * actually gets cut — this is now a guard rather than a routine.
 *
 * Returns "" when there is no usable room, and the caller renders no author and
 * no separator — see the `author` check in lib/poster.tsx.
 */
export function posterAuthor(author: string, source: string): string {
  if (!author) return "";

  // The row's width in units of one full-width character at the meta size, less
  // the one dot between the source and the byline — a 7px circle with 15px of
  // margin on both sides.
  const row = POSTER_BESIDE_COVER / POSTER.metaSize;
  const dot = (7 + 30) / POSTER.metaSize;
  // 1.5 units held back for the same reason LINE_BUDGET holds back 1.4: these
  // units count Latin at half width and Lora's lower case is a shade over that,
  // so the
  // estimate is close rather than exact, and being over is the failure that shows.
  const room = row - dot - widthUnits(source) - 1.5;
  if (room < 2) return "";
  if (widthUnits(author) <= room) return author;

  // An ellipsis costs a unit of its own, and it is the CJK one — the row is set
  // in the same two faces as everything else here.
  let kept = "";
  let used = 1;
  for (const ch of author) {
    const next = used + widthUnits(ch);
    if (next > room) break;
    kept += ch;
    used = next;
  }
  return `${kept.trimEnd()}…`;
}

/** `POSTER.indent` in those same units — two full-width characters. */
const INDENT_UNITS = POSTER.indent / POSTER.paraSize;

/**
 * One paragraph, broken into lines HERE rather than by Satori.
 *
 * This began as the machinery behind the highlighter wash, which needed one row
 * per line so a mark could cover exactly the characters on that line. The wash is
 * gone; the line breaking stays, because two things that were side effects of it
 * are worth more than the code costs:
 *
 *   - `posterPages` COUNTS lines instead of estimating them, so pagination knows
 *     exactly what fits on a fixed canvas. The estimate this replaced divided by
 *     a guessed units-per-line and then padded the result — fine for choosing a
 *     canvas height, useless for deciding where to break a page.
 *   - Chinese line breaking gets the two rules below. Satori's own breaking has
 *     no notion of 避头尾, so a line could begin with 。 or end on a dangling 「.
 *
 * The cost is that the measurement is ours, in the same crude full-width units as
 * everything else here — accurate for Chinese, approximate for Latin, hence the
 * conservative LINE_BUDGET.
 *
 * `indent` is the FIRST LINE's handicap, in the same units — two for a Chinese
 * paragraph, which is drawn 2em in from the margin. It has to be a parameter of
 * the line breaker rather than a style applied afterwards: an indented first line
 * holds two characters fewer, so styling it after the fact would push its last
 * two characters past the column, and Satori would wrap them into a second visual
 * line inside a row sized for one — which also puts the page height the caller
 * counted out of step with the page it drew.
 *
 * `lineBudget` is the column in those units, and it defaults to the prose page's.
 * The one caller that passes its own is a short take drawn on the identity card,
 * which sits in a narrower column (beside the accent bar) and possibly at a
 * smaller size — see `posterCardTake`.
 */
export function layoutParagraph(
  text: string,
  indent = 0,
  lineBudget = LINE_BUDGET,
): string[] {
  const lines: string[] = [];
  let start = 0;

  while (start < text.length) {
    let units = 0;
    let at = start;
    // Only the line that is actually drawn indented pays for it.
    const budget = lines.length === 0 ? lineBudget - indent : lineBudget;
    // The last index a line could end at, so a long word is not cut mid-way.
    let candidate = -1;

    while (at < text.length) {
      units += charUnits(text[at]);
      if (units > budget && at > start) break;

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
 * One drawn line of the summary, ready to be a row on a page.
 *
 * `gap` is the space ABOVE it, and it is non-zero only on a block's first line
 * and only when something sits above it — a block that starts a page starts flush
 * against the card's padding, so the gap is dropped rather than carried over.
 */
export interface PosterRow {
  text: string;
  heading: boolean;
  gap: number;
  /** Drawn 2em in from the margin. True on EXACTLY ONE row per article — the
   *  first line of its opening paragraph — so it is false on every row of every
   *  page after the one that carries it. See POSTER.indent. */
  indent: boolean;
}

/**
 * The summary's body, split into fixed-height pages.
 *
 * PACKED LINE BY LINE, not block by block. Blocks would be the tidier unit and it
 * is the wrong one: `PARA_MAX` keeps a paragraph inside a page today, but nothing
 * in the renderer enforces that, and a block that did not fit would silently run
 * off a canvas that can no longer grow to hold it. Rows are all one height, so
 * packing them cannot overflow.
 *
 * ONE RULE BEYOND FILLING: a heading may not be the last thing on a page. It
 * exists to introduce the paragraph under it, and a reader who has to swipe to
 * find out what it introduced got two images where the layout promised one
 * thought. When a heading's rows fit but the first row of what follows does not,
 * the heading travels to the next page with it.
 */
export function posterPages(summary: SummaryText, lang: Lang): PosterRow[][] {
  const take = takeBlocks(summary, lang);
  const blocks = take.blocks.map((block, i) => {
    const heading = block.kind === "heading";
    const indented = i === take.opening;
    return {
      heading,
      indented,
      // The very first block of the summary has nothing above it anywhere.
      gap: i === 0 ? 0 : heading ? POSTER.headingGap : POSTER.paraGap,
      // Only the line that is drawn indented is broken against a narrower column.
      lines: layoutParagraph(block.text, indented ? INDENT_UNITS : 0),
    };
  });

  /**
   * PACKED TWICE, and the second pass is the point.
   *
   * Filling each page to BODY_BUDGET and starting a new one when it overflows is
   * the obvious way and it produces a WIDOW: a summary needing 3.1 pages puts 0.1
   * of a page on the fourth, which renders as one paragraph alone under the
   * masthead with two-thirds of the canvas empty under it. Measured on a real
   * article: pages of 15, 15, 15 and 2 lines.
   *
   * So the budget decides HOW MANY pages, and then the lines are spread as evenly
   * over that many as the text allows.
   *
   * "As allows" is doing real work there, and the naive version of this was wrong:
   * packing to a flat `total / pages` target CAN NEED MORE PAGES than the greedy
   * pass did, because a page break has to land on a row that the orphan rule and
   * the block boundaries permit — asked for four pages of 12 lines, the same
   * article came back as five. So the target is raised a line at a time until the
   * page count is back down to what the budget actually requires. The first target
   * that fits is the flattest one reachable, the loop is bounded by the budget it
   * walks toward, and greedy is the floor it can always fall back on.
   */
  const greedy = pack(blocks, BODY_BUDGET);
  if (greedy.length < 2) return greedy;

  const total = greedy.reduce((sum, page) => sum + heightOf(page), 0);
  for (
    let target = Math.ceil(total / greedy.length);
    target < BODY_BUDGET;
    target += PARA_LINE
  ) {
    const balanced = pack(blocks, target);
    if (balanced.length <= greedy.length) return balanced;
  }
  return greedy;
}

/**
 * The take's blocks in drawing order, and which one opens the prose.
 *
 * SPLIT OUT OF `posterPages` so the short take on the identity card is drawn from
 * exactly the same blocks a page of prose would be — cleaned the same way, with
 * 「为什么值得读」 appended the same way if a take carries one. The notes below are
 * the ones that lived inline there; nothing about them changed.
 */
function takeBlocks(
  summary: SummaryText,
  lang: Lang,
): { blocks: Array<{ kind: "heading" | "body"; text: string }>; opening: number } {
  const body = blocksOf(posterClean(summary.text ?? ""));
  /**
   * The one block that gets the indent: the first one that is PROSE.
   *
   * ONCE PER ARTICLE. Once per IMAGE was tried — every page of a share opening
   * with the mark, on the argument that each image is seen alone — and it is not
   * what this wants: the indent says "the writing starts here", and it starts
   * once. A page that happens to be second is not a second beginning.
   *
   * Not simply block 0 either. A summary can open on a `## heading`, and a heading
   * is a label rather than the start of the writing, so indenting it would put the
   * mark on something that is not the opening sentence.
   *
   * Being per-article rather than per-page is also what keeps this out of `pack`:
   * the decision depends only on the text, so line breaking can apply the exact
   * handicap below instead of applying it to every paragraph in case.
   */
  const opening = body.findIndex((block) => block.kind !== "heading");
  /**
   * 「为什么值得读」 / "Why it matters", AFTER THE PROSE — the same place the page
   * puts it, under the last paragraph. Its label is a heading row, which buys the
   * orphan rule for free: the label can never sit alone at the foot of a page.
   *
   * Appended AFTER `opening` is found, so a summary with no prose of its own
   * does not hand the indent to this block — it is not where the writing starts.
   *
   * NEVER ON THE IDENTITY CARD. Part 1 stays the thesis alone, for the reason on
   * the thesis block in lib/poster: whoever sees the first image has read
   * nothing. A reader who swiped to the last page has. Absent or empty adds
   * nothing, so a take without the field paginates exactly as it did before.
   *
   * The one way it CAN reach part 1 is a short take that carries one anyway — the
   * short prompt says not to write it — because a short take's whole body is
   * drawn there (see `posterCardTake`), and the label then sits under the take
   * just as it would sit under the prose on a last page. It also counts against
   * the card's room, so a short take with a why mostly falls back to two images.
   */
  const why = posterClean(summary.whyItMatters ?? "").trim();
  const parsed = why
    ? [
        ...body,
        { kind: "heading" as const, text: strings(lang).whyItMatters },
        { kind: "body" as const, text: why },
      ]
    : body;
  return { blocks: parsed, opening };
}

/** The drawn height of one page's rows: every row is a line, plus its own gap. */
function heightOf(page: PosterRow[]): number {
  return page.reduce((sum, row) => sum + row.gap + PARA_LINE, 0);
}

/**
 * Lay the blocks out onto pages no taller than `budget`.
 *
 * ROW BY ROW, not block by block. Blocks would be the tidier unit and it is the
 * wrong one: `PARA_MAX` keeps a paragraph inside a page today, but nothing in the
 * renderer enforces that, and a block that did not fit would silently run off a
 * canvas that can no longer grow to hold it. Rows are all one height, so packing
 * them cannot overflow.
 */
function pack(
  blocks: Array<{
    heading: boolean;
    indented: boolean;
    gap: number;
    lines: string[];
  }>,
  budget: number,
): PosterRow[][] {
  const pages: PosterRow[][] = [];
  let page: PosterRow[] = [];
  let used = 0;

  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
    used = 0;
  };

  blocks.forEach((block, at) => {
    const next = blocks[at + 1];
    /**
     * What this block needs before the page is allowed to start it — its own gap
     * and rows, plus the first row of the block below when this one is a heading.
     * That trailing term IS the orphan rule: without it the heading fits, the
     * paragraph does not, and the page ends on a promise.
     */
    const owed =
      (page.length ? block.gap : 0) +
      block.lines.length * PARA_LINE +
      (block.heading && next ? next.gap + PARA_LINE : 0);
    if (page.length && used + owed > budget) flush();

    block.lines.forEach((text, row) => {
      const gap = row === 0 && page.length ? block.gap : 0;
      // A block long enough to outrun a page on its own splits here rather than
      // overflowing. PARA_MAX means it should not happen; the canvas is fixed, so
      // "should not" is not a good enough reason to let it clip.
      if (page.length && used + gap + PARA_LINE > budget) flush();
      page.push({
        text,
        heading: block.heading,
        gap: page.length ? gap : 0,
        // The opening paragraph's first line and nothing else. A paragraph that
        // spills onto the next page resumes flush either way: the indent marks
        // where the prose STARTS, not the top of a column.
        indent: row === 0 && block.indented,
      });
      used += gap + PARA_LINE;
    });
  });

  flush();
  return pages;
}

/**
 * The headline the identity card prints, and the original title under it.
 *
 * Same rule as the page: the Chinese poster leads with the Chinese headline and
 * keeps the original underneath, the English one leads with OUR English rewrite
 * and keeps the original underneath too; with no rewrite, the original alone.
 *
 * CLEANED, like everything else drawn there — the headline never passes through
 * `posterPages`, and a `≠` in a title sends Satori off to the network exactly as
 * one in a paragraph does.
 *
 * HERE RATHER THAN IN THE RENDERER since a short take's card has to be planned
 * around the header's height (see `posterHeaderHeight`), and the planner and the
 * renderer have to be measuring the same two strings. `translated` is returned
 * as well because the renderer hands it to the font subset.
 */
export function posterHeadline(
  article: Article,
  lang: Lang,
): { headline: string; original: string; translated: string } {
  // Our rewrite in the poster's own language, same rule as the page.
  const translated = posterClean(
    (lang === "zh" ? article.titleZh : article.titleEn) ?? "",
  );
  return {
    headline: translated || posterClean(article.title),
    original: translated ? posterClean(article.title) : "",
    translated,
  };
}

/**
 * The height of the meta row over the headline (source · author), as Satori lays
 * it out: the row sets no line height, so it gets the faces' own line box.
 *
 * MEASURED, the way `POSTER.domainRow` was, off rendered identity cards — see the
 * calibration note on `posterHeaderHeight` — and it is the TALLEST row measured,
 * not the usual one: most come out ~5px shorter, and the planner wants the bound.
 * Not set on the row in the renderer, as `domainRow` is, because that would move
 * the headline on every long poster too, and those must not move.
 */
const META_ROW = 37;

/**
 * Lora's advance widths for printable ASCII (U+0020–U+007E, in order), in
 * thousandths of an em — at 500 for the original title and at 700 for the
 * headline, the two weights Satori wraps on the identity card.
 *
 * READ OUT OF THE FONT FILES, not guessed: the `hmtx` table of the Lora TTFs
 * Google serves `posterFonts`, via the same legacy-UA request. Two flat guesses
 * came first and both were wrong where it mattered. A flat 0.6em per character
 * put a headline a line taller than drawn on a third of the English posters in
 * two weeks of archive, which plans a short take one size smaller than it needs;
 * class averages (capitals 0.7, the rest 0.56) still did that, AND under-counted
 * one headline by a line, which is the direction that overflows the card.
 * Headlines here sit close to a line boundary often enough that the average is
 * not the number — the letters are.
 *
 * If the poster ever changes its Latin face, these tables change with it.
 */
const LORA_500 = [
  263, 263, 339, 844, 549, 881, 687, 201, 302, 302, 524, 530, 252, 483, 242,
  693, 626, 378, 536, 558, 544, 543, 577, 464, 565, 577, 250, 264, 530, 530,
  530, 484, 795, 640, 635, 695, 750, 623, 556, 759, 789, 352, 399, 693, 587,
  936, 766, 786, 617, 787, 647, 577, 643, 755, 671, 1002, 666, 645, 608, 368,
  693, 368, 823, 763, 343, 519, 579, 527, 597, 541, 348, 554, 606, 296, 275,
  556, 285, 903, 617, 579, 598, 575, 449, 470, 396, 604, 516, 804, 536, 536,
  512, 345, 240, 345, 530,
];
const LORA_700 = [
  263, 258, 326, 871, 588, 904, 670, 188, 296, 296, 533, 530, 250, 471, 233,
  699, 636, 406, 533, 560, 547, 540, 575, 469, 572, 576, 250, 267, 530, 530,
  530, 503, 793, 668, 661, 688, 759, 624, 571, 754, 807, 387, 451, 712, 604,
  972, 773, 769, 639, 770, 686, 598, 650, 760, 708, 1016, 699, 667, 604, 386,
  699, 386, 823, 832, 524, 524, 573, 518, 596, 538, 369, 557, 621, 327, 302,
  594, 312, 920, 638, 566, 601, 573, 480, 485, 413, 618, 538, 811, 548, 551,
  514, 368, 259, 368, 530,
];

/**
 * One non-CJK character's advance in ems, at the weight it is drawn in.
 *
 * Outside ASCII — an accented letter, a curly quote, an em dash — a whole em,
 * which is wider than anything Lora draws there. Those are a handful of
 * characters a year in a headline, and over-counting is the safe direction.
 */
function latinEm(ch: string, table: number[]): number {
  const at = ch.charCodeAt(0) - 0x20;
  return at >= 0 && at < table.length ? table[at] / 1000 : 1;
}

/**
 * How many lines Satori will wrap `text` into, at `size`px in a `width`px column.
 *
 * AN ESTIMATE, unlike `layoutParagraph`, because these blocks are not broken by
 * us — the headline is one `<div>` and Satori wraps it. So this imitates the
 * wrapper rather than replacing it: a Latin word never splits, a CJK character is
 * its own break opportunity, and a closing mark (NO_LINE_START) stays glued to
 * whatever precedes it — as an opening one (NO_LINE_END) does to whatever
 * follows — which are the rules Satori's breaker applies to Chinese that a plain
 * character count would miss.
 */
function wrappedLines(
  text: string,
  size: number,
  width: number,
  table: number[],
): number {
  if (!text) return 0;
  // Unbreakable runs: the ink, and the space after it. The space is kept apart
  // because a line may END on it without the space having to fit — Satori does
  // not count a trailing space against the column.
  const runs: Array<{ ink: number; space: number }> = [];
  let ink = 0;
  let previousWide = false;
  let previousOpening = false;
  for (const ch of text) {
    const wide = charUnits(ch) === 1;
    const advance = size * (wide ? 1 : latinEm(ch, table));
    if (/\s/.test(ch)) {
      runs.push({ ink, space: advance });
      ink = 0;
    } else if (NO_LINE_START.includes(ch) || previousOpening) {
      // A closing mark never starts a line and an opening one never ends it, so
      // either way this character joins the run it follows.
      ink += advance;
    } else if (wide || previousWide) {
      // A break opportunity on both sides of a CJK character.
      if (ink) runs.push({ ink, space: 0 });
      ink = advance;
    } else {
      ink += advance;
    }
    previousWide = wide;
    previousOpening = NO_LINE_END.includes(ch);
  }
  if (ink) runs.push({ ink, space: 0 });

  let lines = 1;
  let used = 0;
  for (const run of runs) {
    if (used && used + run.ink > width) {
      lines += 1;
      used = 0;
    }
    // A run wider than the column on its own is split by Satori; count it whole
    // lines rather than one.
    if (run.ink > width) {
      lines += Math.ceil(run.ink / width) - 1;
      used = run.ink % width;
    } else {
      used += run.ink;
    }
    used += run.space;
  }
  return lines;
}

/**
 * The identity card's header — the cover and, beside it, the meta row, the
 * headline and the original title — as tall as it will be drawn.
 *
 * The cover is a fixed square and the column beside it is centred against it, so
 * the header is whichever of the two is taller.
 *
 * CALIBRATED AGAINST RENDERED POSTERS, not just argued from the constants: the
 * long take's identity card is centred in its card, so the accent bar's top and
 * bottom edges give away exactly how tall the header above it was. Every
 * published article from 2026-10-08 to 10-21 was checked that way in both
 * languages — 266 posters — and this estimate came out at or above the drawn
 * header on every one, which is the only direction it is allowed to be wrong in:
 * by 1–6px on 260 of them and by one line on the other 6.
 */
export function posterHeaderHeight(article: Article, lang: Lang): number {
  const { headline, original } = posterHeadline(article, lang);
  const title =
    wrappedLines(headline, POSTER.titleSize, POSTER_BESIDE_COVER, LORA_700) *
    POSTER.titleSize *
    POSTER.titleLeading;
  const under = original
    ? POSTER.originalGap +
      wrappedLines(original, POSTER.originalSize, POSTER_BESIDE_COVER, LORA_500) *
        POSTER.originalSize *
        POSTER.originalLeading
    : 0;
  return Math.ceil(
    Math.max(POSTER.cover, META_ROW + POSTER.titleGap + title + under),
  );
}

/**
 * The identity card's own inside height: the canvas less everything part 1 draws
 * around the card — the margins, the domain row, the lockup, the gap down to the
 * card, the card's padding and the page counter's row.
 *
 * POSTER_FRAME's sibling for part 1, and it differs from it by exactly the
 * lockup (`domainGap + markSize`), which is drawn on part 1 only. 930px today.
 */
const CARD_INNER =
  POSTER_HEIGHT -
  (POSTER.pad + 16) * 2 -
  POSTER.domainRow -
  POSTER.domainGap -
  POSTER.markSize -
  POSTER.cardTop -
  POSTER.cardPad * 2 -
  POSTER.pageRow;

/**
 * The column a short take is drawn in on the identity card: the card's text width
 * less the accent bar and its padding, which is the box the thesis sits in.
 */
const TAKE_WIDTH = POSTER_TEXT_WIDTH - POSTER.thesisRule - POSTER.thesisPad;

/**
 * The sizes a short take may be set at on the identity card, largest first.
 *
 * 32 is the prose page's own size, and most short takes get it. The steps under
 * it exist for the long end of the band — 160 Chinese characters under a
 * three-line headline, or the English take, which runs about three times the
 * characters at half the width each — and they stop at 26, which is the poster's
 * smallest step anywhere (the domain chip, the tagline): under that, nothing on
 * this canvas is meant to be read at arm's length. See POSTER.taglineSize.
 */
const TAKE_SIZES = [32, 30, 28, 26];

/** A short take, laid out for the identity card: its size and its rows. */
export interface PosterCardTake {
  size: number;
  rows: PosterRow[];
}

/**
 * A SHORT take, drawn on the identity card IN PLACE OF THE THESIS — or null, and
 * the share keeps the card + pages of prose it always had.
 *
 * WHY A SHORT TAKE GETS ONE IMAGE. It is 80–160 characters in two to four short
 * paragraphs, and as a page of prose that is six lines at the top of a card built
 * to hold fifteen: a second image that is mostly empty plate, which is the widow
 * `posterPages` already refuses to draw, at the scale of a whole page.
 *
 * WHY IN PLACE OF THE THESIS AND NOT UNDER IT, which was the first thing tried and
 * was decided by measuring rather than by taste. The card has 930px inside it. A
 * real header (two- or three-line headline plus the original) is 300–380 of those,
 * the thesis with its gap another ~200, and the sample take — 4 paragraphs, ~170
 * characters — 591 at the prose size. That is ~1,200px into 930: the thesis and the
 * take do not fit together at a size anyone can read, and keeping both would mean
 * setting the take at about 22px, under the canvas's own floor. Without the thesis
 * the same take fits at 32px with room to spare.
 *
 * And the thesis is the line a short take can best spare. The short prompt opens
 * the take with the event itself — 「第一句就说事」 — so the take's first sentence
 * already does the thesis's job on this card: it says what happened, to a reader
 * who has read nothing. The accent bar STAYS, now beside the take, because its job
 * is unchanged — it marks where the piece stops being described and starts being
 * ours.
 *
 * NO OPENING INDENT, unlike a page of prose. The indent says "the writing starts
 * here", and on this card the bar already says it; marking one beginning twice is
 * the same argument that keeps the indent off every paragraph but the first.
 *
 * NULL in three cases, and all three are the old layout, unchanged: an article
 * that is not `form: "short"` (the long read, and every archived article, which
 * has no `form` at all), a short take with no body to draw, and a short take too
 * long to fit at even the smallest size — a guard, not a routine, since the
 * prompt's band is well inside what fits. Overflowing a fixed canvas is the one
 * outcome worse than a second image.
 */
export function posterCardTake(
  article: PublishedArticle,
  lang: Lang,
): PosterCardTake | null {
  if (article.form !== "short") return null;
  const take = takeBlocks(summaryFor(article, lang), lang);
  if (!take.blocks.length) return null;

  // BODY_SLACK for the same reason a page of prose holds it back: an integer
  // layout can still be a few pixels off at paint time, and over-filling clips.
  const room =
    CARD_INNER - posterHeaderHeight(article, lang) - POSTER.thesisGap - BODY_SLACK;

  for (const size of TAKE_SIZES) {
    // Rounded UP here where PARA_LINE rounds to nearest: that one was checked
    // against the pixels at 32px only, and over-planning a row by a fraction is
    // the safe direction at the sizes nobody has measured.
    const line = Math.ceil(size * PARA_LEADING);
    // The same 1.4 units of insurance LINE_BUDGET holds back, at this size.
    const budget = TAKE_WIDTH / size - 1.4;
    const rows: PosterRow[] = [];
    take.blocks.forEach((block, at) => {
      const heading = block.kind === "heading";
      layoutParagraph(block.text, 0, budget).forEach((text, row) => {
        rows.push({
          text,
          heading,
          gap:
            row === 0 && at > 0
              ? heading
                ? POSTER.headingGap
                : POSTER.paraGap
              : 0,
          indent: false,
        });
      });
    });
    const height = rows.reduce((sum, row) => sum + row.gap + line, 0);
    if (height <= room) return { size, rows };
  }
  return null;
}

/**
 * How many images this article's share carries: the identity card, plus one per
 * page of prose — or the card alone, when a short take fits on it (see
 * `posterCardTake`).
 *
 * Computed on the SERVER and handed to the share sheet as a number, because the
 * sheet has to build that many URLs and previews and has no summary text to count
 * from — see the `parts` prop on ShareButton.
 *
 * TAKES THE ARTICLE, where it used to take one language's `SummaryText`. Whether
 * the take is short lives on the article (`form`), and so does the headline the
 * fit is measured against; a caller handing over the summary alone could not be
 * told, and would count two images for a share the renderer draws as one — the
 * sheet would then ask for a part 2 that 404s.
 */
export function posterParts(article: PublishedArticle, lang: Lang): number {
  if (posterCardTake(article, lang)) return 1;
  return 1 + posterPages(summaryFor(article, lang), lang).length;
}
