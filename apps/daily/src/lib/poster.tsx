import { ImageResponse } from "next/og";
import {
  coverGradient,
  POSTER,
  posterAuthor,
  posterClean,
  POSTER_BESIDE_COVER,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  posterDomain,
  posterPages,
  type PosterRow,
} from "@/lib/share";
// The half of the poster that touches the network and a native module — see the
// note at the top of that file for why the two cannot live together.
import { posterCover, posterFonts, POSTER_MARK, posterText } from "@/lib/poster-assets";
import { SITE } from "@/lib/config";
import { sourceOf } from "@/lib/sources";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import type { Article } from "@/lib/types";

/**
 * The share poster, drawn.
 *
 * SPLIT OUT OF THE ROUTE so the daily job can call it too. The job writes every
 * image to disk the moment a digest is written (see lib/poster-store.ts and the
 * end of jobs/daily.ts), and the route serves those files; a route that also held
 * the layout would have meant either the job going through HTTP to reach its own
 * server or a second copy of 300 lines of JSX. This module knows nothing about
 * requests, responses or caching — it takes an article and a part number and
 * returns PNG bytes.
 *
 * `next/og` works outside a Next server, which is what makes the arrangement
 * possible: `npm run once` is a plain `tsx` process and renders these fine.
 */

/** The page's `<Dot>` between meta items. */
function Dot() {
  return (
    <div
      style={{
        display: "flex",
        width: 7,
        height: 7,
        borderRadius: 4,
        margin: "0 15px",
        background: "#8a83a8",
        opacity: 0.55,
      }}
    />
  );
}

/** How many images this article's share carries. Re-exported so callers that
 *  only need the count do not have to reach past this module. */
export { posterParts } from "@/lib/share";

/**
 * One image of the set, as PNG bytes — or null when `part` is past the end.
 *
 * `?part=1` is the identity card: cover, meta, headline, thesis. Part 2 and up
 * are pages of prose, as many as the summary needs; `posterPages` decides where
 * they break.
 *
 * EVERY PART IS THE SAME 1080x1440. A carousel has to be one shape — see
 * POSTER_WIDTH — and the fixed canvas is also why nothing here computes a height.
 *
 * Satori has no CSS cascade and no `gap` worth relying on: every box that holds
 * more than one child says `display: flex` explicitly, and spacing is margins. It
 * also has no notion of a React fragment as a layout box — a `<>` around two
 * children lays them out in a ROW — so every group here is a real div that names
 * its own direction.
 */
