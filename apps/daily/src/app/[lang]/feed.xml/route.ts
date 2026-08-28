import { atomFeed } from "@/lib/feed";
import { DEFAULT_LANG, isLang } from "@/lib/lang";

/**
 * `/en/feed.xml` — the NON-DEFAULT language's feed, under its prefix, for the same
 * reason the manifest next door is per-language: ONE LANGUAGE PER DOCUMENT. A
 * single feed would have to carry both takes on every article, and no reader has
 * a way to show one and hide the other.
 *
 * The default language's feed is `app/feed.xml` at the root, because that is where
 * its pages live.
 *
 * `/zh/feed.xml` IS A 404 HERE, and it has to be refused in this file rather than
 * in `proxy.ts`. The site has no `/zh/…` addresses left — see the note in
 * lib/lang.ts for what having two addresses for one Chinese document cost — and
 * the proxy enforces that for every page. It CANNOT enforce it here: its matcher
 * excludes any path ending in a file extension, so this handler is reached
 * directly and never passes through it. That exclusion is load-bearing (it is
 * what keeps `/sw.js` and the icons in `public/` from being rewritten), so the
 * guard belongs at this end.
 *
 * The same exclusion is why the language comes from the path segment rather than
 * from the `x-lang` header the proxy sets on ordinary pages.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  // Not a language at all, or the default one, whose feed is at the root. See above.
  if (!isLang(lang) || lang === DEFAULT_LANG) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(await atomFeed(lang), {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      /**
       * Half an hour. The digest lands once a day and `SYNC_CRON` pulls
       * it every 15 minutes, so nothing this feed reports can be more than ~15
       * minutes newer than the last sync anyway — and readers poll on their own
       * schedule regardless. The header is here to keep an aggregator that
       * polls every minute from re-rendering the whole week each time.
       */
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    },
  });
}
