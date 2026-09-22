import { displayTitle } from "./ArticleTitle";
import { Cover } from "./Cover";
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
 * WHAT IT SHOWS PER ROW: the topic, the date, the headline, a shortened thesis,
 * and the cover.
 *
 * THE COVER IS NEW AND THIS NOTE USED TO ARGUE AGAINST IT — "four cover images
 * below a summary is a second gallery competing with the one at the top of the
 * page". That was written when this block was a 2x2 grid of four bordered
 * plates, where four pictures really would have been a gallery. It is a column
 * of three flush
 * rows now, the same row the day list and the archive are built from, and in
 * that shape the picture is an 80px identifying mark on the right — which is
 * what every other list on this site puts there. A row without one here was the
 * odd one out.
 *
 * STILL NOT THE SOURCE: a block this short wants one line of meta, and the topic
 * is the more useful of the two because it is the thing these rows have in
 * common with what was just read.
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
 * is for: a clamped line is still in the DOM, so three full theses would sit
 * under an article page as several hundred characters of text a crawler reads as
 * part of THIS page — the same sentences that are already the description of
 * three other pages. Cutting in the markup keeps the block's text a genuine
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
    <section className={SECTION}>
      {/**
       * A RULE ACROSS THE TOP, and it is the only one on this page that divides
       * blocks rather than rows.
       *
       * WHAT IT SEPARATES: everything above is THIS article — the summary, the
       * two exits, and the neighbour it ran beside in the same edition. Below it
       * is the rest of the archive. Those are different questions and there was
       * nothing but a 32px gap saying so, which is the same gap that sits
       * between every other pair of blocks.
       *
       * IT LIVES HERE RATHER THAN ON THE PAGE, which is the whole reason it is
       * in this file: the block renders NOTHING when the archive has no
       * neighbours to offer (see the note above), and a rule drawn by the page
       * would survive that and hang under the article on its own.
       *
       * `-mx-4 sm:-mx-7` SO IT BLEEDS TO THE SCREEN EDGE, matching the rules
       * between the rows underneath — those are on the rows\' own negative
       * margins, so a rule that stopped at the gutter would be 16px shorter
       * than the four below it and read as a mistake.
       *
       * `<hr>` RATHER THAN A `border-t` ON THIS SECTION, because the section
       * has no padding to put the heading back inside once the border bleeds
       * past the gutter, and because this IS a thematic break — which is what
       * the element means.
       */}
      <hr className="-mx-4 mb-7 border-line sm:-mx-7" />

      <h2 className="text-xl font-bold tracking-tight text-ink">{t.related}</h2>

      {/**
       * FLUSH ROWS, WHERE THIS WAS A 2x2 GRID OF BORDERED PLATES.
       *
       * The grid's own argument was that four rows in one column is a long tail
       * on a page that has already said its piece, and that a 2x2 reads as a set
       * of options. The tail was real and the fix was the COUNT rather than the
       * shape — three rows now, see `RELATED_COUNT`. What the grid actually read
       * as was a second kind of list: the day
       * page, the archive and the topic hub are all one column of rules, and
       * this block — the LAST card grid on the site — sat under them looking
       * like it came from somewhere else.
       *
       * THE SAME ROW, TO THE CLASS, as `ArticleBrief`: `-mx-4 px-4` so the
       * hover tint bleeds to the screen edge, `border-b` + `last:border-0` for
       * the rules, and `Cover variant="card"` on the right at `size-20
       * sm:size-24`. What it does NOT take from that row is the `01` number —
       * these three are a recommendation, not a running order, and numbering
       * them would claim a rank the scorer does not mean.
       *
       * THE WHOLE ROW IS ONE ANCHOR, with no stretched link: unlike a day row
       * there is nothing else inside it to click — the topic is plain text here
       * (see below), precisely so that this can stay a single link.
       */}
      <div className="mt-3">
        {picked.map(({ date, article: other }, at) => {
          const category = categoryOf(other.category);
          const thesis = summaryFor(other, lang).thesis;
          return (
            <a
              key={`${date}-${other.id}`}
              href={href(lang, articlePath(date, other))}
              className="relative -mx-4 flex gap-3.5 border-b border-line px-4 py-4 transition duration-150 ease-out last:border-0 hover:bg-page-deep sm:-mx-7 sm:gap-4 sm:px-7"
              /* `summary_open` like every other way into a take, with `from`
                 saying it was this block — which is the number that answers
                 whether the block is worth the space. `age` is the row's rank in
                 the recommendation, so a block whose last row is never pressed
                 can be shortened on evidence — which is what took it from four
                 rows to three. */
              data-track="summary_open"
              data-track-source={other.sourceId}
              data-track-from="related"
              data-track-age={at}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-ink-soft">
                  {/* PLAIN TEXT, not a link to the topic — the whole row is an
                      anchor and an anchor may not contain another. It is the one
                      place on the site a category name is shown without leading
                      anywhere, and that is right here: the reader is being
                      offered four articles, not four taxonomies. */}
                  <span>{categoryName(category, lang)}</span>
                  <span className="size-0.75 rounded-full bg-current opacity-55" />
                  <time dateTime={date}>{date}</time>
                </div>

                <span className="mt-1.5 block text-base leading-snug font-bold text-ink">
                  {displayTitle(other, lang)}
                </span>

                {thesis ? (
                  <span className="mt-1 block text-sm leading-relaxed font-semibold text-ink-mid">
                    {excerpt(thesis)}
                  </span>
                ) : null}
              </div>

              <Cover
                id={other.id}
                sourceId={other.sourceId}
                image={other.image}
                variant="card"
              />
            </a>
          );
        })}
      </div>
    </section>
  );
}
