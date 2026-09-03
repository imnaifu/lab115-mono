import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SourcesView } from "@/components/SourcesView";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { SOURCES_PATH } from "@/lib/links";
import { SOURCE_PAGES_LIVE } from "@/lib/sources";
import { alternatesFor, ogCardFor } from "@/lib/seo";

/**
 * `/s` — the directory of every blog this site reads.
 *
 * `force-dynamic` LIKE EVERY OTHER PAGE HERE, and not by preference: this page
 * walks the archive to count each source's takes, which is exactly the work a
 * cached render would save. It cannot be cached at the route level — the root
 * layout reads `headers()` for the language, which makes everything beneath it
 * dynamic — so the saving is done one level down instead, in `articlesBySource`.
 * See the note there.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);

  /**
   * THE HIDE IS CHECKED HERE TOO, not just in the page below.
   *
   * `generateMetadata` runs for a request the page then 404s, and a not-found
   * page carrying a real `<title>`, a canonical and an og:url is a 404 that
   * advertises itself as a page. Exactly the reasoning — and the shape — the
   * per-source route already uses for its threshold; see the note there.
   */
  if (!SOURCE_PAGES_LIVE) {
    return { title: `${t.notFoundTitle} · ${t.brand}` };
  }

  // Brand first, then the page — the shape `archiveDocTitle` settled on. Not that
  // helper, because it also appends a page number and this list does not paginate.
  const title = `${t.brand} · ${t.sourcesTitle}`;

  return {
    title,
    /**
     * THE LEAD PARAGRAPH, not `t.tagline`.
     *
     * Every other page on this site describes itself with the site's tagline,
     * which is correct for pages that are the site's daily output. This page is
     * about something else — which blogs get read and on what rules — and it is
     * the one page here whose body text is ours rather than a summary of somebody
     * else's. A search result quoting the site's slogan instead would waste the
     * one snippet that could say something specific.
     */
    description: t.sourcesLead,
    alternates: alternatesFor(pageLang, SOURCES_PATH),
    // Declared rather than inherited, for the reason spelled out on the archive
    // route: without it the layout's og:url names the HOME page, so a link to
    // this one unfurls as the front page. The card itself is the site card —
    // there is no image drawn per source.
    openGraph: {
      type: "website",
      title,
      description: t.sourcesLead,
      url: `${SITE}${href(pageLang, SOURCES_PATH)}`,
      siteName: t.brand,
      images: ogCardFor(pageLang, "site"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t.sourcesLead,
      images: ogCardFor(pageLang, "site").map((image) => image.url),
    },
  };
}

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  /* The section is hidden — see SOURCE_PAGES_LIVE. The per-source route gets
     this through `hasSourcePage`; the directory has no threshold of its own to
     hang it on, so it asks directly. */
  if (!SOURCE_PAGES_LIVE) notFound();
  return <SourcesView lang={lang} />;
}
