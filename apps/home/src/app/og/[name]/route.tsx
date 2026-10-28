import { renderOgCard } from "@/lib/og";

/**
 * The site's link-preview card, at one url per language: `/og/zh.png` and
 * `/og/en.png`.
 *
 * OUTSIDE THE PAGE TREE, where it used to live as `/[lang]/og.png`. It had to
 * move: `proxy.ts` skips any path ending in a file extension, so a
 * language-prefixed image route is unreachable now that Chinese is served
 * unprefixed and reaching `/[lang]/…` needs the rewrite that matcher denies to
 * dotted paths. Carrying the language as an ordinary path segment sidesteps it,
 * and it is what apps/daily does — see `ogUrl` in its lib/links.
 *
 * BOTH URLS DRAW THE SAME CARD now. It used to carry the hero's headline in the
 * reader's language; the page lost its copy and so did the card, which is just the
 * blocks and the wordmark. The two urls stay because `lib/seo.tsx` still names one
 * per language and unfurlers have already cached them — there is nothing to gain
 * from moving them.
 *
 * A route handler rather than Next's `opengraph-image` file convention: that
 * convention derives the url from the route it sits in, which would work here, but
 * `lib/seo.tsx` already owns the url shape for every other metadata field and
 * having one of them come from a filename instead is how the two drift apart.
 */
export async function GET() {
  // `[name]` matches any segment, and every one gets the card. A card is not a
  // page, so an unknown name is not worth a 404 — an unfurler that gets no image
  // drops the whole preview.
  const bytes = await renderOgCard();

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/png",
      // Declared, or a dropped chunk on a mobile connection shows a broken-image
      // glyph rather than a short image. See renderOgCard.
      "content-length": String(bytes.byteLength),
      /**
       * A DAY, not the hour apps/daily uses for its cards. Nothing on this card
       * comes from content that changes — it is the mark, the wordmark and the
       * blocks, all of which live in the source — so the only thing that can
       * invalidate it is a deploy, which empties the cache anyway.
       */
      "cache-control": "public, max-age=86400",
    },
  });
}
