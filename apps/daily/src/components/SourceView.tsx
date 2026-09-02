import { notFound } from "next/navigation";
import { displayTitle } from "./ArticleTitle";
import {
  Breadcrumb,
  EndLink,
  Footer,
  Masthead,
  MastheadDot,
  PAD,
  PageShell,
  SECTION,
} from "./Shell";
import { SubscribeSection } from "./SubscribeSection";
import { themedAccent } from "@/lib/accent";
import { categoryOf } from "@/lib/categories";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { articlePath, SOURCES_PATH, sourcePath } from "@/lib/links";
import { descriptionFor, hasSourcePage, SOURCE_BY_ID } from "@/lib/sources";
import { breadcrumb, JsonLd, publisher } from "@/lib/seo";
import { articlesBySource, listDates } from "@/lib/store";

/**
 * `/s/<id>` — one blog, and every take this site has written about it.
 *
 * WHAT IS ON HERE THAT IS NOWHERE ELSE. The run of takes for one source, oldest
 * to newest, which no other page assembles: the front page and the archive are
 * ordered by DAY, so a reader who liked one piece from a blog has no way to find
 * the others and a crawler has no page that establishes the relationship. This is
 * also the long tail worth having — "Dan Luu 博客", "Construction Physics 是什么"
 * are searches with almost nothing behind them in Chinese, and this page is a real
 * answer to them rather than a keyword.
 *
 * THE THRESHOLD IS THE POINT OF THE 404. Below `SOURCE_MIN_ARTICLES` this page
 * would be a heading, a borrowed one-line description and a single link that the
 * article's own page already carries better — thin by any definition, and sixty
 * of them is a doorway set. See the note on that constant for the measured reason
 * it is three.
 *
 * IT IS NOT A LIST OF THE BLOG'S POSTS and must never read as one. Everything here
 * is what WE ran: `sourcePicked` says 收录过 N 篇 rather than N 篇文章, and the
 * count is capped by `PUBLISH_PER_SOURCE` and the score floor rather than by what
 * the blog published. Claiming otherwise would be reporting a false output figure
 * for somebody else's writing.
 */
