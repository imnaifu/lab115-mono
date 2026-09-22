import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { ArchiveView } from "@/components/ArchiveView";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { archiveMonths, archivePath, isMonthKey } from "@/lib/paging";
import { alternatesFor, archiveDocTitle, ogCardFor } from "@/lib/seo";
import { listDates } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ lang: string; month: string }> };

/**
 * `/archive/2026-08` — one month of editions.
 *
 * IT ALSO ANSWERS THE OLD PAGE NUMBERS. `/archive/2` and up were real URLs until
 * the archive stopped paginating, they are in Google's index and in this site's
 * own sitemap, and a 404 would tell a crawler the page is gone and let the
 * signals it accumulated die with it. A 308 to `/archive` says where they went.
 * That is the same call as the `/zh/…` and `/d/…` redirects — see proxy.ts, and
 * see the note in lib/paging for why pagination went.
 *
 * `/archive/<newest month>` REDIRECTS TOO, to the bare `/archive`. The newest
 * month is the front of the archive and has that address; serving it at both
 * would be one page at two URLs, which is the mistake `/archive/1` was redirected
 * for.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, month } = await params;
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);
  if (!isMonthKey(month)) return { title: `${t.notFoundTitle} · ${t.brand}` };

  const title = archiveDocTitle(t.brand, t.archiveTitle, month);
  const path = archivePath(month);

  return {
    title,
    description: t.archiveLead,
    // SELF-CANONICAL. A month page pointing its canonical at `/archive` would be
    // asking Google to fold eleven months into whichever one is current.
    alternates: alternatesFor(pageLang, path),
    openGraph: {
      type: "website",
      title,
      description: t.archiveLead,
      url: `${SITE}${href(pageLang, path)}`,
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

export default async function ArchiveMonthPage({ params }: Params) {
  const { lang, month } = await params;
  if (!isLang(lang)) notFound();

  // The old numbered pages. See the note above.
  if (/^[1-9][0-9]*$/.test(month)) permanentRedirect(href(lang, "/archive"));

  if (!isMonthKey(month)) notFound();

  const months = archiveMonths(await listDates());
  if (months.length && month === months[0].month) {
    permanentRedirect(href(lang, "/archive"));
  }

  return <ArchiveView lang={lang} month={month} />;
}
