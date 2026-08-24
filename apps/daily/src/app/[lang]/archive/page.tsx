import { permanentRedirect } from "next/navigation";
import { DEFAULT_LANG, href as langHref, isLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

/**
 * The archive, which is now the home page.
 *
 * THIS PAGE WAS THE LIST OF DAYS, and when the front page became that list there
 * was no version of keeping both that was not the bug this whole change exists to
 * remove: two URLs, one list of dates, differing only in a heading. That is the
 * same shape as the home page and the newest day page before it — and `/archive`
 * was already IN the Search Console report, as one of the three URLs whose
 * canonical Google had overridden. Rebuilding the collision one page over would
 * have been a poor trade for a heading.
 *
 * A REDIRECT RATHER THAN A DELETION, because the URL is not only ours: it is in
 * the sitemap Google has already fetched, in the index, and in the footer of every
 * page the site has served. 308 so the old URL's accumulated signals land on the
 * page that now holds its content.
 *
 * `/en/archive` redirects to `/en` by the same rule — `langHref` keeps the reader
 * in the language they were in, which a hardcoded `/` would not.
 */
export default async function LegacyArchivePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  permanentRedirect(langHref(isLang(lang) ? lang : DEFAULT_LANG, "/"));
}