export async function renderPoster({
  article,
  date,
  lang,
  part,
}: {
  article: Article;
  date: string;
  lang: Lang;
  part: number;
}): Promise<Buffer | null> {
  const summary = article.summary.zh;
  const brand = strings(lang).brand;
  const source = sourceOf(article.sourceId);

  /**
   * The pages of prose, and therefore how many images this share has: one for the
   * identity card plus one per page. Resolved before anything is drawn, because it
   * decides whether this part exists at all.
   */
  const pages = posterPages(summary);
  const total = 1 + pages.length;
  if (part < 1 || part > total) return null;
  const rows: PosterRow[] = part === 1 ? [] : pages[part - 2];

  /**
   * Same rule as the page: the Chinese poster leads with the Chinese headline and
   * keeps the original underneath, the English one shows the original alone.
   *
   * CLEANED, like everything else drawn here. `posterPages` cleans the body on its
   * own — it has to, because pagination and the render must agree down to the
   * character — but the headline, the claim and the author never pass through it,
   * and a `≠` in a title sends Satori off to the network exactly as one in a
   * paragraph does.
   */
  const translated = lang === "zh" ? posterClean(article.titleZh ?? "") : "";
  const headline = translated || posterClean(article.title);
  const original = translated ? posterClean(article.title) : "";
  const thesis = posterClean(summary.thesis ?? "");
  const t = strings(lang);
  /**
   * Trimmed to fit the row it shares with the source name, which is the only
   * unbounded thing on this canvas — see `posterAuthor`. Cleaned first, so what
   * gets measured is what gets drawn.
   *
   * The row used to carry a reading time between the two, and dropping it gave the
   * byline back ~130px — six bylines were being truncated across the archive, and
   * now none are.
   */
  const author = posterAuthor(posterClean(article.author ?? ""), source.name);

  // Everything the layout writes itself, so the font subset covers it: the brand,
  // the date, the Chinese headline and the meta line's words. The two star glyphs
  // used to be in here too — a glyph Google was not asked for renders as nothing
  // at all, so anything the layout writes has to be listed.
  // The ellipsis is in there for `posterAuthor`, which may add one to a byline it
  // had to cut. A glyph Google was never asked for renders as nothing at all, so a
  // truncation mark missing from this list would truncate to a blank.
  const meta = [source.name, author, "…"].join(" ");

  const domain = posterDomain(SITE);

  /**
   * The cover photo is fetched ONLY for the part that draws it.
   *
   * A page of prose has no cover, and fetching one anyway meant every image in a
   * four-image share paid for the same download — four times the upstream traffic
   * for one thumbnail. The FONTS are still asked for in full on every part: that
   * subset URL is keyed on the text, so one subset shared by every part is one
   * cache entry, where a per-part subset would be a fresh ~55KB request each.
   */
  const [fonts, cover] = await Promise.all([
    posterFonts(
      posterText(article, summary, `${date}${brand}${translated}${meta}${domain}`),
    ),
    part === 1 ? posterCover(article.image) : Promise.resolve(null),
  ]);

  /**
   * Rendered through a helper that can be called TWICE: once with the cover, and
   * once without it if Satori choked on it.
   *
   * `posterCover` already refuses anything Satori cannot decode, so this should
   * never fire — and it exists because the failure it catches was so bad. A webp
   * cover threw `TypeError: u2 is not iterable` from inside Satori and took the
   * whole image with it: no headline, no thesis, no poster, over a 163px
   * thumbnail. The cover is the least important thing on the card and it was the
   * only thing that could destroy it.
   *
   * Only retried when there WAS a cover. Any other render failure is a real bug in
   * the layout and has to propagate, not be swallowed and half-drawn.
   */
  try {
    return await draw(cover);
  } catch (error) {
    if (!cover) throw error;
    console.error(
      `[daily] poster cover unusable, redrawing without it: ${article.url}`,
      error,
    );
    return await draw(null);
  }

  async function draw(art: string | null): Promise<Buffer> {
  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#fbf3e9",
          color: "#3b3563",
          padding: `${POSTER.pad + 16}px ${POSTER.pad}px`,
          fontFamily: "Manrope, Noto Sans SC",
        }}
      >
        {/* The domain and the date, above the lockup — the page's masthead in the
            same order, where the chip sits over the wordmark with the language
            switch opposite it. The date takes that opposite slot here: a poster
            has no language to switch, and the date is the other thing a reader
            looking at a screenshot weeks later needs.

            THE MASTHEAD IS ON EVERY PART. It is the only thing saying where an
            image came from, and a reader who saves page 3 of a carousel saved the
            page that has no cover on it. */}
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
              padding: `${POSTER.domainPadY}px ${POSTER.domainPadX}px`,
              borderRadius: 999,
              background: "#3b3563",
              color: "#fbf3e9",
              fontSize: POSTER.domainSize,
              fontWeight: 700,
              letterSpacing: POSTER.domainTracking,
            }}
          >
            {domain}
          </div>
          <div
            style={{ display: "flex", fontSize: POSTER.dateSize, color: "#8a83a8" }}
          >
            {date}
          </div>
        </div>

        {/**
         * The mark and the wordmark, the same lockup the page's masthead draws —
         * ON PART 1 ONLY.
         *
         * It used to be on every page, on the argument that a reader who saves one
         * image out of a set needs to know where it came from. That argument is
         * satisfied by the domain chip above, which IS on every page; the lockup on
         * top of it was 99px of repeated branding, and on a canvas that cannot grow
         * it was buying itself one to two lines of the summary per page. So the
         * cover carries the brand and the interior pages carry the address, which
         * is how a deck is normally built.
         *
         * POSTER_FRAME is computed without it for exactly this reason — if the
         * condition here changes, that has to change with it or pagination will
         * plan for space the page does not have.
         */}
        {part === 1 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: POSTER.domainGap,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={POSTER_MARK}
              width={POSTER.markSize}
              height={POSTER.markSize}
              alt=""
            />
            <div
              style={{
                display: "flex",
                marginLeft: POSTER.markGap,
                fontSize: POSTER.brandSize,
                fontWeight: 700,
              }}
            >
              {brand}
            </div>
          </div>
        ) : null}

        {/**
         * THE CARD, filling every pixel between the masthead and the page counter.
         *
         * `flexGrow: 1` ON THE CARD ITSELF, which it was not. The card used to be
         * sized to its contents inside a wrapper that grew, and on a fixed canvas
         * that is a hole: pagination spreads the prose evenly over however many
         * pages it needs, so a 22-line summary over two pages is 11 lines each
         * against a page that holds 15 — and the four paragraphs ended two-thirds
         * of the way down with a third of the image left as bare background.
         *
         * The leftover space has not gone anywhere; it is inside the card now,
         * which is the difference between a page with room on it and an image that
         * stopped early. The alternative was to pack pages full and leave the last
         * one nearly empty, which is the widow this layout already rejected — see
         * `posterPages`.
         *
         * `justifyContent` is the one thing the two kinds of part disagree about.
         * The identity card is a COVER and its content is centred; a page of prose
         * starts at the top, because that is where reading starts.
         */}
        <div
          style={{
            display: "flex",
            flexGrow: 1,
            flexDirection: "column",
            justifyContent: part === 1 ? "center" : "flex-start",
            marginTop: POSTER.cardTop,
            padding: POSTER.cardPad,
            borderRadius: POSTER.radius,
            background: "#f3e8d8",
            // The page's `shadow-soft` and, below, its `shadow-cover`.
            boxShadow: "0 3px 14px rgba(59, 53, 99, 0.06)",
          }}
        >
          {part === 1 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Cover on the left of the meta and the headline, as on the page. */}
              <div style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    display: "flex",
                    width: POSTER.cover,
                    height: POSTER.cover,
                    marginRight: POSTER.coverGap,
                    borderRadius: 23,
                    boxShadow: "0 6px 20px rgba(59, 53, 99, 0.16)",
                    // The gradient is drawn whether or not there is a photo,
                    // exactly as `Cover` does it, so a cover that failed to fetch
                    // degrades to a designed placeholder instead of a hole.
                    backgroundImage: coverGradient(article.id, source.accent),
                    // For the PLACEHOLDER only — the source name sits at the
                    // bottom of the box, as `Cover`'s `items-end` puts it. The
                    // photo needs no alignment: it is the size of the box.
                    alignItems: "flex-end",
                    overflow: "hidden",
                  }}
                >
                  {art ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={art}
                      width={POSTER.cover}
                      height={POSTER.cover}
                      alt=""
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    /**
                     * The padding and the type live HERE, not on the box.
                     *
                     * They were on the box, where the photo inherited them: the
                     * img is POSTER.cover wide, which is the box's OUTER width,
                     * so a pad left it wider than the content area — pushed right
                     * and, with `flex-end`, up, then clipped by `overflow:
                     * hidden`. The result was a photo missing its right and top
                     * edges with a strip of bare gradient down the left and along
                     * the bottom. The page's `Cover` draws the photo full-bleed
                     * and pads only the label layer; this is that, in Satori's
                     * terms.
                     */
                    <div
                      style={{
                        display: "flex",
                        padding: 15,
                        fontSize: 22,
                        fontWeight: 700,
                        color: "rgba(255, 253, 249, 0.95)",
                      }}
                    >
                      {source.name}
                    </div>
                  )}
                </div>

                {/* An explicit width, because Satori has no `min-w-0 flex-1`. */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: POSTER_BESIDE_COVER,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontSize: POSTER.metaSize,
                      fontWeight: 600,
                      color: "#8a83a8",
                    }}
                  >
                    <div style={{ display: "flex", color: source.accent }}>
                      {source.name}
                    </div>
                    {/* No reading time here either — see ArticleCards. */}
                    {author ? (
                      <>
                        <Dot />
                        <div style={{ display: "flex" }}>{author}</div>
                      </>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      marginTop: POSTER.titleGap,
                      fontSize: POSTER.titleSize,
                      fontWeight: 700,
                      lineHeight: 1.25,
                    }}
                  >
                    {headline}
                  </div>

                  {original ? (
                    <div
                      style={{
                        display: "flex",
                        marginTop: POSTER.originalGap,
                        fontSize: POSTER.originalSize,
                        fontWeight: 500,
                        lineHeight: 1.4,
                        color: "#8a83a8",
                      }}
                    >
                      {original}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* The thesis, styled the way `Summary` styles it: weight, colour,
                  and the orange accent bar. The bar lives in both places now —
                  see the `rule` entry in that component's SIZE table. */}
              <div
                style={{
                  display: "flex",
                  marginTop: POSTER.thesisGap,
                  paddingLeft: POSTER.thesisPad,
                  borderLeft: `${POSTER.thesisRule}px solid #efa050`,
                  fontSize: POSTER.thesisSize,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  color: "#3b3563",
                }}
              >
                {thesis}
              </div>
            </div>
          ) : (
            /**
             * ONE ROW PER LINE, broken by `posterPages` rather than by Satori —
             * which is also what lets a page be packed rather than guessed at.
             *
             * A heading is drawn HEAVIER BUT AT THE SAME SIZE AND LINE HEIGHT as
             * the body. That is deliberate: pagination measures every row as one
             * line of `paraSize`, and width measurement ignores weight, so bolding
             * a row cannot make a page hold less than the packing thought it
             * would. A larger heading would.
             *
             * Ink at weight 500, not ink-mid at 400. The page can afford
             * `text-ink-mid` for body copy: it is live text, hinted by the browser
             * at whatever size the reader chose. A poster is a bitmap scaled down
             * by whatever app it lands in, and the two together were too much —
             * the lighter ink lost contrast against the card while the thin
             * strokes lost their pixels, and a Chinese glyph whose strokes are
             * under a pixel is a grey smudge.
             */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: POSTER.paraSize,
                color: "#3b3563",
                lineHeight: 1.85,
              }}
            >
              {rows.map((row, at) => (
                <div
                  key={at}
                  style={{
                    display: "flex",
                    marginTop: row.gap,
                    // The article's opening indent. A margin rather than
                    // `textIndent`, which Satori does not implement — and the line
                    // breaker already took these two characters out of this row's
                    // budget, so the text fits the narrower space it is given.
                    // True on one row per article; see PosterRow.
                    marginLeft: row.indent ? POSTER.indent : 0,
                    fontWeight: row.heading ? 700 : 500,
                  }}
                >
                  {row.text}
                </div>
              ))}
            </div>
          )}
        </div>

        {/**
         * `2/4`, and only when there is more than one image.
         *
         * The row it sits in is part of POSTER_FRAME whether or not anything is
         * drawn in it, so a one-image share puts its card in exactly the place a
         * four-image one does. Worth the 40px: 小红书 draws its own carousel dots,
         * but a reader who saves one image out of a set keeps the image and loses
         * the dots.
         */}
        <div
          style={{
            display: "flex",
            height: POSTER.pageRow,
            alignItems: "flex-end",
            justifyContent: "flex-end",
            fontSize: POSTER.pageSize,
            fontWeight: 700,
            color: "#8a83a8",
          }}
        >
          {total > 1 ? `${part}/${total}` : ""}
        </div>
      </div>
    ),
    { width: POSTER_WIDTH, height: POSTER_HEIGHT, fonts },
  );

  /**
   * Buffered and re-emitted with a LENGTH, rather than returned as it comes.
   *
   * `ImageResponse` is a streaming response, so it goes out chunked with no
   * `content-length` — and an image whose end nothing declares is a broken picture
   * the moment a mobile connection drops a chunk. The reader sees the broken-image
   * glyph, then long-presses it, which re-requests the URL and works: intermittent,
   * per-network, and impossible to reproduce on a desk.
   *
   * Buffering costs one allocation per request and buys a response whose size is
   * stated up front, so a truncated one is detectable rather than merely wrong. It
   * is not proof against a dropped connection — nothing at this layer is — which is
   * why the sheet also retries; see the preview in ShareSheet.
   */
  /**
   * Buffered rather than returned as a stream.
   *
   * The route needs the length so it can declare `content-length` — an image whose
   * end nothing announces is a broken picture the moment a mobile connection drops
   * a chunk — and the job needs the bytes to write a file. One allocation serves
   * both.
   */
  return Buffer.from(await image.arrayBuffer());
  }
}
