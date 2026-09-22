import { notFound, redirect } from "next/navigation";
import { href, isLang } from "@/lib/lang";
import { dayPath } from "@/lib/links";
import { listDates } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * `/today` — a REDIRECT to the newest edition's own URL, and nothing else.
 *
 * WHY IT IS A ROUTE RATHER THAN AN HREF. The bar's 「今天列表」 has to lead to
 * `/2026/09/21` rather than to `/`, and the bar is on every page — so computing
 * that href in `PageShell` would mean calling `listDates` (an uncached walk of
 * years × months × files) on every page of the site, including the article pages
 * that have no other reason to read it. Here the walk is paid once, by the press.
 * See `TODAY_PATH` in lib/links.
 *
 * A 307, NOT A 308, AND THAT IS THE WHOLE OF THE CARE THIS FILE NEEDS.
 *
 * Every other redirect on this site is permanent and deliberately so — the note
 * on the old `/d/<date>` route says a 308 is not a hint. This one is the
 * exception, and getting it wrong would be the worst kind of bug: a 308 is cached
 * by the browser FOREVER, with no revalidation, so the first reader to press this
 * would be pinned to whichever day was newest at that moment and would never see
 * another edition from this link again. The target of this URL changes every
 * morning; "permanent" is false about it.
 *
 * `redirect()` from next/navigation is 307 for exactly this case. It is not
 * `permanentRedirect()` and must not be "tidied" into it.
 *
 * AN EMPTY ARCHIVE IS A 404 rather than a redirect to `/`. There is no edition to
 * show, and sending the reader to the front page would be answering a different
 * question than the one they asked.
 */
export default async function TodayPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const [newest] = await listDates();
  if (!newest) notFound();

  redirect(href(lang, dayPath(newest)));
}
