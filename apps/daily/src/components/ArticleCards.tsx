import { Cover } from "./Cover";
import { Summary, type Lang } from "./Summary";
import { sourceOf } from "@/lib/sources";
import type { Article } from "@/lib/types";

function Meta({ article }: { article: Article }) {
  const source = sourceOf(article.sourceId);
  return (
    <div className="meta">
      <span style={{ color: source.accent }}>{source.name}</span>
      <span className="meta__sep" />
      <span>{article.readingMinutes} 分钟</span>
      {article.author ? (
        <>
          <span className="meta__sep" />
          <span>{article.author}</span>
        </>
      ) : null}
    </div>
  );
}

/** Rank 1 — the template's "Currently reading" slot, given the most room. */
export function HeroCard({ article, lang }: { article: Article; lang: Lang }) {
  return (
    <a
      className="hero"
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="hero__top">
        <div className="hero__body">
          <span className="pill pill--rank">今日头条 · TOP 1</span>
          <h2 className="hero__title">{article.title}</h2>
          <div style={{ marginTop: 10 }}>
            <Meta article={article} />
          </div>
        </div>
        <Cover
          id={article.id}
          sourceId={article.sourceId}
          image={article.image}
        />
      </div>

      <Summary summary={article.summary[lang]} variant="hero" />
    </a>
  );
}

/**
 * Every published article — full card with cover and bilingual summary.
 *
 * There used to be an `ArticleRow` beside this one, carrying everything past a
 * section's `cardCount` as a single line. It existed because nothing was ever
 * dropped, so a heavy day had to stay readable without running to thirty full
 * cards. The publish floor took over that job: what reaches the page now earns
 * a card, and there is no tail left to compress.
 */
export function ArticleCard({ article, lang }: { article: Article; lang: Lang }) {
  return (
    <a
      className="card"
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Cover
        id={article.id}
        sourceId={article.sourceId}
        image={article.image}
      />
      <div className="card__body">
        <Meta article={article} />
        <h3 className="card__title">{article.title}</h3>
        <Summary summary={article.summary[lang]} variant="card" />
      </div>
    </a>
  );
}
