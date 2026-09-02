import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SourceView } from "@/components/SourceView";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { sourcePath } from "@/lib/links";
import { hasSourcePage, SOURCE_BY_ID } from "@/lib/sources";
import { alternatesFor, ogCardFor } from "@/lib/seo";
import { articlesBySource } from "@/lib/store";

/** Dynamic for the same reason `/s` is — see the note there. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; source: string }>;
}): Promise<Metadata> {
  const { lang, source: id } = await params;
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);

  const source = SOURCE_BY_ID.get(id);
  if (!source) return { title: `${t.notFoundTitle} · ${t.brand}` };

  /**
   * THE THRESHOLD IS CHECKED HERE TOO, not just in the view.
   *
   * `generateMetadata` runs for a request the page then 404s, and a not-found
   * page carrying a real `<title>`, a canonical and an og:url is a 404 that
   * advertises itself as a page. The cost is that both halves walk the archive —
   * which is one call, because `articlesBySource` is cached across them. See the
   * note on that function.
   */
  const picked = (await articlesBySource()).get(source.id) ?? [];
  if (!hasSourcePage(picked.length)) {
    return { title: `${t.notFoundTitle} · ${t.brand}` };
  }

  /**
   * THE SOURCE'S NAME LEADS, and this is the one page on the site where the brand
   * does not.
   *
   * Every other title here is `每日严选 · <what>` because the brand is what the
   * page is part of. This page is ABOUT somebody else's blog, and the search it
   * has to win is that blog's name — a result reading `每日严选 · Dan Luu` buries
   * the word somebody typed behind a word they did not. The brand stays as the
   * suffix, which is what says whose page this is.
   */
  const title = `${source.name} · ${t.brand}`;
  /**
   * The description is the blog's own line where there is one, and the count where
   * there is not — see `SourceRow` for why `Source.description` is Chinese-only.
   * Never both: a `<meta>` that reads "…写什么。收录过 9 篇" is two sentences fighting
   * for the same forty characters.
   */
  const description =
    pageLang === "zh" && source.description
      ? source.description
      : `${source.name} — ${t.sourcePicked(picked.length)}`;

  const path = sourcePath(source.id);

  return {
    title,
    description,
    alternates: alternatesFor(pageLang, path),
    openGraph: {
      type: "website",
      title,
      description,
      url: `${SITE}${href(pageLang, path)}`,
      siteName: t.brand,
      // The site card. A per-source card would be a fourth image route drawing a
      // name on a coloured ground, which is what the site card already is.
      images: ogCardFor(pageLang, "site"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogCardFor(pageLang, "site").map((image) => image.url),
    },
  };
}

export default async function SourcePage({
  params,
}: {
  params: Promise<{ lang: string; source: string }>;
}) {
  const { lang, source } = await params;
  if (!isLang(lang)) notFound();
  return <SourceView lang={lang} id={source} />;
}
