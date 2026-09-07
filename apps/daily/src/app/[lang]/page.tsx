import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleTitle, displayTitle } from "@/components/ArticleTitle";
import { Meta } from "@/components/ArticleCards";
import { Cover } from "@/components/Cover";
import { PageShell } from "@/components/PageShell";
import { Footer, PAD } from "@/components/Shell";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { articlePath, dayPath } from "@/lib/links";
import { JsonLd, publisher, website } from "@/lib/seo";
import { FRONT_DAYS, hasArchive } from "@/lib/paging";
import { summaryFor } from "@/lib/take";
import { listDates, readDigest, shownArticles } from "@/lib/store";
import type { PublishedArticle } from "@/lib/types";

// Read from the git clone on every request — the cron rewrites those files
// underneath a long-running server, so nothing here may be cached at build time.
export const dynamic = "force-dynamic";

/** The hover system — see the note on these in components/ArticleCards. */
const ACTION_TEXT =
  " transition duration-150 ease-out hover:opacity-70 active:opacity-55";

/**
 * How many pieces the list under the teaser runs to.
 *
 * NOT IN lib/paging, unlike `FRONT_DAYS` and `ARCHIVE_PAGE_SIZE`. Those two live
 * there because three files have to agree about them — the front page, the
 * archive and the sitemap — and a disagreement means a sitemap pointing at a page
 * that does not exist. This number is read in one place and changes nothing
 * anywhere else, so it lives where it is used.
 *
 * SEVEN, which is `FRONT_DAYS` — and with one piece per day below, that is not a
 * coincidence but the point: the list runs exactly as far back as the front page
 * has ever reached, one row per edition. It was fifteen briefly, which ran the
 * list past the week and made it the second-longest thing on a page whose job is
 * to be short.
 */
const FRONT_POSTS = 7;

/**
 * How many pieces each day contributes to that list — and it is why the list
 * SPANS the week instead of being the newest edition twice.
 *
 * A day carries fifteen-odd pieces, so without a per-day cap `FRONT_POSTS` was
 * filled entirely by the newest one: fifteen rows all stamped the same date, a
 * date column that was fifteen copies of one string, and — the part that actually
 * mattered — no way to reach days two through seven from the front page at all.
 * That was the whole reason this page used to list days, and losing it silently
 * would have been the kind of regression nothing catches.
 *
 * ONE, now that the list is seven rows. It was two, which spanned the week while
 * there were fifteen rows to spend; against a cap of seven, two per day reaches
 * back only three days and strands the other four — the very thing this constant
 * exists to prevent. One per day and seven rows cover the week exactly.
 *
 * What it costs is that the list cannot show a day holds more than one piece.
 * That is the teaser's job, and 「继续阅读全文」 above leads to the whole edition.
 */
const POSTS_PER_DAY = 1;

/**
 * THE FRONT PAGE IS ONE TEASER FOR THE NEWEST EDITION, then the recent pieces.
 *
 * IT HAS BEEN THREE OTHER THINGS. It rendered the newest digest IN FULL for most
 * of this site's life, which made it a byte-for-byte twin of that day's
 * permalink — Google clustered the two, picked one, and Search Console reported
 * the other as a duplicate whose canonical it had overridden. It became a pure
 * directory of DAYS, which fixed that and cost the page any sense of what was
 * actually published this morning. Then a teaser above a list of days, which put
 * a table of contents under a headline.
 *
 * THIS IS THE ORDINARY WEBLOG INDEX, and it is what the others were circling: the
 * day's photograph, the lead piece's headline and its one-sentence claim, a way
 * in, and then the recent pieces by name. It says what today holds without being
 * a copy of the page that holds it — ONE article of the fifteen with no prose
 * under it, against a day page carrying every headline and its claim.
 *
 * THE LIST NAMES PIECES, NOT DAYS, and that costs the day pages nothing: every
 * one of them is in the sitemap, and every article page's breadcrumb links back
 * to the day it ran on. What changed is which of the two a reader is offered
 * first, and a headline is the one they can decide about.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);

  /**
   * Only the description. NOT `openGraph` — Next merges metadata per top-level
   * field, so declaring one here would replace the layout's entire object rather
   * than extend it, and the layout's is already right for this URL: it is the home
   * page it was written for. The canonical and the hreflang set come from there too.
   */
  const dates = await listDates();
  const digest = dates[0] ? await readDigest(dates[0]) : null;
  const lead = digest ? shownArticles(digest)[0] : undefined;

  /* THE LEAD PIECE'S HEADLINE, which is what this page leads with — a search
     snippet that says what is on the page. It said "the last 7 days" back when
     the page was a directory; that sentence describes a page that no longer
     exists. Falls back to the tagline on an empty archive. */
  return {
    description: lead
      ? `${displayTitle(lead, pageLang)} · ${t.tagline}`
      : t.tagline,
  };
}

