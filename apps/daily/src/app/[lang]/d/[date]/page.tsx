import { permanentRedirect } from "next/navigation";
import { href as langHref, isLang, DEFAULT_LANG } from "@/lib/lang";
import { dayPath } from "@/lib/links";

export const dynamic = "force-dynamic";

/**
 * The old shape of a day's URL, kept alive as a redirect and nothing else.
 *
 * `/zh/d/2026-08-14` → `/2026/08/14`. Two things changed at once — the language
 * prefix went away for the default language, and the date went hierarchical — so
 * a link saved before either could name a path that no longer resolves.
 *
 * IT DOES NOT VALIDATE THE DATE. A garbage segment redirects to a URL that 404s,
 * which is the same answer one hop later, and the alternative is a second copy of
 * `readDigest`'s pattern check that could drift from it. The redirect is a URL
 * rewrite, not a lookup.
 *
 * IN PRACTICE THIS IS NOW `/en/d/…` ONLY. `/zh/d/2026-08-14` used to arrive here
 * in two hops, the proxy stripping the prefix first; the prefixed Chinese form is
 * a 404 at the proxy now (see the note there), so the oldest shape of a Chinese
 * link — prefix AND flat date, i.e. one saved before both changes — is gone
 * rather than redirected. That is the accepted cost of leaving no `/zh/…` address
 * alive at all. `/d/2026-08-14`, the half-migrated form, still lands here and
 * still redirects, and it is the one the site actually published.
 */
export default async function LegacyDayPage({
  params,
}: {
  params: Promise<{ lang: string; date: string }>;
}) {
  const { lang, date } = await params;
  permanentRedirect(langHref(isLang(lang) ? lang : DEFAULT_LANG, dayPath(date)));
}
