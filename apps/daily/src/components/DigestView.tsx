import { DigestBody, type CategoryGroup } from "./DigestBody";
import {
  Footer,
  Masthead,
  MastheadDot,
  PAD,
  PageShell,
  SECTION,
  SectionHead,
} from "./Shell";
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { SITE } from "@/lib/config";
import { sourceOf } from "@/lib/sources";
import type { Article, Digest } from "@/lib/types";

/** "2026年8月10日 · 星期一" — rendered from the date key, not from a Date, so
 *  the server's timezone can never shift it by a day. */
function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
  return `${year}年${month}月${day}日 · 星期${weekday}`;
}

function FoldedList({ digest }: { digest: Digest }) {
  if (digest.folded.length === 0) return null;

  return (
    <section className={`${SECTION} flex flex-col gap-3.5 ${PAD}`}>
      <SectionHead title="其余更新" count={`${digest.folded.length} 篇`} />
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

export function EmptyState({ date }: { date: string }) {
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
        <h2 className="text-2xl font-bold text-ink">今日无更新</h2>
        <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-ink-mid">
          过去 24 小时里，订阅的几个源都没有发布新文章。明天同一时间再来。
          <br />
          No new posts from any source in the last 24 hours.
        </p>
      </div>
    </section>
  );
}

/**
 * Rank 1 goes in the hero; the rest are grouped into the sections defined in
 * categories.ts.
 *
 * Sections keep the registry's order rather than sorting by best rank, so the
 * page reads the same way every day — a fixed running order is what makes a
 * daily publication feel like one. Empty sections are dropped: an "投资 —
 * nothing today" heading is noise on a screenshot.
 */
function groupByCategory(articles: Article[]): CategoryGroup[] {
  const groups = new Map<string, Article[]>();
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

export function DigestView({ digest }: { digest: Digest }) {
  const [hero, ...rest] = digest.articles;
  const minutes = digest.articles.reduce((sum, a) => sum + a.readingMinutes, 0);

  return (
    <PageShell>
      <Masthead title="今日速读" subtitle="Daily Read">
        <span>{formatDate(digest.date)}</span>
        <MastheadDot />
        <span>{digest.stats.fetched} 篇新文章</span>
        {minutes > 0 ? (
          <>
            <MastheadDot />
            <span>精读约 {minutes} 分钟</span>
          </>
        ) : null}
      </Masthead>

      {hero ? (
        <DigestBody hero={hero} groups={groupByCategory(rest)} />
      ) : (
        <EmptyState date={digest.date} />
      )}

      <FoldedList digest={digest} />
      <Footer
        left={`${SITE.replace("https://", "")} · ${digest.date}`}
        link={<a href="/archive">归档 Archive</a>}
      />
    </PageShell>
  );
}
