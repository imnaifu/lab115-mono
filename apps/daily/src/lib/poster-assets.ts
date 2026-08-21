import { POSTER, posterClean } from "./share";
import type { Article, SummaryText } from "./types";
import { paragraphsOf } from "./paragraphs";

/**
 * Everything the poster needs FETCHED, DECODED or RE-ENCODED: the font subsets,
 * the cover photo, and the native image work behind it.
 *
 * SPLIT OUT OF share.ts, and the reason is a build error rather than tidiness.
 * share.ts holds the layout table and the pagination, and `posterParts` is needed
 * by ArticleCards — which is reached from DigestBody, which is `"use client"`. So
 * share.ts is in the CLIENT graph, and the moment it gained a dynamic
 * `import("sharp")` webpack followed that into the browser bundle and failed to
 * resolve `fs` and `child_process`. Every article page 500'd.
 *
 * The rule this file exists to enforce: share.ts is pure arithmetic over strings
 * and may be imported anywhere. Anything with an I/O or native dependency lives
 * here, and only the renderer (lib/poster.tsx) and the job import it.
 */

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

/** How long one request to Google is given, and how many times it is asked. */
const FONT_TIMEOUT_MS = 8000;
const FONT_TRIES = 3;

/**
 * A GET that gives up and tries again, because the daily job made this the
 * busiest thing in the app.
 *
 * It used to be a bare `fetch` with no timeout, no retry and no status check. On
 * a single poster that was fine — one reader, four requests, and a failure they
 * could resolve by reloading. The job renders ~90 images in a run and asks for a
 * subset per article per language, and at that volume a transient DNS or connect
 * failure stops being hypothetical: a real run lost two images to
 * `ETIMEDOUT` from exactly here.
 *
 * All three parts matter and each fixes something different. The TIMEOUT bounds a
 * hung connection, which otherwise holds one of four job workers for as long as
 * undici's default allows. The RETRY covers the transient case, which is most of
 * them. The STATUS CHECK covers the case that has never been seen and would be
 * baffling: Google answering 429 with an HTML body, where the regex above finds no
 * url and reports "no font url in Google's css" — true, and nothing to do with
 * what went wrong.
 */
async function get(url: string): Promise<Response> {
  let last: unknown;
  for (let attempt = 1; attempt <= FONT_TRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": LEGACY_UA },
        signal: AbortSignal.timeout(FONT_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      last = error;
      // Linear, not exponential: these are connect failures against a CDN that is
      // either there or briefly is not, and the job is already waiting on it.
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
  const css = await get(cssUrl).then((r) => r.text());

  const href = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!href) throw new Error(`no font url in Google's css for weight ${weight}`);

  const data = await get(href).then((r) => r.arrayBuffer());

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

/**
 * Every glyph the poster will draw, so the subset covers all of it.
 *
 * Run through `posterClean` for the same reason the renderer is: asking Google for
 * a character its fonts do not have gets a font that still does not have it, and
 * then Satori goes off to fetch one per missing character. Cleaning both sides
 * from the same function is what keeps the request and the canvas in agreement.
 */
export function posterText(article: Article, summary: SummaryText, extra: string) {
  return posterClean([
    article.title,
    summary.thesis ?? "",
    ...paragraphsOf(summary.text ?? ""),
    extra,
    // Punctuation and digits the layout adds on its own. The slash is the page
    // counter's — `2/4` — and a glyph Google was not asked for renders as nothing
    // at all, so an omission here is an invisible bug, not a fallback.
    "0123456789/·—、。，：；？！「」（）%<>=~-!",
  ].join(""));
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

    const type = (response.headers.get("content-type") ?? "").split(";")[0];
    if (!type.startsWith("image/")) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > COVER_MAX_BYTES) return null;

    const shrunk = await shrink(bytes);
    if (shrunk) return `data:image/jpeg;base64,${shrunk.toString("base64")}`;

    /**
     * Sharp could not be used, so the ORIGINAL bytes go through — but only if
     * Satori can actually decode them.
     *
     * `image/*` was the whole test here, and it is not enough: Satori rasterizes
     * PNG, JPEG and GIF and nothing else, so a `image/webp` cover passed this
     * check, reached the renderer and threw `TypeError: u2 is not iterable` from
     * inside satori — which killed the entire image, headline and all, over a
     * thumbnail. Two of the sources on the list serve webp (Quanta, 阮一峰), so
     * this was not an edge case, it was two posters a day.
     */
    if (!SATORI_IMAGE_TYPES.has(type)) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/** What Satori can rasterize. Anything else has to be converted or dropped. */
const SATORI_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif"]);

/**
 * The cover, re-encoded as a small JPEG — or null if that could not be done.
 *
 * TWO JOBS IN ONE PASS, and the second is why every cover goes through here
 * rather than only the webp ones:
 *
 *   - FORMAT. webp and avif are what a modern blog serves and neither is
 *     something Satori can read. Decoding is the difference between the poster
 *     having a cover and having a gradient.
 *   - SIZE. The cover is drawn into a 163px box and was being inlined at whatever
 *     the source published — the cap next door is 3 MB, and a data URI is base64,
 *     so a 1 MB photo was 1.4 MB of string held in memory and handed to Satori to
 *     scale down and throw away. At 2x the box it is ~20 KB.
 *
 * `sharp` is imported dynamically and every failure returns null, because it is a
 * NATIVE module: it arrives as a transitive dependency of Next, it is declared in
 * package.json so that is not an accident, and it still needs a prebuilt binary
 * for the platform. A musl container that did not get one must fall back to the
 * original bytes rather than lose every cover on the site.
 */
async function shrink(bytes: Buffer): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import("sharp");
    return await sharp(bytes)
      // 2x the box it is drawn in, so it is still crisp on a screen that scales
      // the poster up, and `cover` because the box is a square and the source
      // usually is not — the same crop the page's `object-cover` makes.
      .resize(POSTER.cover * 2, POSTER.cover * 2, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    return null;
  }
}

