import { displayTitle } from "./ArticleTitle";
import { SECTION } from "./Shell";
import { categoryName, categoryOf } from "@/lib/categories";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { articlePath } from "@/lib/links";
import { relatedArticles } from "@/lib/related";
import { summaryFor } from "@/lib/take";
import type { PublishedArticle } from "@/lib/types";

/**
 * 「你可能还想读」 — the few takes under an article, and the only way on from this
 * page that stays on this site and is not a step back up.
 *
 * WHY IT IS HERE AND NOT ON A LIST PAGE. An article page is where a search
 * result and a shared link land, so it is the page with the most arrivals and
 * was the page with the fewest exits: off to the original, or up to the day. A
 * reader who liked one take had to go back up a level and start again, which
 * most of them do not.
 *
 * WHAT IT SHOWS PER ROW: the headline, the topic, the date, and a shortened
 * thesis. Not the cover — four cover images below a summary is a second
 * gallery competing with the one at the top of the page, and these images belong
 * to somebody else's article rather than to ours. Not the source either: a
 * four-row block wants one line of meta, and the topic is the more useful of the
 * two here because it is the thing these rows have in common with what was just
 * read.
 *
 * IT RENDERS NOTHING WHEN THERE IS NOTHING, which on a young archive is a real
 * state rather than a defensive check — see `relatedArticles`. A padded-out
 * block is worse than no block: the whole claim of this site is that what is on
 * the page was picked.
 */

/**
 * How much of a thesis a row shows.
 *
 * TWO LINES AT THE SIZE THESE ARE SET IN, cut at a character count rather than
 * by CSS `line-clamp`, and the difference matters for the one thing this block
 * is for: a clamped line is still in the DOM, so four full theses would sit
 * under an article page as several hundred characters of text a crawler reads as
 * part of THIS page — the same sentences that are already the description of
 * four other pages. Cutting in the markup keeps the block's text a genuine
 * excerpt.
 *
 * Cut at a sentence-ending mark where there is one within reach, so a row ends
 * on a stop rather than mid-clause; the ellipsis says the rest is elsewhere.
 */
const THESIS_CHARS = 64;

function excerpt(thesis: string): string {
  if (thesis.length <= THESIS_CHARS) return thesis;
  const cut = thesis.slice(0, THESIS_CHARS);
  // The CJK marks first — every summary here is written in one of two languages
  // and the Chinese half never uses the ASCII ones.
  const stop = Math.max(
    cut.lastIndexOf("。"),
    cut.lastIndexOf("！"),
    cut.lastIndexOf("？"),
    cut.lastIndexOf(". "),
  );
  // Only honour a stop in the back half: one at character 6 would cut the row
  // down to a fragment shorter than the headline above it.
  return stop > THESIS_CHARS / 2 ? cut.slice(0, stop + 1) : `${cut.trim()}…`;
}

export async function RelatedArticles({
  article,
  lang,
}: {
  article: PublishedArticle;
  lang: Lang;
}) {
  const t = strings(lang);
  const picked = await relatedArticles(article);
  if (!picked.length) return null;

  return (
    <section className={`${SECTION}`}>
      <h2 className="font-serif text-xl font-bold tracking-tight text-ink">
        {t.related}
      </h2>

      {/* Two columns from `sm:` up, one on a phone. Four rows in one column is a
          long tail on a page that has already said its piece; four in a 2x2 grid
          reads as a set of options, which is what it is. */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {picked.map(({ date, article: other }, at) => {
          const category = categoryOf(other.category);
          const thesis = summaryFor(other, lang).thesis;
          return (
            <a
              key={`${date}-${other.id}`}
              href={href(lang, articlePath(date, other))}
              className="flex flex-col gap-1.5 rounded-xl border border-line bg-paper px-4 py-3.5 transition duration-150 ease-out hover:border-ink-soft"
              /* `summary_open` like every other way into a take, with `from`
                 saying it was this block — which is the number that answers
                 whether the block is worth the space. `age` is the row's rank in
                 the recommendation, so a block whose fourth row is never pressed
                 can be shortened on evidence. */
              data-track="summary_open"
              data-track-source={other.sourceId}
              data-track-from="related"
              data-track-age={at}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-ink-soft">
                {/* PLAIN TEXT, not a link to the topic — the whole row is an
                    anchor and an anchor may not contain another. It is the one
                    place on the site a category name is shown without leading
                    anywhere, and that is right here: the reader is being
                    offered four articles, not four taxonomies. */}
                <span>{categoryName(category, lang)}</span>
                <span className="size-0.75 rounded-full bg-current opacity-55" />
                <time dateTime={date}>{date}</time>
              </div>
              <span className="text-base leading-snug font-bold text-ink">
                {displayTitle(other, lang)}
              </span>
              {thesis ? (
                <span className="text-sm leading-relaxed font-medium text-ink-mid">
                  {excerpt(thesis)}
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
    </section>
  );
}
