import { DEFAULT_LANG, isLang } from "@/lib/lang";
import { renderOgCard } from "@/lib/og";

/**
 * The site's link-preview card, per language.
 *
 * PER LANGUAGE because the headline on it is the hero's, and that is the one line
 * on this site most worth getting right in the reader's own language — a Chinese
 * card under an English title is the mismatch the whole `[lang]` prefix exists to
 * prevent.
 *
 * A route handler rather than Next's `opengraph-image` file convention: that
 * convention derives the url from the route it sits in, which would work here, but
 * `lib/seo.tsx` already owns the url shape for every other metadata field and
 * having one of them come from a filename instead is how the two drift apart.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  // `[lang]` matches any first segment. A card is not a page, so an unknown one
  // falls back rather than 404s — an unfurler that gets no image drops the whole
  // preview, and there is nothing language-specific enough here to be worth that.
  const bytes = await renderOgCard(isLang(lang) ? lang : DEFAULT_LANG);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/png",
      // Declared, or a dropped chunk on a mobile connection shows a broken-image
      // glyph rather than a short image. See renderOgCard.
      "content-length": String(bytes.byteLength),
      /**
       * A DAY, not the hour apps/daily uses for its cards. Nothing on this card
       * comes from content that changes — it is the brand, the hero line and the
       * product names, all of which live in the source — so the only thing that can
       * invalidate it is a deploy, which empties the cache anyway.
       */
      "cache-control": "public, max-age=86400",
    },
  });
}
