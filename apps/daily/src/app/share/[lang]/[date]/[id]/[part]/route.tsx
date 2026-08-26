import { posterBytes } from "@/lib/poster-serve";
import { POSTER_HEIGHT, POSTER_WIDTH } from "@/lib/share";
import { posterPart } from "@/lib/links";
import { DEFAULT_LANG, isLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

/**
 * One image of an article's share, as a PNG: `/share/zh/2026-08-14/ff36a72e/1.png`.
 *
 * THE LAYOUT IS NOT HERE. It is lib/poster.tsx, and two copies of that JSX would
 * drift on the first edit. Finding the article and drawing it is
 * lib/poster-serve.ts — one policy decision, which is that a request naming no
 * article is a 404 rather than a blank canvas.
 *
 * What is left here is the HTTP: which part was asked for, and the headers. THAT
 * NOW INCLUDES THE ONLY CACHING THERE IS — see `png` below. The disk cache these
 * notes used to describe is gone; lib/poster-serve says why.
 *
 * A route handler rather than Next's `opengraph-image` file convention, because
 * that convention gives one image per page and a share is a set of them.
 *
 * MOVED OUT of `/[lang]/d/[date]/[id]/share.png`, and the part moved out of the
 * query string with it. Both for the reasons on `ogUrl` in lib/links: an image
 * route under the page tree cannot be reached now that Chinese is served
 * unprefixed, and `?part=` was what forced robots.txt to match a query pattern and
 * the share sheet's retry to append `&` to a URL that only had a `?` by luck.
 *
 * `[part]` arrives as `1.png`; `posterPart` strips the extension — see the note
 * there for why that lives beside the builder rather than here.
 */
export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ lang: string; date: string; id: string; part: string }>;
  },
) {
  const { lang, date, id, part } = await params;
  // The poster is written in the language of the page that linked to it: the
  // brand, the meta line and the choice of headline all differ, so /zh and /en
  // are two different images of the same article.
  const posterLang = isLang(lang) ? lang : DEFAULT_LANG;

  const bytes = await posterBytes(date, id, posterLang, posterPart(part));
  // null covers both "no such article" and "no such part" — a stale link, or
  // someone counting past the end. A 404 says so; a blank canvas would not.
  if (!bytes) return new Response("Not found", { status: 404 });
  return png(bytes);
}

/**
 * The response, with a stated LENGTH.
 *
 * `ImageResponse` is a streaming response, so returning it directly went out
 * chunked with no `content-length` — and an image whose end nothing declares is a
 * broken picture the moment a mobile connection drops a chunk. The reader sees the
 * broken-image glyph, then long-presses it, which re-requests the URL and works:
 * intermittent, per-network, and impossible to reproduce on a desk. Rendering to
 * bytes first buys a response whose size is stated up front, so a truncated one is
 * detectable rather than merely wrong. It is not proof against a dropped
 * connection — nothing at this layer is — which is why the sheet also retries; see
 * the preview in ShareSheet.
 */
function png(bytes: Buffer): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/png",
      "content-length": String(bytes.byteLength),
      /**
       * AN HOUR, AND IT IS NOW THE ONLY CACHE A POSTER HAS. It was one layer of
       * two; the disk cache under it was deleted because an entry there never
       * expired, so a change to the layout went on shipping the old drawing for
       * up to thirty days. An hour is the whole of the staleness now.
       *
       * An hour, because each part is fetched TWICE per share: the sheet shows it
       * as an `<img>` and then hands the same bytes to `navigator.share`. Next's
       * default for a dynamic route is `max-age=0, must-revalidate` with no
       * validator, which made those two round trips of a byte-identical image —
       * and with a set of images, two per part. A digest is written once for its
       * day and never edited, so the only thing that can change inside the hour is
       * an upstream cover photo, which is cosmetic.
       *
       * It also takes the repeat cost off crawlers and link unfurlers, which fetch
       * this the moment a link is posted anywhere.
       */
      "cache-control": "public, max-age=3600",
      // Stated so a client can lay out the image before it has decoded it. Both
      // are constants: the canvas is fixed at 3:4 — see POSTER_WIDTH.
      "x-poster-size": `${POSTER_WIDTH}x${POSTER_HEIGHT}`,
    },
  });
}
