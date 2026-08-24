import type { Metadata } from "next";
import { EndLink, Footer, Masthead, PAD, PageShell, SECTION } from "@/components/Shell";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { dateKey, SITE } from "@/lib/config";
import { notFound } from "next/navigation";
import { alternatesFor, breadcrumb, JsonLd, ogCardFor, publisher } from "@/lib/seo";
import { readDigest, listDates } from "@/lib/store";

export const dynamic = "force-dynamic";

/** A function rather than a constant, because the brand in it is per-language. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);
  const dates = await listDates();
  const description = `${t.days(dates.length)} · ${t.tagline}`;

  return {
    title: `${t.archiveTitle} · ${t.brand}`,
    // What the page actually offers, which is a count of days. It had no
    // description at all, so a result for it showed the site's tagline and looked
    // like a second home page.
    description,
    alternates: alternatesFor(pageLang, "/archive"),
    /**
     * Declared rather than inherited, and the reason is the URL.
     *
     * With no `openGraph` of its own this page fell back to the layout's, which
     * names the HOME page as og:url and the home page's title as the card's title
     * — so an archive link pasted anywhere unfurled as the front page. Every other
     * field is inherited-by-hand here for that one correction.
     *
     * THE CARD IS THE SITE CARD, deliberately: `ogCardFor(pageLang, "/")` and not
     * `"/archive"`. The archive is a list of dates, and a card drawn from dates is
     * a card with nothing on it — what a reader seeing this link needs is what the
     * site is and what is on it today. See app/[lang]/og.png/route.tsx, which is
     * the one route serving both pages for exactly this reason.
     */
    openGraph: {
      type: "website",
      title: `${t.archiveTitle} · ${t.brand}`,
      description,
      url: `${SITE}${href(pageLang, "/archive")}`,
      siteName: t.brand,
      images: ogCardFor(pageLang, "/"),
    },
    twitter: {
      card: "summary_large_image",
      title: `${t.archiveTitle} · ${t.brand}`,
      description,
      images: ogCardFor(pageLang, "/").map((image) => image.url),
    },
  };
}

export default async function Archive({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = strings(lang);

  const dates = await listDates();
  // Small enough to just open every file — one JSON per day, and the archive
  // page is not on the screenshot path.
  const rows = await Promise.all(
    dates.map(async (date) => ({ date, digest: await readDigest(date) })),
  );

  return (
    <PageShell>
      {/**
       * The archive, as the list of days it is.
       *
       * `ItemList` is NOT drawn here, unlike on the home and day pages, and the
       * omission is deliberate: the items are dates, and a list of twenty
       * `ListItem`s whose only `name` is a date says nothing a crawler cannot read
       * off the links themselves. What this page needed was the two things it had
       * no way to state — that it is a `CollectionPage` belonging to this site, and
       * where it sits in the trail.
       */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": `${SITE}${href(lang, "/archive")}`,
          url: `${SITE}${href(lang, "/archive")}`,
          name: `${t.archiveTitle} · ${t.brand}`,
          inLanguage: lang === "zh" ? "zh-CN" : "en-US",
          publisher: publisher(t.brand),
          isPartOf: { "@id": `${SITE}${href(lang, "/")}#site` },
          breadcrumb: breadcrumb([
            { name: t.brand, url: `${SITE}${href(lang, "/")}` },
            { name: t.archiveTitle, url: `${SITE}${href(lang, "/archive")}` },
          ]),
        }}
      />
      <Masthead title={t.archiveTitle} lang={lang} path="/archive">
        <span>{t.days(dates.length)}</span>
      </Masthead>

      <section className={`${SECTION} flex flex-col gap-2.5 ${PAD}`}>
        {rows.length === 0 ? (
          <div className="rounded-card bg-cream-deep px-5 py-4">
            {t.nothingArchived}
          </div>
        ) : (
          rows.map(({ date, digest }) => (
            <a
              className="flex items-center justify-between gap-3.5 rounded-xl border border-line bg-paper px-5 py-4"
              key={date}
              href={href(lang, `/d/${date}`)}
              /* `age` rather than the date itself: which day was opened is not
                 the question — how far back readers actually reach is, and that
                 is what says whether the archive is a product or a formality. */
              data-track="day_open"
              data-track-from="archive"
              data-track-age={rows.findIndex((row) => row.date === date)}
            >
              <span className="text-lg font-bold text-ink">{date}</span>
              <span className="text-sm font-bold text-ink-soft">
                {digest ? t.sectionCount(digest.stats.shown) : "—"}
              </span>
            </a>
          ))
        )}
      </section>

      <div className={PAD}>
        <EndLink
          href={href(lang, "/")}
          label={t.today}
          sub={t.todaySub}
          track="today_open"
          trackFrom="archive"
        />
      </div>

      <Footer year={dateKey(new Date()).slice(0, 4)} lang={lang} />
    </PageShell>
  );
}
