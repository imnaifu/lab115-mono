import { atomFeed } from "@/lib/feed";
import { DEFAULT_LANG } from "@/lib/lang";

/**
 * `/feed.xml` — the address people actually type, and the one a reader guesses
 * when it is handed a bare domain.
 *
 * IT SERVES THE DEFAULT LANGUAGE'S FEED. It used to 302 to `/zh/feed.xml` or
 * `/en/feed.xml` depending on Accept-Language, mirroring what `proxy.ts` did for
 * every unprefixed page — and when that negotiation went, this went with it.
 *
 * WHY THE NEGOTIATION WENT, in one line: Googlebot sends no Accept-Language, so
 * for the crawler the redirect always landed on Chinese, which made every
 * unprefixed URL a second address for a Chinese page and put three of them in
 * Search Console as duplicates with a Google-chosen canonical. The full account is
 * in lib/lang.ts. A feed is not crawled the way a page is, but two behaviours for
 * the same question would still be one too many, and the site's rule now is that
 * an unprefixed URL IS the default language rather than a question about it.
 *
 * WHAT A NON-CHINESE READER DOES: subscribes to `/en/feed.xml`, which every English
 * page advertises through `<link rel="alternate">` — see `alternates.types` in
 * app/layout.tsx. That is the same answer the site gives for pages.
 *
 * The long note that used to live here about relative `Location` headers went with
 * the redirect. It is not lost: `proxy.ts` is the other place that emits one, and
 * the reasoning applies there.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(await atomFeed(DEFAULT_LANG), {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      /**
       * Half an hour, matching the prefixed route next door. The digest lands once
       * a day and `SYNC_CRON` pulls it every 15 minutes, so nothing this feed
       * reports can be more than ~15 minutes newer than the last sync anyway.
       */
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    },
  });
}
