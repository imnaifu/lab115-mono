import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArchiveView } from "@/components/ArchiveView";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { alternatesFor, archiveDocTitle, ogCardFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * `/archive` — the NEWEST month of editions.
 *
 * THE BODY IS `ArchiveView`, shared with `/archive/<yyyy-mm>`. This route exists
 * to be the front of the archive: the newest month is here and is NOT also
 * linked at its own dated URL from inside the site, so one page has one address.
 *
 * ITS CONTENT CHANGES ON THE FIRST OF EVERY MONTH, which is correct for a
 * "latest" view and is why the sitemap lists the DATED month URLs rather than
 * this one — see the archive loop there.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);
  const title = archiveDocTitle(t.brand, t.archiveTitle);

  return {
    title,
    description: t.archiveLead,
    alternates: alternatesFor(pageLang, "/archive"),
    /**
     * Declared rather than inherited, and the reason is the URL: with no
     * `openGraph` of its own this page falls back to the layout's, which names
     * the HOME page as og:url — so an archive link pasted anywhere unfurls as
     * the front page. Every other field is inherited by hand for that one
     * correction. The card is the site card: a list of dates has no card of its
     * own to draw.
     */
    openGraph: {
      type: "website",
      title,
      description: t.archiveLead,
      url: `${SITE}${href(pageLang, "/archive")}`,
      siteName: t.brand,
      images: ogCardFor(pageLang, "site"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t.archiveLead,
      images: ogCardFor(pageLang, "site").map((image) => image.url),
    },
  };
}

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <ArchiveView lang={lang} />;
}
