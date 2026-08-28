import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { ArchiveView } from "@/components/ArchiveView";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { archivePath } from "@/lib/paging";
import { alternatesFor, archiveDocTitle, ogCardFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ lang: string; page: string }> };

/**
 * The page number, or null if this segment is not one.
 *
 * STRICT: only a run of digits with no leading zero, and never `1`. `/archive/1`
 * is a second address for `/archive` and is redirected rather than rendered — see
 * `archivePath`. `01`, `1.0`, `2e1` and the like are not page numbers at all.
 */
function pageNumber(segment: string): number | null {
  if (!/^[1-9][0-9]*$/.test(segment)) return null;
  return Number(segment);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, page: segment } = await params;
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);
  const page = pageNumber(segment);
  if (page === null) return { title: `${t.notFoundTitle} · ${t.brand}` };

  const path = archivePath(page);
  /* Carries the page number from 2 up — see archiveDocTitle, which is also why
     `openGraph` and `twitter` below now get the same string the tab does. They
     used to get the un-numbered one, so a link to page 2 unfurled as page 1. */
  const title = archiveDocTitle(t.brand, t.archiveTitle, page);

  return {
    title,
    description: t.tagline,
    // SELF-CANONICAL, per page. Pointing every page at `/archive` is the common
    // mistake and it hides pages 2 and up from the index — which here is most of
    // the archive.
    alternates: alternatesFor(pageLang, path),
    openGraph: {
      type: "website",
      title,
      description: t.tagline,
      url: `${SITE}${href(pageLang, path)}`,
      siteName: t.brand,
      images: ogCardFor(pageLang, "site"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t.tagline,
      images: ogCardFor(pageLang, "site").map((image) => image.url),
    },
  };
}

export default async function ArchivePagedPage({ params }: Params) {
  const { lang, page: segment } = await params;
  if (!isLang(lang)) notFound();

  const page = pageNumber(segment);
  if (page === null) notFound();
  // `/archive/1` is `/archive`. One page, one URL.
  if (page === 1) permanentRedirect(href(lang, "/archive"));

  return <ArchiveView lang={lang} page={page} />;
}
