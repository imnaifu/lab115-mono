import { ImageResponse } from "next/og";
import { MARK, WORDMARK } from "@/components/Logo";
import { OG_HEIGHT, OG_WIDTH } from "./seo";

/**
 * The link-preview card, 1200x630.
 *
 * THE PAGE ITSELF, seen somewhere else: the same blocks and the same lockup as
 * app/[lang]/page.tsx in its landscape layout, so a link pasted into a chat looks
 * like the site it opens. The card used to carry the hero headline and the
 * product shelf; both left the page, so they left the card too, and it is the
 * same image in both languages.
 *
 * SERVER ONLY: `next/og` and the font fetcher below have no business in a browser
 * bundle. Only the route imports this.
 */

/** The Sokosoko tokens this card uses. Satori has no CSS variables; see index.css. */
const PAPER = "#ffffff";
const INK = "#2f3542";
const BRAND = "#f7c948";
const FILL_SKY = "#bcdcf2";
const FILL_MINT = "#bfe3cf";
const FILL_PINK = "#f6c6cf";

/**
 * The page's viewport units, resolved for the card's canvas. Every number below
 * is copied from components/Blocks.tsx and page.tsx and multiplied by one of
 * these, so the two can be compared line by line.
 */
const VW = OG_WIDTH / 100;
const VH = OG_HEIGHT / 100;
const VMIN = Math.min(VW, VH);

/**
 * The mark, inlined as a data URI.
 *
 * Satori draws `<img>` but not inline `<svg>`, and it has no filesystem, so
 * `LogoMark` cannot simply be rendered here. Built from the same MARK geometry,
 * with the tile and line colours written out — the page paints them through
 * Tailwind classes, and there are no classes in an image.
 */
const MARK_URI =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect x="2" y="2" width="60" height="60" rx="16" fill="${BRAND}" stroke="${INK}" stroke-width="3"/>` +
      `<g transform="${MARK.transform}" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round">` +
      MARK.strokes.map((path) => `<path d="${path}"/>`).join("") +
      `</g></svg>`,
  ).toString("base64");

/**
 * The wordmark's face, fetched as a subset.
 *
 * The page gets Nunito from next/font, which self-hosts it as woff2. Satori needs
 * the font as data and cannot read woff2, so the card asks Google for it again,
 * subsetted to the six letters it draws.
 *
 * The mechanism — the `text=` parameter and the deliberately ancient User-Agent —
 * is lifted from apps/daily's lib/poster-assets.ts, and the long version of why
 * each part is necessary is there. The short version: `text=` returns a face
 * subsetted to exactly the characters asked for, and Google picks the FORMAT from
 * the User-Agent — a modern one gets woff2, which Satori cannot read, while
 * Android 2.3 gets ttf, which it can.
 */
const LEGACY_UA =
  "Mozilla/5.0 (Linux; U; Android 2.3; en-us) AppleWebKit/533.1 " +
  "(KHTML, like Gecko) Version/4.0 Mobile Safari/533.1";

const FONT_TIMEOUT_MS = 8000;
const FONT_TRIES = 3;

/**
 * The card's text never changes, so ONE cache entry is the whole working set — a
 * plain Map with no bound, unlike daily's, where the text is per-article and an
 * unbounded map would grow with the archive.
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

/** One rounded block, positioned in the page's own units. */
function block(style: Record<string, string | number>) {
  return { position: "absolute" as const, display: "flex", ...style };
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
export async function renderOgCard(): Promise<Buffer> {
  const wordmarkFont = await loadSubset("Nunito", WORDMARK, 800);
  const dot = { width: 3.2 * VW, height: 3.2 * VW, borderRadius: 999, background: PAPER };
  const pill = (width: number) => ({ width: width * VW, height: 3.2 * VW, borderRadius: 999, background: PAPER });
  const row = { display: "flex", justifyContent: "space-between" };

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: PAPER,
        }}
      >
        <div
          style={block({
            left: 52 * VW,
            top: -8 * VH,
            width: 28 * VW,
            height: 74 * VH,
            flexDirection: "column",
            gap: 1.5 * VW,
            borderRadius: 4 * VMIN,
            background: BRAND,
            padding: `${8 * VH + 2.5 * VW}px ${2.5 * VW}px 0`,
          })}
        >
          <div style={row}>
            <div style={dot} />
            <div style={dot} />
            <div style={dot} />
            <div style={dot} />
            <div style={dot} />
          </div>
          <div style={row}>
            <div style={pill(14)} />
            <div style={pill(7.5)} />
          </div>
          <div style={row}>
            <div style={pill(7.5)} />
            <div style={pill(14)} />
          </div>
        </div>
        <div style={block({ left: 82 * VW, top: 8 * VH, width: 22 * VW, height: 36 * VH, borderRadius: 4 * VMIN, background: FILL_SKY })} />
        <div style={block({ left: 82 * VW, top: 50 * VH, width: 22 * VW, height: 60 * VH, borderRadius: 4 * VMIN, background: FILL_MINT })} />
        <div style={block({ left: 52 * VW, top: 72 * VH, width: 19 * VW, height: 9 * VH, borderRadius: 999, background: INK })} />
        <div style={block({ left: 73 * VW, top: 70 * VH, width: 7 * VW, height: 7 * VW, borderRadius: 999, background: FILL_PINK })} />

        <div
          style={block({
            left: 7 * VW,
            bottom: 13 * VH,
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 2.5 * VMIN,
          })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws
              `img` and not inline `svg`; see MARK_URI above. */}
          <img src={MARK_URI} width={15 * VMIN} height={15 * VMIN} alt="" />
          <div
            style={{
              display: "flex",
              fontFamily: "Nunito",
              fontSize: 10.5 * VW,
              fontWeight: 800,
              lineHeight: 0.9,
              letterSpacing: "-0.01em",
              color: INK,
            }}
          >
            {WORDMARK}
          </div>
        </div>
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [{ name: "Nunito", data: wordmarkFont, weight: 800, style: "normal" }],
    },
  );

  return Buffer.from(await image.arrayBuffer());
}
