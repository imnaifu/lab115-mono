import { displayTitle } from "./ArticleTitle";
import {
  EndLink,
  Footer,
  Masthead,
  MastheadDot,
  PAD,
  PageShell,
  SECTION,
  SectionHead,
} from "./Shell";
import { EmptyState } from "./DigestView";
import { categoryOf } from "@/lib/categories";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { articlePath, dayPath } from "@/lib/links";
import { sourceOf } from "@/lib/sources";
import type { Digest } from "@/lib/types";

/**
 * The front page: today's headlines, then the days before them.
 *
 * WHY THIS IS NOT `DigestView`, which is the whole point of the file. The home
 * page used to render exactly what `/d/<today>` rendered — same component, same
 * digest, same prose — and the two pages measured 99.9% identical. Google noticed
 * before we did: it clustered them, picked one, and reported the other as a
 * duplicate whose canonical it had overridden. A `<link rel="canonical">` between
 * them would have been a patch on a page that genuinely had a twin.
 *
 * So the twin is gone. A DAY holds the summaries — that is the content, and it
 * lives at one dated URL from the moment it is written. The FRONT PAGE holds
 * headlines and routes you to them, which is what a front page has always been.
 * No URL on this site now carries the same prose as another, so nothing needs a
 * canonical tag to arbitrate, nothing flips as the date rolls over, and every
 * dated page is indexable on the day it is published rather than the day after.
 *
 * THE COST IS REAL AND IT IS THE POINT: you can no longer read the whole edition
 * without one tap. `wholeDay` below is that tap, and it is the most prominent
 * thing on the page.
 */

/** One headline: what it says, where it came from, what kind of thing it is. */
function Headline({
  article,
  date,
  lang,
}: {
  article: Digest["articles"][number];
  date: string;
  lang: Lang;
}) {
  const source = sourceOf(article.sourceId);
  const category = categoryOf(article.category);

  return (
    <a
      className="flex flex-col gap-1.5 py-3.5"
      href={href(lang, articlePath(date, article))}
      data-track="article_open"
      data-track-from="front"
      data-track-source={article.sourceId}
    >
      <span className="text-base font-bold text-ink">
        {displayTitle(article, lang)}
      </span>
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-ink-soft">
        <span style={{ color: source.accent }}>{source.name}</span>
        <span className="size-0.75 rounded-full bg-current opacity-55" />
        <span style={{ color: category.accent }}>
          {lang === "en" ? category.nameEn : category.name}
        </span>
      </span>
    </a>
  );
}

/**
 * The days before today, as a short list.
 *
 * The lead headline is on each row rather than only a date and a count. Two
 * reasons, and the second is why it is not optional: a row that says only
 * `2026-08-23 · 5 篇` gives a reader nothing to choose from, and — the same
 * problem one layer down — it makes this list's Chinese and English renderings
 * near-identical strings of digits. The archive page had exactly that shape and
 * exactly that consequence, which is how `/zh/archive` ended up in the same
 * Search Console report as the home page.
 */
function Recent({
  days,
  lang,
}: {
  days: { date: string; lead: string; count: number }[];
  lang: Lang;
}) {
  const t = strings(lang);
  if (days.length === 0) return null;

  return (
    <section className={`${SECTION} flex flex-col gap-3.5 ${PAD}`}>
      <SectionHead title={t.recentHeading} count={t.days(days.length)} />
      <div className="divide-y divide-line rounded-card bg-cream-deep px-5 py-1">
        {days.map((day) => (
          <a
            className="flex flex-col gap-1 py-3.5"
            key={day.date}
            href={href(lang, dayPath(day.date))}
            data-track="day_open"
            data-track-from="front"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-bold text-ink">{day.date}</span>
              <span className="text-xs font-bold whitespace-nowrap text-ink-soft">
                {t.sectionCount(day.count)}
              </span>
            </span>
            <span className="line-clamp-1 text-sm text-ink-mid">{day.lead}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function FrontPage({
  digest,
  recent,
  lang,
}: {
  /** The newest digest on disk — today's, or the last one written. */
  digest: Digest;
  /** Every day BEFORE the one above, newest first, already trimmed. */
  recent: { date: string; lead: string; count: number }[];
  lang: Lang;
}) {
  const t = strings(lang);

  return (
    <PageShell>
      {/* `path` is "/" — this page's own bare path, so the language switch lands
          back here rather than on the dated page it links to. */}
      <Masthead title={t.brand} lang={lang} path="/">
        <span>{digest.date}</span>
        <MastheadDot />
        {/* `shown`, not `fetched`: the publish floor drops the rest, so fetched
            would promise headlines that are not on the page. */}
        <span>{t.posts(digest.stats.shown)}</span>
      </Masthead>

      {digest.articles.length > 0 ? (
        <section className={`${SECTION} flex flex-col gap-3.5 ${PAD}`}>
          <SectionHead
            title={t.todayHeading}
            count={t.sectionCount(digest.articles.length)}
          />
          {/* PUBLISHED ORDER — by score, the same order the day page opens on.
              Not grouped by category: the tabs that make grouping navigable are a
              client component built for a page of cards, and a list of headlines
              short enough to read at a glance does not need to be filtered. */}
          <div className="divide-y divide-line rounded-card bg-card px-5 py-1 shadow-soft">
            {digest.articles.map((article) => (
              <Headline
                key={article.id}
                article={article}
                date={digest.date}
                lang={lang}
              />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState lang={lang} />
      )}

      {/* THE PRIMARY ACTION, above the archive rather than beside it: the reader
          who just scanned the headlines wants the edition, and everything else on
          this page is a way of not reading it. */}
      <div className={PAD}>
        <EndLink
          href={href(lang, dayPath(digest.date))}
          label={t.wholeDay}
          sub={t.wholeDaySub(digest.date, digest.stats.shown)}
          track="day_open"
          trackFrom="front"
        />
      </div>

      <Recent days={recent} lang={lang} />

      <div className={PAD}>
        <EndLink
          href={href(lang, "/archive")}
          label={t.archive}
          sub={t.archiveSub}
          track="archive_open"
          trackFrom="front"
        />
      </div>

      <Footer year={digest.date.slice(0, 4)} lang={lang} />
    </PageShell>
  );
}
