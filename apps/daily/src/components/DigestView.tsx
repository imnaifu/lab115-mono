import { ArticleCard, HeroCard } from "./ArticleCards";
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

function Masthead({ digest }: { digest: Digest }) {
  const minutes = digest.articles.reduce((sum, a) => sum + a.readingMinutes, 0);

  return (
    <header className="masthead">
      <span className="masthead__eyebrow">daily.lab115.com</span>
      <h1 className="masthead__title">
        今日速读
        <small>Daily Read</small>
      </h1>
      <div className="masthead__meta">
        <span>{formatDate(digest.date)}</span>
        <span className="masthead__dot" />
        <span>{digest.stats.fetched} 篇新文章</span>
        {minutes > 0 ? (
          <>
            <span className="masthead__dot" />
            <span>精读约 {minutes} 分钟</span>
          </>
        ) : null}
      </div>
    </header>
  );
}

/** Per-source pills. Successful sources are muted; a failed fetch is called
 *  out so a thin day is never mistaken for a quiet one. */
function SourceStatusBar({ digest }: { digest: Digest }) {
  if (digest.sources.length === 0) return null;

  return (
    <div className="status">
      {digest.sources.map((status) => (
        <span
          key={status.id}
          className={`status__chip${status.ok ? "" : " status__chip--bad"}`}
          title={status.error ?? undefined}
        >
          <span
            className="status__mark"
            style={{
              background: status.ok ? sourceOf(status.id).accent : undefined,
            }}
          />
          {status.name}
          {status.ok ? ` ${status.count}` : " 抓取失败"}
        </span>
      ))}
    </div>
  );
}

function FoldedList({ digest }: { digest: Digest }) {
  if (digest.folded.length === 0) return null;

  return (
    <section className="section pad">
      <div className="section__head">
        <h2 className="section__title">其余更新</h2>
        <span className="section__count">{digest.folded.length} 篇</span>
      </div>
      <div className="folded">
        {digest.folded.map((item) => (
          <a
            className="folded__item"
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span
              className="folded__source"
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
    <section className="section pad">
      <div className="empty">
        <div className="empty__mark">
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
        <h2 className="empty__title">今日无更新</h2>
        <p className="empty__sub">
          过去 24 小时里，订阅的几个源都没有发布新文章。明天同一时间再来。
          <br />
          No new posts from any source in the last 24 hours.
        </p>
      </div>
    </section>
  );
}

function Footer({ digest }: { digest: Digest }) {
  return (
    <footer className="foot pad">
      <span>
        {SITE.replace("https://", "")} · {digest.date}
      </span>
      <span className="foot__links">
        <a href="/archive">归档 Archive</a>
        <a
          href={`https://github.com/imnaifu/files/blob/main/daily/${digest.date.slice(0, 4)}/${digest.date.slice(5, 7)}/${digest.date}.json`}
          target="_blank"
          rel="noopener noreferrer"
        >
          JSON
        </a>
      </span>
    </footer>
  );
}

/**
 * Rank 1 goes in the hero; the rest are grouped by source so the page reads
 * like shelves, with the sections ordered by their best article's rank — that
 * keeps the global ranking visible without scattering each blog's posts.
 */
function groupBySource(articles: Article[]): Array<[string, Article[]]> {
  const groups = new Map<string, Article[]>();
  for (const article of articles) {
    const bucket = groups.get(article.sourceId);
    if (bucket) bucket.push(article);
    else groups.set(article.sourceId, [article]);
  }
  return [...groups.entries()].sort(
    (a, b) => a[1][0].rank - b[1][0].rank,
  );
}

export function DigestView({ digest }: { digest: Digest }) {
  const [hero, ...rest] = digest.articles;

  return (
    <div className="page">
      <Masthead digest={digest} />

      <div className="pad">
        <SourceStatusBar digest={digest} />
      </div>

      {hero ? (
        <section className="section pad">
          <HeroCard article={hero} />
        </section>
      ) : (
        <EmptyState date={digest.date} />
      )}

      {groupBySource(rest).map(([sourceId, articles]) => (
        <section className="section pad" key={sourceId}>
          <div className="section__head">
            <h2 className="section__title">{sourceOf(sourceId).name}</h2>
            <span className="section__count">{articles.length} 篇</span>
          </div>
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </section>
      ))}

      <FoldedList digest={digest} />
      <Footer digest={digest} />
    </div>
  );
}