export async function SourceView({
  lang,
  id,
}: {
  lang: Lang;
  id: string;
}) {
  const t = strings(lang);

  /**
   * `SOURCE_BY_ID`, NOT `sourceOf`. That helper falls back to a placeholder so an
   * archived digest naming a removed source still renders — which is right on a
   * card and wrong here: it would give every typo a page, titled with the typo.
   */
  const source = SOURCE_BY_ID.get(id);
  if (!source) notFound();

  const [bySource, dates] = await Promise.all([articlesBySource(), listDates()]);
  const picked = bySource.get(source.id) ?? [];
  if (!hasSourcePage(picked.length)) notFound();

  const path = sourcePath(source.id);
  const url = `${SITE}${href(lang, path)}`;
  const beat = categoryOf(source.category);
  const description = descriptionFor(source, lang);

  return (
    <PageShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": url,
          url,
          name: `${source.name} · ${t.brand}`,
          inLanguage: lang === "zh" ? "zh-CN" : "en-US",
          publisher: publisher(t.brand),
          isPartOf: { "@id": `${SITE}${href(lang, "/")}#site` },
          /**
           * `about` IS THE WHOLE STRUCTURED-DATA CLAIM OF THIS PAGE: it is not
           * about us, it is about somebody else's blog, and it names that blog by
           * its own URL. That is what lets a crawler connect this page to the
           * entity a reader searched for — the same job `isBasedOn` does on an
           * article page, one level up.
           *
           * `Blog` rather than `Organization`: most of these are one person
           * writing, and the thing being described is the publication.
           */
          about: {
            "@type": "Blog",
            name: source.name,
            url: source.site,
            ...(source.feed
              ? { mainEntityOfPage: { "@type": "WebPage", url: source.feed } }
              : {}),
          },
          breadcrumb: breadcrumb([
            { name: t.brand, url: `${SITE}${href(lang, "/")}` },
            { name: t.sourcesTitle, url: `${SITE}${href(lang, SOURCES_PATH)}` },
            { name: source.name, url },
          ]),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: picked.length,
            itemListElement: picked.map(({ date, article }, at) => ({
              "@type": "ListItem",
              position: at + 1,
              url: `${SITE}${href(lang, articlePath(date, article))}`,
              name: displayTitle(article, lang),
            })),
          },
        }}
      />

      <Masthead
        title={t.brand}
        subtitle={t.tagline}
        crumb={
          <Breadcrumb
            label={t.breadcrumb}
            items={[
              { label: t.home, href: href(lang, "/") },
              { label: t.sourcesTitle, href: href(lang, SOURCES_PATH) },
              { label: source.name },
            ]}
          />
        }
        lang={lang}
        path={path}
      >
        <span>{t.sourcePicked(picked.length)}</span>
        <MastheadDot />
        <span>
          {t.sourceBeat} {lang === "zh" ? beat.name : beat.nameEn}
        </span>
      </Masthead>

      {/**
       * THE SOURCE'S NAME IS THE H1, and the masthead above says the brand — the
       * same division the article page uses, for the same reason. The document is
       * about this blog; the lockup is whose site it is on.
       */}
      <section className={`${SECTION} ${PAD}`}>
        <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight text-ink">
          <span
            className="size-2.5 flex-none rounded-full"
            style={{ background: themedAccent(source.accent) }}
          />
          {source.name}
        </h1>

        {/* In the reader's language, through the one rule both this page and the
            directory row use — see `descriptionFor`. Branched on empty because a
            retired source resolves to a placeholder that has no line. */}
        {description ? (
          <p className="mt-3 max-w-prose text-ink-mid">{description}</p>
        ) : null}

        {/**
         * OUT TO THE BLOG ITSELF, and it is the only outbound link on the page.
         *
         * It carries no `data-track`. `read_original` is the digest's
         * counter-metric — "the reader skipped our take and went to the article" —
         * and this is not that: nobody arrives here holding a summary they might
         * have read instead. Inventing an event for it would put a number in the
         * report that measures nothing, and `TrackEvent` is a closed union for
         * exactly that reason. See the footer's note in Shell.tsx.
         *
         * No `target="_blank"`: same rule as every other outbound link here.
         */}
        <a
          className="mt-4 inline-block text-sm font-bold text-ink-mid transition-colors hover:text-ink"
          href={source.site}
        >
          {t.sourceSite}
        </a>
      </section>

      {/**
       * The run of takes, newest first — the reason this page exists.
       *
       * A DATE PLUS A HEADLINE PER ROW, which is `DayList`'s shape turned ninety
       * degrees: that component lists days and names each day's lead, this one
       * lists pieces and names the day each ran on. Not the same component,
       * because they are not the same list — and no summary text in the rows,
       * because a page of twenty stacked theses is a page nobody reads to the
       * bottom of, and each one is a click away.
       */}
      <section className={`${SECTION} ${PAD}`}>
        <h2 className="text-2xl font-bold tracking-tight text-ink">
          {t.sourceTakes}
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {picked.map(({ date, article }, at) => (
            <a
              className="flex flex-col gap-1.5 rounded-xl border border-line bg-paper px-5 py-4"
              key={`${date}-${article.id}`}
              href={href(lang, articlePath(date, article))}
              /* `day_open` is for a DAY page; this opens an article. `age` is the
                 row's depth in this list, the same question DayList asks: how far
                 down a source's run anybody actually reads. */
              data-track="source_open"
              data-track-from="source"
              data-track-age={at}
            >
              <span className="text-sm font-bold text-ink-soft">{date}</span>
              <span className="text-lg font-bold text-ink">
                {displayTitle(article, lang)}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Back to the directory rather than to the front page: a reader who came
          for one blog is more likely to want another one than to want today. */}
      <div className={PAD}>
        <EndLink
          href={href(lang, SOURCES_PATH)}
          label={t.sourcesTitle}
          sub={t.allSourcesSub}
        />
      </div>

      <SubscribeSection lang={lang} />

      <Footer
        year={dates[0]?.slice(0, 4) ?? String(new Date().getUTCFullYear())}
        lang={lang}
      />
    </PageShell>
  );
}
