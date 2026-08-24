import { atomFeed } from "@/lib/feed";
import { isLang } from "@/lib/lang";

/**
 * `/zh/feed.xml` and `/en/feed.xml` — one feed per language, under the language
 * prefix, for the same reason the manifest next door is per-language: ONE
 * LANGUAGE PER DOCUMENT. A single feed would have to carry both takes on every
 * article, and no reader has a way to show one and hide the other.
 *
 * A directory named with the extension plus `route.ts`, the same trick
 * `manifest.webmanifest/route.ts` next door uses.
 *
 * NOT reached through `proxy.ts`: its matcher excludes anything ending in a file
 * extension, so this handler sees the request directly and takes the language
 * from the path segment rather than from the `x-lang` header the proxy would
 * otherwise set.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  if (!isLang(lang)) return new Response("Not found", { status: 404 });

  return new Response(await atomFeed(lang), {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      /**
       * Half an hour. The digest lands once a day and `DAILY_SYNC_CRON` pulls
       * it every 15 minutes, so nothing this feed reports can be more than ~15
       * minutes newer than the last sync anyway — and readers poll on their own
       * schedule regardless. The header is here to keep an aggregator that
       * polls every minute from re-rendering the whole week each time.
       */
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    },
  });
}
