import { Cover } from "./Cover";
import { Summary, type Lang } from "./Summary";
import { sourceOf } from "@/lib/sources";
import type { Article } from "@/lib/types";

/** The dot between meta items. `bg-current` so it matches whatever colour the
 *  row is drawn in. */
function Dot() {
  return <span className="size-0.75 rounded-full bg-current opacity-55" />;
}

function Meta({ article }: { article: Article }) {
  const source = sourceOf(article.sourceId);

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs font-semibold text-ink-soft">
      <span style={{ color: source.accent }}>{source.name}</span>
      <Dot />
      <span>{article.readingMinutes} 分钟</span>
      {article.author ? (
        <>
          <Dot />
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
      className="block rounded-card bg-card p-5 shadow-soft"
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="flex flex-col items-start gap-5 sm:flex-row">
        <div className="min-w-0 flex-1">
          <span className="inline-flex rounded-full bg-ink px-2.5 py-1 text-xs font-bold whitespace-nowrap text-paper">
            今日头条 · TOP 1
          </span>
          <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {article.title}
          </h2>
          <div className="mt-2.5">
            <Meta article={article} />
          </div>
        </div>
        <Cover
          id={article.id}
          sourceId={article.sourceId}
          image={article.image}
          variant="hero"
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
      className="flex items-start gap-4 rounded-card border border-line bg-paper p-4"
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Cover
        id={article.id}
        sourceId={article.sourceId}
        image={article.image}
        variant="card"
      />
      <div className="min-w-0 flex-1">
        <Meta article={article} />
        <h3 className="mt-2 text-lg font-bold text-ink">{article.title}</h3>
        <Summary summary={article.summary[lang]} variant="card" />
      </div>
    </a>
  );
}
