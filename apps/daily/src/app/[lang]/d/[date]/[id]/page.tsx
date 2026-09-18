import { notFound, permanentRedirect } from "next/navigation";
import { href as langHref, isLang } from "@/lib/lang";
import { articlePath, dayPath } from "@/lib/links";
import { readArticleBySlug, readDigest, retiredMatch } from "@/lib/store";

/**
 * `/d/2026-08-26/cc5c01af` — AN ARTICLE'S OLD ADDRESS.
 *
 * The companion to the day redirect next door, and the one that actually
 * mattered: these are the URLs that were shared, that went out in the mail, and
 * that Google indexed. Eleven of the twenty-one dead addresses found in Search
 * Console have this shape.
 *
 * WHY THIS IS A ROUTE AND NOT A RULE IN `proxy.ts`: the destination cannot be
 * computed from the old URL. `/d/<date>/<id>` carries an id; the address it moved
 * to is `/<y>/<m>/<d>/<slug>-<id>`, and the slug only exists inside that day's
 * digest. The proxy is compiled for the edge runtime and cannot read the
 * filesystem — so the lookup has to happen in a server component, which is this.
 *
 * `readArticleBySlug` DOES THE MATCHING, unchanged, because it already had to:
 * its second lookup pulls the id off the end of a segment precisely so that links
 * predating slugs keep working. A bare eight-character id is that case with the
 * words removed, so it resolves through the same branch and there is no second
 * rule about ids to keep in step with the first.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ lang: string; date: string; id: string }> };

export default async function LegacyArticlePage({ params }: Params) {
  const { lang, date, id } = await params;
  if (!isLang(lang)) notFound();

  const found = await readArticleBySlug(date, id);
  if (found) {
    permanentRedirect(langHref(lang, articlePath(date, found.article)));
  }

  /**
   * NO ARTICLE — then the same two answers the current article page gives.
   *
   * An id this site once published but has since dropped goes to its day; see
   * `retired` on `Digest`. Anything else is a 404, because it is one. Both halves
   * are here rather than delegated by redirecting to the new-style URL first: a
   * retired article has no slug to build that URL from any more, so the hop would
   * have nowhere to land.
   */
  const digest = await readDigest(date);
  if (digest && retiredMatch(digest, id)) {
    permanentRedirect(langHref(lang, dayPath(date)));
  }
  notFound();
}
