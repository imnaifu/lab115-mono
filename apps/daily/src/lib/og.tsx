import { ImageResponse } from "next/og";
import { SITE } from "./config";
import { strings } from "./i18n";
import type { Lang } from "./lang";
import { POSTER_MARK, posterFonts } from "./poster-assets";
import { OG_HEIGHT, OG_WIDTH } from "./seo";
import { posterClean, posterDomain } from "./share";

/**
 * The link-preview card: 1200x630, drawn for the pages that are LISTS.
 *
 * WHY THIS EXISTS BESIDE lib/poster.tsx RATHER THAN INSIDE IT. The poster is a
 * 3:4 carousel image of one article, and an article page rightly points at it —
 * part 1 is already a headline card. Every other page had no image at all, so
 * `daily.lab115.com`, `/archive` and every `/d/<date>` unfurled as a line of grey
 * text in the one place this site is actually passed around: a chat thread. This
 * file is the smallest thing that fixes that, and it is separate because almost
 * nothing is shared — a different canvas, a different ratio, no cover photo, no
 * pagination, no per-article layout table.
 *
 * What IS shared is the expensive part: `posterFonts` and `POSTER_MARK` from
 * lib/poster-assets, so the card is drawn in the same two faces as the poster and
 * the mark on it is the same artwork. See the note there for why Satori cannot
 * simply use the stylesheet the site loads.
 *
 * SERVER ONLY, like poster.tsx: `next/og` and the font fetcher have no business in
 * a browser bundle. Nothing client-side imports this.
 */

/** The palette, the same six values poster.tsx draws with. */
const CREAM = "#fbf3e9";
const INK = "#3b3563";
const SOFT = "#8a83a8";
const ORANGE = "#efa050";

/**
 * The card's geometry. Sized off the HEADLINE, the same way the poster is sized
 * off its body copy: 34px over a ~1000px column is about 29 Chinese characters a
 * line, which is inside the range that reads at thumbnail scale — and a link
 * preview is only ever seen at thumbnail scale.
 */
const CARD = {
  padX: 72,
  padY: 64,
  chipSize: 24,
  chipPadX: 20,
  chipPadY: 8,
  chipTracking: 3,
  metaSize: 26,
  markSize: 60,
  markGap: 20,
  brandSize: 50,
  brandGap: 38,
  headlineSize: 34,
  /** The orange rule in front of each headline, and its gap. */
  ruleWidth: 5,
  ruleGap: 18,
  headlineGap: 22,
  taglineSize: 24,
} as const;

/**
 * How many headlines fit, and it is three.
 *
 * Not "as many as there are". A day holds around twenty, the canvas holds four
 * lines of 34px between the lockup and the tagline, and a card crammed to its
 * edges is one nobody reads a single line of. Three is also what the day page's
 * `description` already truncates to, so the card and the meta agree.
 */
const HEADLINES = 3;

/** How wide one character is, in the full-width units below. Mirrors `charUnits`
 *  in lib/share.ts, which is private to that module's line breaker. */
function charUnits(ch: string): number {
  return /[　-〿㐀-鿿豈-﫿＀-￯]/.test(ch) ? 1 : 0.5;
}

/**
 * One line's worth of `text`, with an ellipsis if it did not fit.
 *
 * Satori has no `text-overflow`, so a headline that overruns the column wraps to a
 * second line and pushes the card's whole stack down past the canvas. Truncating
 * here is not a nicety, it is what keeps the layout inside 630px.
 */
function oneLine(text: string, budget: number): string {
  let used = 0;
  for (const [at, ch] of [...text].entries()) {
    used += charUnits(ch);
    // The ellipsis is one full-width character, so leaving 1 unit is exact.
    if (used > budget - 1) return [...text].slice(0, at).join("") + "…";
  }
  return text;
}

/** The column a headline is drawn into, in `headlineSize` units. */
const HEADLINE_BUDGET =
  (OG_WIDTH - CARD.padX * 2 - CARD.ruleWidth - CARD.ruleGap) / CARD.headlineSize;

export interface OgCard {
  lang: Lang;
  /** The line beside the domain chip: a date, or a count of archived days. */
  meta: string;
  /** Up to `HEADLINES` are drawn; an empty list gives the brand card. */
  headlines: string[];
}

/**
 * The card, as PNG bytes.
 *
 * Buffered rather than returned as a stream, for the reason poster.tsx spells out
 * at length: the route has to declare `content-length`, or a dropped chunk on a
 * mobile connection shows the reader a broken-image glyph instead of a short
 * image.
 */
