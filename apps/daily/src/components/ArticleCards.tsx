import { Cover } from "./Cover";
import { EnglishBlock, Points } from "./Summary";
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
export function HeroCard({ article }: { article: Article }) {
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
          {/* Empty when the model failed for this article — the headline above
              already carries the meaning, so render nothing rather than
              padding the card with a restated title. */}
          {article.summary.zh.thesis ? (
            <p className="hero__thesis">{article.summary.zh.thesis}</p>
          ) : null}
        </div>
        <Cover
          id={article.id}
          sourceId={article.sourceId}
          image={article.image}
        />
      </div>

      <Points points={article.summary.zh.points} />
      <EnglishBlock en={article.summary.en} />
    </a>
  );
}

/** Ranks 2..N — shelf rows that keep the book-cover motif at a smaller size. */
export function ArticleCard({ article }: { article: Article }) {
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
        {article.summary.zh.thesis ? (
          <p className="card__thesis">{article.summary.zh.thesis}</p>
        ) : null}
        <Points points={article.summary.zh.points} />
        <EnglishBlock en={article.summary.en} />
      </div>
    </a>
  );
}
