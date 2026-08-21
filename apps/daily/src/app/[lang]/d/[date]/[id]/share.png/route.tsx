import { ImageResponse } from "next/og";
import {
  coverGradient,
  layoutParagraph,
  POSTER,
  POSTER_BESIDE_COVER,
  posterCover,
  POSTER_MARK,
  POSTER_WIDTH,
  posterDomain,
  posterFonts,
  posterHeight,
  posterPart,
  posterText,
} from "@/lib/share";
import { blocksOf } from "@/lib/paragraphs";
import { starCount } from "@/lib/score";
import { SITE } from "@/lib/config";
import { sourceOf } from "@/lib/sources";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, isLang } from "@/lib/lang";
import { readArticle } from "@/lib/store";

export const dynamic = "force-dynamic";

/** The page's `<Dot>` between meta items. */
function Dot() {
  return (
    <div
      style={{
        display: "flex",
        width: 5,
        height: 5,
        borderRadius: 3,
        margin: "0 10px",
        background: "#8a83a8",
        opacity: 0.55,
      }}
    />
  );
}

/**
 * The shareable poster: one article, whole summary, rendered as a PNG.
 *
 * A route handler rather than Next's `opengraph-image` file convention,
 * because that convention wants a STATIC `size` export and this image's height
 * depends on how long the summary is. The page's `generateMetadata` points
 * og:image here and declares the same computed height, so the meta stays true.
 *
 * Satori has no CSS cascade and no `gap` worth relying on: every box that holds
 * more than one child says `display: flex` explicitly, and spacing is margins.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ lang: string; date: string; id: string }> },
) {
  const { lang, date, id } = await params;
  /**
   * Which image of the pair to draw — see PosterPart. No part means the whole
   * poster, which is what og:image and every existing link still ask for, so
   * nothing that predates the split has to know about it.
   */
  const part = posterPart(new URL(req.url).searchParams.get("part"));
  const found = await readArticle(date, id);
  if (!found) return new Response("Not found", { status: 404 });

  const { article } = found;
  // The poster is written in the language of the page that links to it — the
  // brand included, since one language at a time applies here too.
  const posterLang = isLang(lang) ? lang : DEFAULT_LANG;
  const summary = article.summary.zh;
  const brand = strings(posterLang).brand;
  const source = sourceOf(article.sourceId);

  // Same rule as the page: the Chinese poster leads with the Chinese headline and
  // keeps the original underneath, the English one shows the original alone.
  const translated = posterLang === "zh" ? (article.titleZh ?? "") : "";
  const headline = translated || article.title;
  const original = translated ? article.title : "";

  const t = strings(posterLang);
  const stars = starCount(article.score);
  // Everything the layout writes itself, so the font subset covers it: the brand,
  // the date, the Chinese headline, the meta line's words, and the two star glyphs.
  const meta = [
    source.name,
    t.minutesToRead(article.readingMinutes),
    article.author ?? "",
    stars ? "★☆" : "",
  ].join(" ");

  // In the subset request as well as in the layout: an uppercase glyph Google was
  // never asked for renders as nothing at all.
  const domain = posterDomain(SITE);

  const [fonts, cover] = await Promise.all([
    posterFonts(
      posterText(article, summary, `${date}${brand}${translated}${meta}${domain}`),
    ),
    posterCover(article.image),
  ]);
  const height = posterHeight(summary, headline, original, part);

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

            The domain is what makes the image findable. The wordmark under it
            says who made this; only the chip says where to type it. */}
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
          <div style={{ display: "flex", fontSize: 22, color: "#8a83a8" }}>
            {date}
          </div>
        </div>

        {/* The brand is the only thing identifying where this came from now
            that the permalink is gone, so it is set as a wordmark rather than
            the small chip it used to be. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: POSTER.domainGap,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={POSTER_MARK} width={48} height={48} alt="" />
            <div
              style={{
                display: "flex",
                marginLeft: 16,
                fontSize: 40,
                fontWeight: 700,
              }}
            >
              {brand}
            </div>
          </div>
        </div>

        {/* THE CARD, which is the whole point of this layout: the article page puts
            all of this on a `bg-card` panel, so the poster does too, at the same
            radius and the same padding. Everything inside is the page's Tailwind
            value scaled — see POSTER in lib/share.ts. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 34,
            padding: POSTER.cardPad,
            borderRadius: POSTER.radius,
            background: "#f3e8d8",
            // The page's `shadow-soft` and, below, its `shadow-cover`.
            boxShadow: "0 3px 14px rgba(59, 53, 99, 0.06)",
          }}
        >
          {/* THE IDENTITY HALF — cover, meta, headline, thesis. All of part 1,
              none of part 2. It is one box because the split is one seam:
              everything that says WHICH article this is sits above it and the
              prose sits below, which is the same seam the article page draws
              between its header row and the summary under it.

              A REAL DIV, NOT A FRAGMENT. Satori has no cascade and no implicit
              layout: a `<>` around these two put both of them in one row-direction
              box, so the header row collapsed and the thesis was pushed against
              the right edge of the card. The wrapper adds nothing to the height —
              it is a plain column with no padding, and its children keep their own
              margins — but it has to exist and it has to say `column`. */}
          {part !== 2 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Cover on the left of the meta and the headline, as on the page. */}
              <div style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    display: "flex",
                    width: POSTER.cover,
                    height: POSTER.cover,
                    marginRight: POSTER.coverGap,
                    borderRadius: 16,
                    boxShadow: "0 6px 20px rgba(59, 53, 99, 0.16)",
                    // The gradient is drawn whether or not there is a photo, exactly as
                    // `Cover` does it, so a cover that failed to fetch degrades to a
                    // designed placeholder instead of a hole.
                    backgroundImage: coverGradient(article.id, source.accent),
                    // For the PLACEHOLDER only — the source name sits at the bottom of
                    // the box, as `Cover`'s `items-end` puts it. The photo needs no
                    // alignment because it is exactly the size of the box.
                    alignItems: "flex-end",
                    overflow: "hidden",
                  }}
                >
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      width={POSTER.cover}
                      height={POSTER.cover}
                      alt=""
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    /**
                     * The padding and the type live HERE, not on the box.
                     *
                     * They were on the box, where the photo inherited them: the img is
                     * POSTER.cover wide, which is the box's OUTER width, so a 10px pad
                     * left it 20px wider than the content area — pushed 10px right and,
                     * with `flex-end`, 10px up, then clipped by `overflow: hidden`. The
                     * result was a photo missing its right and top edges with a strip of
                     * bare gradient down the left and along the bottom. The page's
                     * `Cover` draws the photo full-bleed (`inset-0 size-full`) and pads
                     * only the label layer; this is that, in Satori's terms.
                     */
                    <div
                      style={{
                        display: "flex",
                        padding: 10,
                        fontSize: 15,
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
                    <Dot />
                    <div style={{ display: "flex" }}>
                      {t.minutesToRead(article.readingMinutes)}
                    </div>
                    {article.author ? (
                      <>
                        <Dot />
                        <div style={{ display: "flex" }}>{article.author}</div>
                      </>
                    ) : null}
                    {stars ? (
                      <>
                        <Dot />
                        <div style={{ display: "flex" }}>
                          <div style={{ display: "flex", color: "#efa050" }}>
                            {"★".repeat(stars)}
                          </div>
                          <div style={{ display: "flex", opacity: 0.4 }}>
                            {"☆".repeat(5 - stars)}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      marginTop: 10,
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
                        marginTop: 8,
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

              {/* The thesis, styled the way `Summary` styles it: weight, colour, and
                  the orange accent bar. The bar lives in both places now — see the
                  `rule` entry in that component's SIZE table. */}
              <div
                style={{
                  display: "flex",
                  marginTop: 24,
                  paddingLeft: POSTER.thesisPad,
                  borderLeft: `${POSTER.thesisRule}px solid #efa050`,
                  fontSize: POSTER.thesisSize,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  color: "#3b3563",
                }}
              >
                {summary.thesis}
              </div>
            </div>
          ) : null}

          {/* THE PROSE HALF — the paragraphs alone, which is all of part 2 and
              none of part 1. A reader who only ever sees the thumbnail gets the
              headline and the claim; this is the image they swipe to. */}
          {part !== 1 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  // 18 is the gap under the thesis, so on part 2 — where the
                  // paragraphs are the card's first child — there is nothing to
                  // sit under and the gap has to go. posterHeight applies
                  // PARAS_GAP by the same rule.
                  marginTop: part === 2 ? 0 : 18,
                  fontSize: POSTER.paraSize,
                  /**
                   * Ink at weight 500, not ink-mid at 400.
                   *
                   * The page can afford `text-ink-mid` for body copy: it is live text,
                   * hinted and antialiased by the browser at whatever size the reader
                   * chose. A poster is a bitmap that gets scaled down by whatever app
                   * it lands in — a chat thread renders these 1000px wide images at a
                   * third of that — and the two together were too much: the lighter
                   * ink lost contrast against the card while the thin strokes lost
                   * their pixels, and a Chinese glyph whose strokes are under a pixel
                   * is a grey smudge. Full ink and one weight up are the same fix
                   * applied to both halves.
                   */
                  color: "#3b3563",
                  fontWeight: 500,
                  lineHeight: 1.85,
                }}
              >
              {/* ONE ROW PER LINE, broken by `layoutParagraph` rather than by Satori —
                  which is also what lets the height above be counted rather than
                  guessed. See the note on layoutParagraph.

                  A heading is drawn HEAVIER BUT AT THE SAME SIZE AND LINE HEIGHT as
                  the body. That is deliberate: the height above counts lines through
                  this same `layoutParagraph`, and width measurement ignores weight,
                  so bolding a block cannot make the image disagree with the height
                  declared for it. A larger heading would. */}
              {blocksOf(summary.text ?? "").map((block, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    marginTop: i === 0 ? 0 : block.kind === "heading" ? 18 : 14,
                    fontWeight: block.kind === "heading" ? 700 : 500,
                  }}
                >
                  {layoutParagraph(block.text).map((line, row) => (
                    <div key={row} style={{ display: "flex" }}>
                      {line}
                    </div>
                  ))}
                </div>
              ))}
              </div>
          ) : null}
        </div>
      </div>
    ),
    { width: POSTER_WIDTH, height, fonts },
  );

  /**
   * Buffered and re-emitted with a LENGTH, rather than returned as it comes.
   *
   * `ImageResponse` is a streaming response, so it goes out chunked with no
   * `content-length` — and a 125–263KB image whose end nothing declares is a
   * broken picture the moment a mobile connection drops a chunk. The reader sees
   * the broken-image glyph, then long-presses it, which re-requests the URL and
   * works: intermittent, per-network, and impossible to reproduce on a desk.
   *
   * Buffering costs one ~200KB allocation per request and buys a response whose
   * size is stated up front, so a truncated one is detectable rather than merely
   * wrong. It is not proof against a dropped connection — nothing at this layer
   * is — which is why the sheet also retries; see the preview in ShareSheet.
   */
  const bytes = await image.arrayBuffer();

  return new Response(bytes, {
    headers: {
      "content-type": "image/png",
      "content-length": String(bytes.byteLength),
      /**
       * An hour of caching, because this route is fetched TWICE per share: the
       * sheet shows the poster as an `<img>` and then hands the same bytes to
       * `navigator.share`. Next's default for a dynamic route is
       * `max-age=0, must-revalidate` with no validator, which made those two full
       * renders of a deterministic image. A digest is written once for its day and
       * never edited, so the only thing that can change inside the hour is an
       * upstream cover photo, which is cosmetic.
       *
       * It also takes the repeat cost off crawlers and link unfurlers, which fetch
       * this the moment a link is posted anywhere.
       */
      "cache-control": "public, max-age=3600",
    },
  });
}
