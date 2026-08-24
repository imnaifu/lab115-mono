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
 * `/zh/d/…` reaches this at all only because `proxy.ts` redirects the prefix away
 * first: a reader following an old link pays two hops. That is deliberate — the
 * single-hop version needs the proxy to know the new path shape, and it runs on
 * the edge where the digests are not readable. A handful of links, none of them
 * hot, is not worth a second definition of these rules.
 */
export default async function LegacyDayPage({
  params,
}: {
  params: Promise<{ lang: string; date: string }>;
}) {
  const { lang, date } = await params;
  permanentRedirect(langHref(isLang(lang) ? lang : DEFAULT_LANG, dayPath(date)));
}
