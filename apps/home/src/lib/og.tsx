import { ImageResponse } from "next/og";
import { PRODUCTS } from "@/data/products";
import { SITE } from "./config";
import { strings } from "./i18n";
import type { Lang } from "./lang";
import { OG_HEIGHT, OG_WIDTH } from "./seo";

/**
 * The link-preview card, 1200x630.
 *
 * WHAT IT REPLACES: nothing. There was no og:image and no twitter card at all, so
 * a link to lab115.com posted in a chat thread or a tweet rendered as a line of
 * grey text — for a site whose entire job is to be the front door of a brand, the
 * one image that represents it everywhere it is mentioned was simply absent.
 *
 * DARK, like the hero. The page opens on a fixed black canvas in both appearances
 * (see the NIGHT tokens in index.css) because that is the shot a product page
 * opens with, and a preview card is that same opening shot seen somewhere else. A
 * card drawn in the light palette would be a third appearance nobody designed.
 *
 * SERVER ONLY: `next/og` and the font fetcher below have no business in a browser
 * bundle. Only the route imports this.
 */

/** The NIGHT tokens, the three of them this card uses. See index.css. */
const NIGHT = "#000000";
const NIGHT_INK = "#f5f5f7";
const NIGHT_SOFT = "#a1a1a6";

const CARD = {
  padX: 88,
  padY: 76,
  /** The lockup: the mark, and the wordmark beside it. Ratio from Logo.tsx. */
  markHeight: 40,
  markGap: 22,
  brandSize: 40,
  domainSize: 26,
  /** The hero line, which is what the card is mostly made of. */
  titleSize: 82,
  titleLeading: 1.06,
  shelfSize: 28,
} as const;

/**
 * The mark, inlined as a data URI.
 *
 * Satori draws `<img>` but not inline `<svg>`, and it has no filesystem, so
 * `LogoMark` cannot simply be rendered here. This is that component's three paths
 * at the same geometry with the stroke resolved to `--color-night-ink` — the mark
 * is drawn with `currentColor` on the page, and there is no `currentColor` in an
 * image. If Logo.tsx's geometry changes, regenerate this; nothing enforces that
 * the two agree, which is the same standing hazard apps/daily notes on POSTER_MARK.
 */
const MARK =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NiAyOCI+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjVmNWY3IiBzdHJva2Utd2lkdGg9IjgiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCI+PHBhdGggZD0iTTQgNFYyNCIvPjxwYXRoIGQ9Ik0xOCA0VjI0Ii8+PHBhdGggZD0iTTMyIDRhMTAgMTAgMCAwIDEgMCAyMCIvPjwvZz48L3N2Zz4=";

/**
 * Fonts for the card, fetched as subsets.
 *
 * THIS IS THE ONE PLACE THIS SITE DOWNLOADS A FONT, and it is not a contradiction
 * of index.css's "nothing is downloaded — a webfont would only delay the one thing
 * this page is made of, text". That rule is about the PAGE. This is an image
 * rendered on the server, and Satori needs real font data: it cannot use a CSS
 * `@font-face`, and it has no access to the system faces the page asks for. So the
 * choice is not "webfont or SF Pro", it is "webfont or no card".
 *
 * INTER stands in for the system face. It is the closest thing on Google Fonts to
 * SF Pro's proportions at display sizes, which is what matters for a card that
 * sits beside the real thing.
 *
 * The mechanism — the `text=` parameter and the deliberately ancient User-Agent —
 * is lifted from apps/daily's lib/poster-assets.ts, and the long version of why
 * each part is necessary is there. The short version: `text=` returns a face
 * subsetted to exactly the characters asked for, which is the only way to use 思源
 * 黑体 at all (the full face is over 10 MB), and Google picks the FORMAT from the
 * User-Agent — a modern one gets woff2, which Satori cannot read, while Android
 * 2.3 gets ttf, which it can.
 */
const LEGACY_UA =
  "Mozilla/5.0 (Linux; U; Android 2.3; en-us) AppleWebKit/533.1 " +
  "(KHTML, like Gecko) Version/4.0 Mobile Safari/533.1";

const FONT_TIMEOUT_MS = 8000;
const FONT_TRIES = 3;

/**
 * The card's text never changes for a given language, so ONE cache entry per
 * language's worth of glyphs is the whole working set — a plain Map with no bound,
 * unlike daily's, where the text is per-article and an unbounded map would grow
 * with the archive.
 */
const fontCache = new Map<string, ArrayBuffer>();

/** A GET with a timeout and a retry, because a card that 500s shows no image and
 *  a transient connect failure against a CDN is the likeliest way to get one. */
