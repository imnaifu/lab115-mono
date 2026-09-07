import { themedAccent } from "@/lib/accent";
import { ArticleTitle, displayTitle } from "./ArticleTitle";
import { Cover } from "./Cover";
import { ShareButton } from "./ShareButton";
import { sourceOf } from "@/lib/sources";
import { posterParts } from "@/lib/share";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { articlePath, posterBase } from "@/lib/links";
import { summaryFor } from "@/lib/take";
import type { PublishedArticle } from "@/lib/types";

/** The dot between meta items. `bg-current` so it matches whatever colour the
 *  row is drawn in. */
function Dot() {
  return <span className="size-0.75 rounded-full bg-current opacity-55" />;
}

/**
 * The source, and the author when there is one.
 *
 * EXPORTED because the front page's lead uses it too. It was local while the
 * only thing that named an article was a list row; the teaser now carries the
 * same header block — cover, meta, headline — and two copies of a one-line
 * component are two places for the separator rules and the accent colour to
 * drift apart.
 */
export function Meta({ article, lang }: { article: PublishedArticle; lang: Lang }) {
  const source = sourceOf(article.sourceId);

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs font-semibold text-ink-soft">
      <span style={{ color: themedAccent(source.accent) }}>{source.name}</span>
      {/* NO READING TIME. It was the original article's, which described a page
          the reader was not on; measured on the summary instead it read "1 分钟"
          or "2 分钟" on every card in the digest, which is a column of identical
          numbers rather than information. The masthead still totals the day — see
          `minutes` in DigestView — because a whole edition's length does vary.

          The author is now optional AND last, so the Dot lives inside the same
          condition: an anonymous source ends the row on the source name with no
          separator left dangling. */}
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
  article: PublishedArticle;
  date: string;
  lang: Lang;
}) {
  const t = strings(lang);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
      {/**
       * THE PRIMARY ACTION, and it is the one that stays on this site.
       *
       * A row here shows the headline and the claim and stops — the take itself
       * lives on the article's own page now. So this is the link that finishes
       * what the card started, and it is THE ONLY FILLED BUTTON IN THE ROW —
       * `share` gave up its own dark pill when this arrived, and `readFull`
       * beside it leads OFF the site, which the note on it has always said the
       * emphasis should not push a reader towards.
       */}
      <a
        className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper"
        href={href(lang, articlePath(date, article))}
        data-track="summary_open"
        data-track-source={article.sourceId}
        data-track-from="list"
      >
        {t.readSummary}
      </a>
      {/* Secondary. Reading the original means leaving — this digest exists so
          that most of the time you do not have to, and the emphasis should not
          push you off the page it just spent 450 characters replacing. */}
      <a
        className="rounded-full border border-line px-4 py-2 text-sm font-bold text-ink-mid"
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        /**
         * THE COUNTER-METRIC. This digest exists so that most of the time a
         * reader does not have to click here, so this number is not a success
         * measure — it is what the summary is being judged against, per source.
         *
         * `data-*` rather than an onClick: see ClickTracking.
         */
        data-track="read_original"
        data-track-source={article.sourceId}
        data-track-from="list"
      >
        {t.readFull}
      </a>
      <ShareButton
        url={href(lang, articlePath(date, article))}
        /* The poster BASE, not an image: the sheet asks for several parts off it.
           It no longer hangs off the article's own path — see `posterBase` in
           lib/links — so it is built independently rather than by appending. */
        posterBase={posterBase(lang, date, article.id)}
        /* Counted HERE, on the server, where the summary and the poster's layout
           table both already are. The sheet is a client component and needs the
           number to know how many images to fetch and preview. */
        parts={posterParts(summaryFor(article, lang))}
        title={displayTitle(article, lang)}
        thesis={summaryFor(article, lang).thesis}
        /* From the SAME take as the thesis above, not from `summary.zh`
           directly: the tags belong to whichever half is being shared, so a
           reader on /en with an English take shares no Chinese hashtags — and
           one whose English never arrived is reading the Chinese take, where
           Chinese tags are the right ones. */
        tags={summaryFor(article, lang).tags ?? []}
        lang={lang}
      />
    </div>
  );
}

/**
 * One article, as much of it as a LIST should show: the headline and the claim.
 *
 * IT WAS THE WHOLE SUMMARY — cover, headline, thesis and three to five
 * paragraphs of prose, the same text the article's own page carries. Two things
 * were wrong with that. A day of fifteen of them is a page nobody reaches the
 * bottom of, and every one of those summaries then existed at two URLs, which is
 * the duplicate this site has already been through once (see the note in
 * app/[lang]/page.tsx). The prose now lives at exactly one address and this row
 * is the way to it.
 *
 * THE THESIS IS THE EXCERPT, and it is the right one because it was written to
 * be: `SummaryText.thesis` is the one-sentence claim the summary opens on, so
 * the list gets a real sentence rather than the first N characters of a
 * paragraph cut mid-word.
 *
 * NO CATEGORY ANYWHERE. The tabs and the section headings are gone with
 * `DigestBody`; the registry in lib/categories stays, because the publish floor
 * lives in it and the scorer still assigns one.
 */
export function ArticleBrief({
  article,
  date,
  lang,
}: {
  article: PublishedArticle;
  date: string;
  lang: Lang;
}) {
  const thesis = summaryFor(article, lang).thesis;

  return (
    <div className="flex flex-col rounded-card bg-card p-4 shadow-soft">
      {/* The same header row the full card had — see the note that was here on
          why the cover is bounded to the headline rather than to the whole card.
          With the prose gone the argument is weaker, but the shape is what a
          reader already knows this list to look like. */}
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

      {/* The claim, under its label and NOT behind an orange rule — see the note
          on the front page's teaser for why the bar is kept for the article page
          only: it exists to separate a lead from the prose it leads, and there is
          no prose in a row.

          Rendered directly rather than through `Summary`: that component's job is
          the whole take, and handing it a text with the prose stripped out would
          be asking it to render an object that does not exist. */}
      {thesis ? (
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-bold tracking-[0.08em] text-orange">
            TL;DR
          </p>
          <p className="text-base font-medium text-ink">{thesis}</p>
        </div>
      ) : null}

      <Actions article={article} date={date} lang={lang} />
    </div>
  );
}
