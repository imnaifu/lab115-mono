import { DigestBody, type CategoryGroup } from "./DigestBody";
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
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { strings } from "@/lib/i18n";
import { shownArticles } from "@/lib/store";
import { summaryFor } from "@/lib/take";
import { href, type Lang } from "@/lib/lang";
import { dayPath } from "@/lib/links";
import { summaryText, totalReadingMinutes } from "@/lib/reading";
import { sourceOf } from "@/lib/sources";
import type { PublishedArticle, Digest } from "@/lib/types";

/** Rendered from the date key, not from a Date, so the server's timezone can
 *  never shift it by a day. */
function formatDate(date: string, lang: Lang): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return strings(lang).date(year, month, day, weekday);
}

function FoldedList({ digest, lang }: { digest: Digest; lang: Lang }) {
  if (digest.folded.length === 0) return null;

  return (
    <section className={`${SECTION} flex flex-col gap-3.5 ${PAD}`}>
      <SectionHead
        title={strings(lang).otherUpdates}
        count={strings(lang).sectionCount(digest.folded.length)}
      />
      {/* `divide-y` replaces a `+` sibling rule: separators between rows, none
          above the first or below the last. */}
      <div className="divide-y divide-line rounded-card bg-cream-deep px-5 py-4">
        {digest.folded.map((item) => (
          <a
            className="flex items-baseline gap-2.5 py-2 text-sm"
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span
              className="flex-none text-xs font-extrabold"
              style={{ color: sourceOf(item.sourceId).accent }}
            >
              {sourceOf(item.sourceId).name}
            </span>
            <span>{item.title}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function EmptyState({ lang }: { lang: Lang }) {
  const t = strings(lang);
  return (
    <section className={`${SECTION} ${PAD}`}>
      <div className="rounded-card bg-card px-7 py-14 text-center">
        <div className="mx-auto mb-5 flex size-22 items-center justify-center rounded-full bg-cream">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M7 9.5A2.5 2.5 0 0 1 9.5 7H18v26H9.5A2.5 2.5 0 0 1 7 30.5v-21Z"
              fill="#3B3563"
              opacity="0.9"
            />
            <path
              d="M33 9.5A2.5 2.5 0 0 0 30.5 7H22v26h8.5a2.5 2.5 0 0 0 2.5-2.5v-21Z"
              fill="#EFA050"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-ink">{t.emptyTitle}</h2>
        <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-ink-mid">
          {t.emptyBody}
        </p>
      </div>
    </section>
  );
}

/**
 * Every article, grouped into the sections defined in categories.ts.
 *
 * Rank 1 used to be pulled out into a hero card above the tabs. It is gone: it
 * sat outside the category system, so the tabs could not reach it and it needed
 * a 「全部」 tab to be visible alongside everything else.
 *
 * Sections keep the registry's order rather than sorting by best rank, so the
 * page reads the same way every day — a fixed running order is what makes a
 * daily publication feel like one. Empty sections are dropped: an "投资 —
 * nothing today" heading is noise on a screenshot.
 */
function groupByCategory(articles: PublishedArticle[]): CategoryGroup[] {
  const groups = new Map<string, PublishedArticle[]>();
  for (const article of articles) {
    const id = categoryOf(article.category).id;
    const bucket = groups.get(id);
    if (bucket) bucket.push(article);
    else groups.set(id, [article]);
  }
  return CATEGORIES.map((category) => ({
    category,
    articles: groups.get(category.id) ?? [],
  })).filter((group) => group.articles.length > 0);
}

export function DigestView({
  digest,
  lang,
}: {
  digest: Digest;
  lang: Lang;
}) {
  const t = strings(lang);
  // ONE READ of the list, shared by the grouping, the reading-time total and
  // the body: `shownArticles` is what applies "no take means not published",
  // and calling it three times would be three chances to forget one.
  const shown = shownArticles(digest);
  const groups = groupByCategory(shown);

  /**
   * How long THIS PAGE takes, not how long the source articles take.
   *
   * It used to sum `article.readingMinutes`, which is measured on the original
   * body — "精读约 155 分钟" was the cost of clicking through to all fifteen
   * pieces and reading them end to end. Nobody is doing that, and the number it
   * put in the masthead described a page other than this one. The summaries are
   * the product; this measures the summaries.
   *
   * PER LANGUAGE, because the two halves are different lengths: `reading.ts`
   * normalises CJK at 400 characters a minute against English at 230 words, so
   * the same take measured on either side lands within a minute of the other —
   * but only if each side is measured on the text it actually shows. An /en page
   * that fell back to Chinese is measured on the Chinese, which is also correct:
   * that IS the text on the page.
   */
  const minutes = totalReadingMinutes(
    shown.map((a) => summaryText(summaryFor(a, lang))),
  );

  return (
    <PageShell>
      {/* `path` was a prop, back when this view also rendered the home page and the
          language switch had to land on whichever of the two you were actually on.
          The home page is a list of days now — see app/[lang]/page.tsx — so this
          serves one URL and the path is simply this digest's. */}
      <Masthead
        title={t.brand}
        subtitle={t.tagline}
        lang={lang}
        path={dayPath(digest.date)}
      >
        <span>{formatDate(digest.date, lang)}</span>
        <MastheadDot />
        {/* `shown`, not `fetched`: the publish floor drops the rest, so
            fetched would promise cards that are not on the page. */}
        <span>{t.posts(digest.stats.shown)}</span>
        {minutes > 0 ? (
          <>
            <MastheadDot />
            <span>{t.readTime(minutes)}</span>
          </>
        ) : null}
      </Masthead>

      {groups.length > 0 ? (
        <DigestBody
          articles={shown}
          groups={groups}
          date={digest.date}
          lang={lang}
        />
      ) : (
        <EmptyState lang={lang} />
      )}

      <FoldedList digest={digest} lang={lang} />

      <div className={PAD}>
        <EndLink
          /* THE FRONT PAGE, not `/archive`. The archive 404s until there are more
             days than the front page shows (see `hasArchive` in lib/paging), so
             linking straight to it from here would be a dead link for the site's
             first week and after any future change to that threshold. `/` is always
             a page, and it carries the route onward to the archive when there is
             one — day → front page → archive, with no condition to keep in sync. */
          href={href(lang, "/")}
          label={t.allDays}
          sub={t.allDaysSub}
          track="all_days_open"
        />
      </div>

      <Footer year={digest.date.slice(0, 4)} lang={lang} />
    </PageShell>
  );
}
