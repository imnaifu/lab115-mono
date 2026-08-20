import { ArticleTitle, displayTitle } from "./ArticleTitle";
import { Cover } from "./Cover";
import { ShareButton } from "./ShareButton";
import { Stars } from "./Stars";
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
      {/* Last, because the author is optional and the stars are not — ending the
          line on them keeps the meta row the same shape on every card. Both this
          and the Dot render nothing when the article was never scored, so no
          orphaned separator is left behind. */}
      {article.score > 0 ? (
        <>
          <Dot />
          <Stars score={article.score} lang={lang} />
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
 *
 * Sharing HAPPENS HERE now rather than on the article page. The pill was a link
 * down to that page's share block, which meant a navigation between deciding to
 * share and being able to; the reader has just finished the summary and the thing
 * they want is the sheet. What gets shared is still the article's permalink — see
 * ShareButton.
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
      {/* Secondary. Reading the original means leaving — this digest exists so
          that most of the time you do not have to, and the emphasis should not
          push you off the page it just spent 450 characters replacing. */}
      <a
        className="rounded-full border border-line px-4 py-2 text-sm font-bold text-ink-mid"
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t.readFull}
      </a>
      <ShareButton
        url={href(lang, articlePath(date, article.id))}
        imageUrl={`${href(lang, articlePath(date, article.id))}/share.png`}
        title={displayTitle(article, lang)}
        thesis={article.summary[lang].thesis}
        lang={lang}
      />
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
    // No `gap` on the column: `Summary` and `Actions` each bring their own
    // `mt-4`, so the existing vertical rhythm is already right.
    //
    <div className="flex flex-col rounded-card bg-card p-4 shadow-soft">
      {/* The cover sits beside the HEADLINE, not beside the whole card.
          It used to be the left column of a full-height split, which worked
          while a summary was two lines. At 3–5 paragraphs it stopped working
          twice over: the cover's 88px sat above ~800px of empty gutter, and it
          held 80px away from the prose all the way down, leaving a ~246px
          measure on a phone — about five words a line. Bounding the split to
          this row gives the summary the card's full width at every size and
          costs the cover nothing, because the 80px square is within a line of
          what the meta line plus the title occupy anyway.

          `items-center`, not `items-start`: a one-line title leaves the text
          block 28px shorter than the cover, and centred that reads as air above
          and below the headline instead of a hole under it. With a two-line
          title the two are the same height and this does nothing. */}
      <div className="flex items-center gap-3.5 sm:gap-4">
        <Cover
          id={article.id}
          sourceId={article.sourceId}
          image={article.image}
          variant="card"
        />
        <div className="min-w-0 flex-1">
          <Meta article={article} lang={lang} />
          <h3 className="mt-2 text-lg font-bold text-ink">
            <ArticleTitle article={article} lang={lang} variant="card" />
          </h3>
        </div>
      </div>

      <Summary summary={article.summary} variant="card" lang={lang} />
      <Actions article={article} date={date} lang={lang} />
    </div>
  );
}
