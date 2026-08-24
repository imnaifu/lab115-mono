import { notFound, permanentRedirect } from "next/navigation";
import { href as langHref, isLang, DEFAULT_LANG } from "@/lib/lang";
import { articlePath } from "@/lib/links";
import { readArticle } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The old shape of an article's URL: `/zh/d/2026-08-14/ff36a72e`.
 *
 * UNLIKE THE DAY REDIRECT NEXT DOOR, this one has to read the digest. The new URL
 * ends in `<slug>-<id>` and the slug is built from the headline, so there is no
 * way to compute the destination from the old path alone — the article is the only
 * place the headline exists.
 *
 * `readArticle` matches on an id PREFIX, which is what makes this cover both old
 * forms: the eight-character links the site published, and the full forty-character
 * sha1 from before links were shortened.
 *
 * A miss is a 404 rather than a redirect to the day: a stale link to an article
 * that was never written should say so, and bouncing it to a list the reader did
 * not ask for hides the fact that the thing they clicked is gone.
 */
export default async function LegacyArticlePage({
  params,
}: {
  params: Promise<{ lang: string; date: string; id: string }>;
}) {
  const { lang, date, id } = await params;
  const found = await readArticle(date, id);
  if (!found) notFound();

  permanentRedirect(
    langHref(
      isLang(lang) ? lang : DEFAULT_LANG,
      articlePath(date, found.article),
    ),
  );
}