/** One piece in the list, with the day it ran on — the row needs both. */
type Recent = { date: string; article: PublishedArticle };

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  // `[lang]` matches any first segment, so an unknown one has to 404 rather
  // than render the site in a language that does not exist.
  if (!isLang(lang)) notFound();
  const t = strings(lang);

  const dates = await listDates();
  const latest = dates[0];

  /**
   * The recent days, read once and flattened into a run of pieces.
   *
   * BOUNDED BY `FRONT_DAYS`, not by the archive: this opens one file per day, and
   * the slice is what stops that growing with the site. Same bound and same cost
   * `DayList` paid when this page listed days.
   */
  const digests = await Promise.all(
    dates.slice(0, FRONT_DAYS).map(async (date) => ({
      date,
      digest: await readDigest(date),
    })),
  );
  const digest = digests[0]?.digest ?? null;
  const lead = digest ? shownArticles(digest)[0] : undefined;

  /**
   * The best few of each recent day, newest first, MINUS the lead.
   *
   * `listDates` is newest-first and `shownArticles` is already ranked, so taking
   * the head of each day in order gives the run a reader expects with no sort of
   * its own — see `POSTS_PER_DAY` for why it is the head of each day rather than
   * simply the newest pieces.
   *
   * THE LEAD IS DROPPED BEFORE THE CAP, not after, and by IDENTITY rather than by
   * position: it is the piece rendered above, so repeating it would open the page
   * on the same headline twice — and dropping it after `slice` would silently
   * make the newest day contribute one row where every other day contributes two.
   */
  const recent: Recent[] = digests
    .flatMap(({ date, digest: day }) =>
      day
        ? shownArticles(day)
            .filter((article) => article.id !== lead?.id)
            .slice(0, POSTS_PER_DAY)
            .map((article) => ({ date, article }))
        : [],
    )
    .slice(0, FRONT_POSTS);

  const home = `${SITE}${href(lang, "/")}`;

  return (
    <PageShell lang={lang} path="/">
      {/**
       * The site, and the one piece this page leads with.
       *
       * `mainEntity` IS THE LEAD ARTICLE, not a list of days and not a list of
       * fifteen: structured data describing something the page does not show is
       * the kind of mismatch a crawler is entitled to distrust, and the piece this
       * page renders — headline and claim — is that one. The rows below are links,
       * and the pages they lead to describe themselves.
       */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            website(lang, t.brand, t.tagline),
            {
              "@type": "CollectionPage",
              "@id": home,
              url: home,
              name: t.brand,
              description: t.tagline,
              inLanguage: lang === "zh" ? "zh-CN" : "en-US",
              isPartOf: { "@id": `${home}#site` },
              publisher: publisher(t.brand),
              ...(dates.length
                ? {
                    datePublished: dates[dates.length - 1],
                    dateModified: dates[0],
                  }
                : {}),
              ...(lead && latest
                ? {
                    mainEntity: {
                      "@type": "BlogPosting",
                      "@id": `${SITE}${href(lang, articlePath(latest, lead))}`,
                      headline: lead.title,
                      ...(displayTitle(lead, lang) !== lead.title
                        ? { alternativeHeadline: displayTitle(lead, lang) }
                        : {}),
                      description: summaryFor(lead, lang).thesis,
                      datePublished: lead.publishedAt,
                      dateModified: latest,
                      author: publisher(t.brand),
                      publisher: publisher(t.brand),
                    },
                  }
                : {}),
            },
          ],
        }}
      />

      {/**
       * ONE COLUMN, HAIRLINES INSTEAD OF CARDS.
       *
       * Every block here used to be its own raised panel — a card for the teaser,
       * a card for the photo, a bordered box per row — which on a page this short
       * is more chrome than content: three surfaces, three shadows and three sets
       * of padding to say two things. A weblog index is a column of text with
       * rules across it, and the rules do the same work for a fraction of the ink.
       *
       * `divide-y` rather than a border on each child, so the page's own top and
       * bottom edges stay clean and no two sections can disagree about which of
       * them owns the line between them.
       */}
      <div className={`divide-y divide-line ${PAD}`}>
        {digest && lead && latest ? (
          <section className="pt-8 pb-8">
            {/**
             * NO PHOTOGRAPH HERE. The day's picture is the DAY PAGE's opener and
             * this page links to it — it stays there, at the top of the edition it
             * belongs to.
             *
             * IT WAS HERE AND KEPT SHRINKING: the plate went 520 to 480 to 300 in
             * an attempt to stop it pushing the one thing this page exists to show
             * below the fold. That is the tell that it did not belong. The front
             * page carries a single teaser, so anything above the headline is the
             * whole first screen, and a picture chosen for the EDITION cannot earn
             * that slot ahead of the piece it does not illustrate.
             *
             * `PhotoCard` and its 300px ceiling stay — the day page has cards under
             * the photo, which is what that ceiling was measured against.
             */}

            {/**
             * THE LEAD: its cover, its headline, its claim, one way in.
             *
             * THE SAME HEADER BLOCK THE LIST ROWS USE — cover, then source and
             * author, then the headline — built from the same `Cover` and `Meta`
             * those rows call. The teaser is one article presented as an article,
             * so it is assembled from the parts that present one everywhere else;
             * anything hand-rolled here drifts from them by a separator or an
             * accent within a couple of edits.
             *
             * NO SHARE AND NO LINK TO THE ORIGINAL, though. Those are ACTIONS, and
             * each is a second thing to decide about on a page whose only question
             * is "is today worth reading" — both are on the day page a tap away.
             * A cover and a source line are not decisions; they are what makes this
             * read as a piece rather than as a paragraph.
             *
             * `items-center` for the reason stated on `ArticleCard`: a one-line
             * headline is shorter than the cover, and centring reads as air above
             * and below rather than as a hole under the title.
             *
             * THE HEADLINE IS THIS PAGE'S `<h1>`. There was a masthead above it
             * reading 每日严选 — the brand, as the heading — and the site bar
             * already carries the wordmark and the tagline on every page, so it
             * said the same thing twice, forty pixels apart. The right heading for
             * a page showing one piece is that piece.
             *
             * `ArticleTitle` rather than the raw headline, so the Chinese side
             * gets the translation with the original under it as the lists do.
             */}
            <div className="flex items-center gap-4 sm:gap-5">
              <Cover
                id={lead.id}
                sourceId={lead.sourceId}
                image={lead.image}
                variant="hero"
              />
              <div className="min-w-0 flex-1">
                <Meta article={lead} lang={lang} />
                <h1 className="mt-2.5 text-2xl leading-tight font-bold text-ink">
                  <ArticleTitle article={lead} lang={lang} variant="hero" />
                </h1>
              </div>
            </div>

            {summaryFor(lead, lang).thesis ? (
              /**
               * NO ORANGE RULE ON THE CLAIM HERE, and none on the day page's rows
               * either — it is kept for the article page, where `Summary` draws it.
               *
               * The bar marks the thesis as the LEAD OF SOMETHING: on the article
               * page it opens several paragraphs of prose and the rule is what
               * separates the claim from the writing under it. In a teaser and in
               * a list row there is no prose for it to lead, so the mark was
               * pointing at a distinction that is not there — and on a page trying
               * to be a column of text it is one more piece of furniture.
               *
               * The TL;DR label stays and now carries the job alone, which is
               * enough: it says what the sentence is in words rather than in a
               * mark the reader has to have learned.
               */
              <div className="mt-4">
                <p className="mb-1 text-[11px] font-bold tracking-[0.08em] text-orange">
                  TL;DR
                </p>
                <p className="text-base font-medium text-ink">
                  {summaryFor(lead, lang).thesis}
                </p>
              </div>
            ) : null}

            {/* INTO THE DAY, not into the article. The reader has been shown one
                of fifteen pieces; what is behind this link is the edition, which
                is the thing they came to find out about. The article's own page is
                one more tap from there — see `readSummary` on the rows. */}
            {/* RIGHT-ALIGNED, which is where a "read on" sits in this codebase
                already: the actions at the foot of an `ArticleBrief` are
                `justify-end` for the same reason. The block above is read left to
                right and top to bottom, and the way out belongs at the end of
                that path rather than back at its start.

                `flex` on a wrapper rather than `text-right` on the anchor, so the
                link's hit area is the words and not the whole line. */}
            <div className="mt-5 flex justify-end">
              <a
                className={`text-base font-bold text-orange${ACTION_TEXT}`}
                href={href(lang, dayPath(latest))}
                data-track="day_open"
                data-track-from="home"
              >
                {t.keepReading}
              </a>
            </div>
          </section>
        ) : null}

        {recent.length > 0 ? (
          <section className="pt-7 pb-6">
            <h2 className="text-xl font-bold tracking-tight text-ink">
              {t.latestPosts}
            </h2>

            {/**
             * ONE LINE PER PIECE: the day, then the headline.
             *
             * DENSE ON PURPOSE. The rows here were bordered, padded boxes with the
             * date on its own line above the title — two lines and some seventy
             * pixels of height to carry about twelve words. A list is for
             * scanning, and a reader choosing between fifteen headlines wants them
             * adjacent rather than separated by their own furniture.
             *
             * The date is a FIXED COLUMN so every headline starts on a common left
             * edge; ragged starts are what makes a list of this shape tiring to run
             * an eye down. `MM-DD`, because the year is the same on every row a
             * front page can hold.
             */}
            <ul className="mt-3">
              {recent.map(({ date, article }, at) => (
                <li key={`${date}-${article.id}`}>
                  <a
                    /* The whole row is the target, so the whole row responds —
                       the date dims in and the headline darkens, which is the
                       outline treatment applied to a row instead of a pill. */
                    className="group flex gap-3 border-b border-line py-2.5 transition duration-150 ease-out last:border-0 hover:border-ink-soft sm:gap-4"
                    href={href(lang, articlePath(date, article))}
                    /* `summary_open`, the same event the day page's rows send —
                       both open one article's take. `age` is the row's depth in
                       the list, which is what says whether anybody reads past the
                       first few. */
                    data-track="summary_open"
                    data-track-source={article.sourceId}
                    data-track-from="home"
                    data-track-age={at}
                  >
                    <time
                      className="w-11 flex-none pt-0.5 text-sm font-medium tabular-nums text-ink-soft transition duration-150 ease-out group-hover:text-ink-mid"
                      dateTime={date}
                    >
                      {date.slice(5)}
                    </time>
                    <span className="min-w-0 flex-1 text-base leading-snug font-medium text-ink transition duration-150 ease-out group-hover:text-orange">
                      {displayTitle(article, lang)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            {/* Only once there is something the front page is not already showing
                — see `hasArchive`. With a week or less on the site this would lead
                to the same run the reader is looking at, and the sitemap holds the
                archive back on the same condition.

                A PLAIN LINK, where this was an `EndLink`: that component is a
                full-width bordered plate with a circled arrow, which is a large
                gesture for "there is more" at the foot of a list this quiet. */}
            {hasArchive(dates.length) ? (
              <a
                className={`mt-4 inline-block text-sm font-bold text-orange${ACTION_TEXT}`}
                href={href(lang, "/archive")}
                data-track="archive_open"
                data-track-from="home"
              >
                {t.morePosts}
              </a>
            ) : null}
          </section>
        ) : null}
      </div>

      <Footer
        year={dates[0]?.slice(0, 4) ?? String(new Date().getUTCFullYear())}
        lang={lang}
      />
    </PageShell>
  );
}
