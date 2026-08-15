import { Cover } from "./Cover";
import { Summary } from "./Summary";
import { sourceOf } from "@/lib/sources";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { articlePath } from "@/lib/links";
import type { Article } from "@/lib/types";

/** The dot between meta items. `bg-current` so it matches whatever colour the
 *  row is drawn in. */
function Dot() {
  return <span className="size-0.75 rounded-full bg-current opacity-55" />;
}

function Meta({ article, lang }: { article: Article; lang: Lang }) {
  const source = sourceOf(article.sourceId);

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs font-semibold text-ink-soft">
      <span style={{ color: source.accent }}>{source.name}</span>
      <Dot />
      <span>{strings(lang).minutes(article.readingMinutes)}</span>
      {article.author ? (
        <>
          <Dot />
          <span>{article.author}</span>
        </>
      ) : null}
    </div>
  );
}


/**
 * The two things you can do with an article, stated at the end of it.
 *
 * The whole card used to be one big link to the original, with the share pill
 * floated over it on `z-10` — the "stretched link" pattern, needed because a
 * link cannot legally contain another interactive element. Naming both actions
 * instead removes that whole contrivance: no absolute overlay, no z-index, no
 * invisible anchor, and the summary text can be selected and copied like text.
 */
function Actions({
  article,
  date,
  lang,
}: {
  article: Article;
  date: string;
  lang: Lang;
}) {
  const t = strings(lang);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
      <a
        className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper"
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t.readFull}
      </a>
      <a
        className="rounded-full border border-line px-4 py-2 text-sm font-bold text-ink-mid"
        href={href(lang, articlePath(date, article.id))}
      >
        {t.share}
      </a>
    </div>
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
export function ArticleCard({
  article,
  date,
  lang,
}: {
  article: Article;
  date: string;
  lang: Lang;
}) {
  return (
    <div className="flex items-start gap-4 rounded-card bg-card p-4 shadow-soft">
      <Cover
        id={article.id}
        sourceId={article.sourceId}
        image={article.image}
        variant="card"
      />
      <div className="min-w-0 flex-1">
        <Meta article={article} lang={lang} />
        <h3 className="mt-2 text-lg font-bold text-ink">{article.title}</h3>
        <Summary summary={article.summary} variant="card" lang={lang} />
        <Actions article={article} date={date} lang={lang} />
      </div>
    </div>
  );
}
