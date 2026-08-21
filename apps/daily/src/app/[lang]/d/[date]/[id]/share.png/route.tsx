import { renderPoster } from "@/lib/poster";
import { readPoster, writePoster } from "@/lib/poster-store";
import { POSTER_HEIGHT, POSTER_WIDTH } from "@/lib/share";
import { posterPart } from "@/lib/links";
import { DEFAULT_LANG, isLang } from "@/lib/lang";
import { readArticle } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * One image of an article's share, as a PNG.
 *
 * THE LAYOUT IS NOT HERE. It is in lib/poster.tsx, because the daily job renders
 * these too — every image of every article, written to disk the moment a digest
 * is — and two copies of that JSX would drift on the first edit. This handler is
 * the cache in front of it: serve the file if the job already made it, render and
 * keep it if not.
 *
 * A miss is ordinary, not a fault. A fresh container has an empty volume, a digest
 * from before the job pre-rendered anything has no files at all, and the cache
 * prunes dates past a month. All of those land here and render, which is exactly
 * what this route did for its whole life before the cache existed.
 *
 * A route handler rather than Next's `opengraph-image` file convention, because
 * that convention gives one image per page and a share is a set of them.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ lang: string; date: string; id: string }> },
) {
  const { lang, date, id } = await params;
  const part = posterPart(new URL(req.url).searchParams.get("part"));
  // The poster is written in the language of the page that linked to it — see the
  // note on the cache key in lib/poster-store.ts.
  const posterLang = isLang(lang) ? lang : DEFAULT_LANG;

  const cached = await readPoster(date, id, posterLang, part);
  if (cached) return png(cached);

  const found = await readArticle(date, id);
  if (!found) return new Response("Not found", { status: 404 });

  const bytes = await renderPoster({
    article: found.article,
    date,
    lang: posterLang,
    part,
  });
  // null means the article has no such part — a stale link, or someone counting
  // past the end. A 404 says so; a blank canvas would not.
  if (!bytes) return new Response("No such part", { status: 404 });

  // Not awaited for its own sake — the reader is waiting on the image, not on the
  // cache write, and a failed write is already swallowed inside.
  void writePoster(date, id, posterLang, part, bytes);
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
