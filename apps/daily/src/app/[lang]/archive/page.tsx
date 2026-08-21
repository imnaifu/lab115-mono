import type { Metadata } from "next";
import { EndLink, Footer, Masthead, PAD, PageShell, SECTION } from "@/components/Shell";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { dateKey } from "@/lib/config";
import { notFound } from "next/navigation";
import { alternatesFor } from "@/lib/seo";
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
  return {
    title: `${t.archiveTitle} · ${t.brand}`,
    // What the page actually offers, which is a count of days. It had no
    // description at all, so a result for it showed the site's tagline and looked
    // like a second home page.
    description: `${t.days(dates.length)} · ${t.tagline}`,
    alternates: alternatesFor(pageLang, "/archive"),
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
        <EndLink href={href(lang, "/")} label={t.today} sub={t.todaySub} />
      </div>

      <Footer year={dateKey(new Date()).slice(0, 4)} lang={lang} />
    </PageShell>
  );
}