export async function renderOgCard({ lang, meta, headlines }: OgCard): Promise<Buffer> {
  const t = strings(lang);
  const domain = posterDomain(SITE);
  const brand = posterClean(t.brand);
  const tagline = posterClean(t.tagline);

  /**
   * CLEANED AND TRUNCATED BEFORE THE SUBSET IS ASKED FOR, not after.
   *
   * Both halves matter. `posterClean` drops the characters these two faces have no
   * glyph for — ask Google for one and it returns a font that still lacks it, and
   * then Satori goes to the network per missing character. And the truncation has
   * to happen first because the subset must cover exactly what is DRAWN: request
   * the characters of a full headline, draw a shortened one, and the difference is
   * bytes paid for nothing.
   */
  const lines = headlines
    .slice(0, HEADLINES)
    .map((headline) => oneLine(posterClean(headline), HEADLINE_BUDGET));

  /**
   * Every glyph the card will draw, and nothing else.
   *
   * `posterFonts` must be called with ONE image's text — see the note there: past
   * roughly 250 distinct characters Google stops subsetting and hands back the
   * whole 10 MB face. A card is a brand name, a date, three headlines and a
   * tagline, which is comfortably inside that.
   *
   * The trailing literal is the punctuation and digits the LAYOUT adds rather than
   * the content: the ellipsis `oneLine` may append, the domain's dot, and the
   * digits of a date. A glyph that was not asked for draws as nothing at all, so an
   * omission here is invisible rather than obviously broken.
   */
  const text = posterClean(
    [domain, meta, brand, tagline, ...lines, "0123456789…·—、。，：；？！%/"].join(""),
  );

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: CREAM,
          color: INK,
          padding: `${CARD.padY}px ${CARD.padX}px`,
          fontFamily: "Manrope, Noto Sans SC",
        }}
      >
        {/* The domain chip and the meta line, in the same relationship the page's
            masthead and the poster's put them: the chip says where the image came
            from, and the slot opposite says which day it is about. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: `${CARD.chipPadY}px ${CARD.chipPadX}px`,
              borderRadius: 999,
              background: INK,
              color: CREAM,
              fontSize: CARD.chipSize,
              fontWeight: 700,
              letterSpacing: CARD.chipTracking,
            }}
          >
            {domain}
          </div>
          <div style={{ display: "flex", fontSize: CARD.metaSize, color: SOFT }}>
            {meta}
          </div>
        </div>

        {/* The lockup, the same mark-beside-wordmark the poster draws on part 1. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: CARD.markGap,
            marginTop: CARD.brandGap,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws
              `img` and not inline `svg`, and it has no filesystem; the mark is a
              data URI for that reason. See POSTER_MARK. */}
          <img src={POSTER_MARK} width={CARD.markSize} height={CARD.markSize} alt="" />
          <div style={{ display: "flex", fontSize: CARD.brandSize, fontWeight: 700 }}>
            {brand}
          </div>
        </div>

        {/**
         * The headlines, or nothing.
         *
         * `flex: 1` on this block and the tagline pinned under it, so a card with
         * one headline and a card with three both close on the same line in the
         * same place — a set of previews from different days should not look like
         * a set of different templates.
         */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            gap: CARD.headlineGap,
          }}
        >
          {/* Keyed by POSITION, not by the text: two headlines can truncate to the
              same string — the same story covered twice, or a long shared prefix
              cut at the same point — and a duplicate key is a React warning for a
              list whose order is fixed anyway. */}
          {lines.map((line, at) => (
            <div key={at} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  width: CARD.ruleWidth,
                  height: CARD.headlineSize,
                  marginRight: CARD.ruleGap,
                  borderRadius: 999,
                  background: ORANGE,
                }}
              />
              <div
                style={{
                  display: "flex",
                  fontSize: CARD.headlineSize,
                  fontWeight: 700,
                  lineHeight: 1.25,
                }}
              >
                {line}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", fontSize: CARD.taglineSize, color: SOFT }}>
          {tagline}
        </div>
      </div>
    ),
    { width: OG_WIDTH, height: OG_HEIGHT, fonts: await posterFonts(text) },
  );

  return Buffer.from(await image.arrayBuffer());
}

/**
 * The HTTP half, stated once for both card routes.
 *
 * The LENGTH is the whole reason this is a function rather than `return image`:
 * see renderOgCard above, and the longer version of the same lesson in
 * share.png/route.tsx.
 *
 * An hour of caching, matching the poster route. A card is fetched the moment a
 * link is posted anywhere, often by several unfurlers at once for the same URL,
 * and the only thing that can change inside the hour is the digest a card drawn
 * from `readLatest` is showing — which is exactly the case `max-age` should be
 * short enough to catch and an hour is.
 */
export function ogPng(bytes: Buffer): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/png",
      "content-length": String(bytes.byteLength),
      "cache-control": "public, max-age=3600",
    },
  });
}
