import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArchiveView } from "@/components/ArchiveView";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { alternatesFor, ogCardFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * `/archive` — the first page of the full run of dates.
 *
 * THE BODY IS `ArchiveView`, shared with `/archive/<n>`. This route exists only to
 * be the page-1 URL: `/archive/1` redirects here rather than rendering, so one page
 * never has two addresses.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);
  const title = `${t.archiveTitle} · ${t.brand}`;

  return {
    title,
    description: t.tagline,
    alternates: alternatesFor(pageLang, "/archive"),
    /**
     * Declared rather than inherited, and the reason is the URL: with no
     * `openGraph` of its own this page falls back to the layout's, which names the
     * HOME page as og:url — so an archive link pasted anywhere unfurls as the front
     * page. Every other field is inherited by hand for that one correction.
     *
     * THE CARD IS THE SITE CARD, deliberately. The archive is a list of dates, and
     * a card drawn from dates is a card with nothing on it; what a reader seeing
     * this link needs is what the site is and what is on it today.
     */
    openGraph: {
      type: "website",
      title,
      description: t.tagline,
      url: `${SITE}${href(pageLang, "/archive")}`,
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

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <ArchiveView lang={lang} page={1} />;
}
