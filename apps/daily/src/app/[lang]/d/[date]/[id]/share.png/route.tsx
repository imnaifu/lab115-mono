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
  posterText,
} from "@/lib/share";
import { SITE } from "@/lib/config";
import { sourceOf } from "@/lib/sources";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, isLang } from "@/lib/lang";
import { readArticle } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The same 0–100 → five stars the page's `<Stars>` does, and 0 for an article the
 * summarizer never judged. Duplicated as a number rather than imported, because
 * that component returns JSX with Tailwind classes and Satori has neither.
 */
function starCount(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(5, Math.max(1, Math.round(score / 20)));
}

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
  _req: Request,
  { params }: { params: Promise<{ lang: string; date: string; id: string }> },
) {
  const { lang, date, id } = await params;
  const found = await readArticle(date, id);
  if (!found) return new Response("Not found", { status: 404 });

  const { article } = found;
  // The poster is written in the language of the page that links to it — the
  // brand included, since one language at a time applies here too.
  const posterLang = isLang(lang) ? lang : DEFAULT_LANG;
  const summary = article.summary[posterLang];
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
  const height = posterHeight(summary, headline, original);

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
                alignItems: "flex-end",
                padding: 10,
                fontSize: 15,
                fontWeight: 700,
                color: "rgba(255, 253, 249, 0.95)",
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
                source.name
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

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 18,
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
              guessed. See the note on layoutParagraph. */}
          {(summary.paragraphs ?? []).map((paragraph, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: i === 0 ? 0 : 14,
              }}
            >
              {layoutParagraph(paragraph).map((line, row) => (
                <div key={row} style={{ display: "flex" }}>
                  {line}
                </div>
              ))}
            </div>
          ))}
          </div>
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