async function get(url: string): Promise<Response> {
  let last: unknown;
  for (let attempt = 1; attempt <= FONT_TRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": LEGACY_UA },
        signal: AbortSignal.timeout(FONT_TIMEOUT_MS),
      });
      // Checked, because Google answers 429 with an HTML body — and the regex
      // below would then report "no font url", which is true and tells you
      // nothing about what went wrong.
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      last = error;
      if (attempt < FONT_TRIES) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }
  throw new Error(`font request failed after ${FONT_TRIES} tries: ${url}`, {
    cause: last,
  });
}

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
  const css = await get(cssUrl).then((response) => response.text());

  const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!fontUrl) throw new Error(`no font url in Google's css for weight ${weight}`);

  const data = await get(fontUrl).then((response) => response.arrayBuffer());
  fontCache.set(key, data);
  return data;
}

/**
 * Both families, in the order Satori should try them: Inter takes the Latin, 思源
 * 黑体 catches everything Inter has no glyph for. Satori falls back in array
 * order, so a card whose headline is Chinese and whose wordmark is Latin gets each
 * in the right face — which is what the page itself does with its font stack.
 */
async function fonts(text: string) {
  const [latin, latinBold, cjk, cjkBold] = await Promise.all([
    loadSubset("Inter", text, 400),
    loadSubset("Inter", text, 600),
    loadSubset("Noto Sans SC", text, 400),
    loadSubset("Noto Sans SC", text, 600),
  ]);
  return [
    { name: "Inter", data: latin, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: latinBold, weight: 600 as const, style: "normal" as const },
    { name: "Noto Sans SC", data: cjk, weight: 400 as const, style: "normal" as const },
    { name: "Noto Sans SC", data: cjkBold, weight: 600 as const, style: "normal" as const },
  ];
}

/**
 * The card, as PNG bytes.
 *
 * Buffered rather than returned as a stream so the route can declare
 * `content-length` — an image whose end nothing announces is a broken picture the
 * moment a mobile connection drops a chunk, which is intermittent, per-network and
 * impossible to reproduce on a desk. apps/daily learned this the hard way; see the
 * note in its share.png route.
 */
export async function renderOgCard(lang: Lang): Promise<Buffer> {
  const text = strings(lang);
  const domain = new URL(SITE).host;
  /**
   * The hero's own headline, split on the break it already carries.
   *
   * `heroTitle` is written with a `\n` because the page renders it
   * `whitespace-pre-line` — the line break is an editorial decision, not a
   * consequence of the column width. Satori's `pre-line` support is not something
   * to rely on, so the break is applied here by splitting instead, which honours
   * the same decision.
   */
  const lines = text.heroTitle.split("\n");
  const shelf = PRODUCTS.map((product) => product.name).join("  ·  ");

  const glyphs = [domain, text.brand, shelf, ...lines, "·"].join("");

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: NIGHT,
          color: NIGHT_INK,
          padding: `${CARD.padY}px ${CARD.padX}px`,
          fontFamily: "Inter, Noto Sans SC",
        }}
      >
        {/* The lockup, and the domain opposite it — the nav's own arrangement. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: CARD.markGap }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws
                `img` and not inline `svg`; see MARK above. */}
            <img
              src={MARK}
              // 46:28 is LogoMark's viewBox, so the width follows the height.
              height={CARD.markHeight}
              width={Math.round((CARD.markHeight * 46) / 28)}
              alt=""
            />
            <div
              style={{
                display: "flex",
                fontSize: CARD.brandSize,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              {text.brand}
            </div>
          </div>
          <div
            style={{ display: "flex", fontSize: CARD.domainSize, color: NIGHT_SOFT }}
          >
            {domain}
          </div>
        </div>

        {/* The headline, centred in what is left. `flex: 1` so a two-line title
            and a three-line one both sit off the same optical centre. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
          }}
        >
          {lines.map((line, at) => (
            <div
              /* By position: the hero title is two lines of fixed copy, but a
                 future one could repeat a line and the order never changes. */
              key={at}
              style={{
                display: "flex",
                fontSize: CARD.titleSize,
                fontWeight: 600,
                lineHeight: CARD.titleLeading,
                letterSpacing: "-0.03em",
              }}
            >
              {line}
            </div>
          ))}
        </div>

        {/* What is actually on the shelf. The card's one concrete fact — a brand
            statement with no products named is a card that could belong to
            anyone. */}
        <div style={{ display: "flex", fontSize: CARD.shelfSize, color: NIGHT_SOFT }}>
          {shelf}
        </div>
      </div>
    ),
    { width: OG_WIDTH, height: OG_HEIGHT, fonts: await fonts(glyphs) },
  );

  return Buffer.from(await image.arrayBuffer());
}
