import { dateKey } from "@/lib/config";
import { displayTitle } from "@/components/ArticleTitle";
import { DEFAULT_LANG, isLang } from "@/lib/lang";
import { ogPng, renderOgCard } from "@/lib/og";
import { readDigest, readLatest } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The site's link-preview card — the home page's, and the archive's.
 *
 * ONE ROUTE FOR BOTH PAGES. The archive is a list of days rather than of articles,
 * so a card of its own would have to draw something else entirely; what a reader
 * seeing `daily.lab115.com/archive` in a chat thread needs to know is what this
 * site is and what is on it today, which is this card. `ogCardFor(lang, "/")` in
 * archive/page.tsx is where that decision is written down.
 *
 * It follows the same fallback the home page does — today's digest, or the newest
 * one on disk before the day's run has happened — so the card and the page a
 * crawler is unfurling never disagree about which day they are showing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  const cardLang = isLang(lang) ? lang : DEFAULT_LANG;

  const today = dateKey(new Date());
  const digest = (await readDigest(today)) ?? (await readLatest());

  return ogPng(
    await renderOgCard({
      lang: cardLang,
      // The digest's own date, not `today`: on a fallback those differ, and the
      // card must say which day the headlines under it are from.
      meta: digest?.date ?? today,
      headlines: (digest?.articles ?? []).map((article) =>
        displayTitle(article, cardLang),
      ),
    }),
  );
}
