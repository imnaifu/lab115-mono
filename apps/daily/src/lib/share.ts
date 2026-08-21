import { blocksOf } from "./paragraphs";
import type { SummaryText } from "./types";

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
  /** Chip row → the wordmark lockup under it. */
  domainGap: 29,
  /** The lockup: the mark, and the wordmark beside it. */
  markSize: 70,
  markGap: 23,
  brandSize: 58,
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
  originalSize: 33,
  originalGap: 12,
  /** The accent bar beside the thesis. */
  thesisRule: 6,
  thesisPad: 32,
  thesisSize: 38,
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

/** One drawn line of body text, top to top. */
const PARA_LINE = Math.round(POSTER.paraSize * 1.85);

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
  (Math.round(POSTER.domainSize * 1.2) + POSTER.domainPadY * 2) +
  POSTER.cardTop +
  POSTER.cardPad * 2 +
  POSTER.pageRow;

/**
 * How much of a body page is left for lines, with slack held back.
 *
 * The slack matters more than it did before the canvas was fixed: it cannot grow,
 * so an over-estimate here does not make a taller image, it clips the last line
 * off a page. Under-filling is invisible, so the asymmetry is worth paying for.
 *
 * HALF A LINE, though, not the whole one it was. A full line was picked when
 * nothing had been measured; across every archived summary the tallest page then
 * came out 114px under what the card could hold, which is a line and a half of
 * insurance on top of the 1.4 units `LINE_BUDGET` already holds back horizontally.
 * Two layers of the same guess is one too many.
 */
const BODY_BUDGET = POSTER_HEIGHT - POSTER_FRAME - Math.round(PARA_LINE / 2);

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
 * What the poster's two faces can actually draw: ASCII and Latin-1 from Manrope,
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
 * than the half-width this counts it as — Manrope averages a shade under 0.5em —
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
  // units count Latin at half width and Manrope is a shade under that, so the
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
 */
export function layoutParagraph(text: string, indent = 0): string[] {
  const lines: string[] = [];
  let start = 0;

  while (start < text.length) {
    let units = 0;
    let at = start;
    // Only the line that is actually drawn indented pays for it.
    const budget = lines.length === 0 ? LINE_BUDGET - indent : LINE_BUDGET;
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
export function posterPages(summary: SummaryText): PosterRow[][] {
  const parsed = blocksOf(posterClean(summary.text ?? ""));
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
  const opening = parsed.findIndex((block) => block.kind !== "heading");
  const blocks = parsed.map((block, i) => {
    const heading = block.kind === "heading";
    const indented = i === opening;
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
 * How many images this article's share carries: the identity card, plus one per
 * page of prose.
 *
 * Computed on the SERVER and handed to the share sheet as a number, because the
 * sheet has to build that many URLs and previews and has no summary text to count
 * from — see the `parts` prop on ShareButton.
 */
export function posterParts(summary: SummaryText): number {
  return 1 + posterPages(summary).length;
}
