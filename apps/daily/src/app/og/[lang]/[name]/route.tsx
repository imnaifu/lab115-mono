import { dateKey } from "@/lib/config";
import { displayTitle } from "@/components/ArticleTitle";
import { DEFAULT_LANG, isLang } from "@/lib/lang";
import { ogPng, renderOgCard } from "@/lib/og";
import { readDigest, readLatest, shownArticles } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Every link-preview card the site draws: `/og/zh/site.png` and
 * `/og/zh/2026-08-14.png`.
 *
 * ONE ROUTE, OUTSIDE THE PAGE TREE. These were two routes living inside the pages
 * they belonged to — `/[lang]/og.png` and `/[lang]/d/[date]/og.png` — and both
 * facts had to change together.
 *
 * They moved OUT because a page path and an asset path in one namespace is a
 * collision waiting for a slug, and because `proxy.ts` skips anything ending in an
 * extension: a language-prefixed image route is now unreachable, since Chinese is
 * served unprefixed and reaching `/[lang]/…` needs the rewrite the matcher denies
 * to dotted paths. Carrying the language as a plain segment sidesteps all of it.
 * See `ogUrl` in lib/links.
 *
 * They BECAME ONE because with the path shape settled the two handlers differed
 * only in where the digest came from, and `[name]` can carry either answer.
 *
 * `[name]` arrives WITH the extension — `site.png`, `2026-08-14.png` — because a
 * dynamic segment matches the whole segment. Stripping it here is the price of not
 * needing a `[name].png` directory, which is not a shape the App Router promises.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string; name: string }> },
) {
  const { lang, name } = await params;
  const cardLang = isLang(lang) ? lang : DEFAULT_LANG;
  const card = name.replace(/\.png$/, "");

  /**
   * `site` follows the home page's own fallback — today's digest, or the newest on
   * disk before the day's run has happened — so the card and the page a crawler is
   * unfurling never disagree about which day they are showing.
   *
   * Anything else is read as a date. `readDigest` validates the yyyy-mm-dd shape,
   * so a crafted segment cannot walk out of the repo directory, and a name that is
   * neither `site` nor a real date falls through to the 404 below.
   */
  const today = dateKey(new Date());
  const digest =
    card === "site"
      ? ((await readDigest(today)) ?? (await readLatest()))
      : await readDigest(card);

  /**
   * A stale link to a day that was never written gets a 404 rather than an empty
   * card: an unfurler that sees no image falls back to the text, which is right,
   * whereas a blank canvas is a picture claiming there was nothing that day.
   *
   * `site` is exempt — an empty site still has a card to draw, with the brand on
   * it and no headlines under it.
   */
  if (!digest && card !== "site") {
    return new Response("Not found", { status: 404 });
  }

  return ogPng(
    await renderOgCard({
      lang: cardLang,
      // The digest's own date, not `today`: on a fallback those differ, and the
      // card must say which day the headlines under it are from.
      meta: digest?.date ?? today,
      // The published headlines. The list also holds what was turned down, and
      // a share card is a claim about what the day contains.
      headlines: (digest ? shownArticles(digest) : []).map((article) =>
        displayTitle(article, cardLang),
      ),
    }),
  );
}
