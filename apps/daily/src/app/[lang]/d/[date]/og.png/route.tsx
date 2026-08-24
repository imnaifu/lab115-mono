import { displayTitle } from "@/components/ArticleTitle";
import { DEFAULT_LANG, isLang } from "@/lib/lang";
import { ogPng, renderOgCard } from "@/lib/og";
import { readDigest } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * One day's link-preview card.
 *
 * The reason a day gets its own rather than sharing the site card: a day page is
 * the URL people actually paste — "look at what today had" — and every one of them
 * unfurling with the same image is the same failure as every one of them unfurling
 * with the same description, which is what `generateMetadata` next door already
 * fixed for the text.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string; date: string }> },
) {
  const { lang, date } = await params;
  const cardLang = isLang(lang) ? lang : DEFAULT_LANG;

  // readDigest validates the yyyy-mm-dd shape, so a crafted [date] cannot walk
  // out of the repo directory — same guard the page itself relies on.
  const digest = await readDigest(date);
  // A stale link to a day that was never written gets a 404 rather than an empty
  // card: an unfurler that sees no image falls back to the text, which is right,
  // whereas a blank canvas is a picture claiming there was nothing that day.
  if (!digest) return new Response("Not found", { status: 404 });

  return ogPng(
    await renderOgCard({
      lang: cardLang,
      meta: date,
      headlines: digest.articles.map((article) => displayTitle(article, cardLang)),
    }),
  );
}
