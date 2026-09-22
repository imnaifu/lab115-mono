import { notFound } from "next/navigation";
import { displayTitle } from "./ArticleTitle";
import { PageShell } from "./PageShell";
import { hasTopicImage, TopicImage } from "./TopicImage";
import { TopicChips } from "./TopicChips";
import {
  Breadcrumb,
  EndLink,
  Footer,
  Masthead,
  MastheadDot,
  PAD,
  SECTION,
} from "./Shell";
import {
  accentColor,
  categoryName,
  CATEGORY_BY_ID,
  topicDescription,
} from "@/lib/categories";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { articlePath, TOPIC_PATH, topicPath } from "@/lib/links";
import { breadcrumb, JsonLd, publisher } from "@/lib/seo";
import { sourceOf } from "@/lib/sources";
import { summaryFor } from "@/lib/take";
import {
  articlesByTopic,
  hasTopicPage,
  liveTopics,
  topicPages,
  topicSlice,
} from "@/lib/topics";
import { listDates } from "@/lib/store";

/**
 * `/topic/<id>` — one subject, and every take this site has written in it.
 *
 * WHAT IS ON HERE THAT IS NOWHERE ELSE. The run of takes for one subject,
 * newest first, which no other page assembles: the front page, a day and the
 * archive are all ordered by DATE, so a reader who came for one piece about
 * markets has no way to find the other nineteen, and a crawler has no page that
 * establishes the relationship. It is also the only URL on this site that does
 * not age — `/2026/09/05` is worth less every morning, `/topic/tech` is worth
 * more.
 *
 * ONE COMPONENT FOR BOTH ROUTES, the same arrangement `ArchiveView` has:
 * `/topic/<id>` is page 1 and `/topic/<id>/<n>` is the rest, and page 1 is NOT
 * reachable as `/topic/<id>/1` — that route redirects here, because two URLs for
 * one page is the smallest version of the duplicate this site has already been
 * reported for.
 *
 * THE THRESHOLD IS THE POINT OF THE 404. Below `TOPIC_MIN_ARTICLES` this page
 * would be a generated sentence over one or two rows — thin by any definition,
 * and eight of them is a doorway set. See the note on that constant for the
 * measured reason it is three and for which topic it currently excludes.
 *
 * NOTHING HERE IS GENERATED TEXT PRETENDING TO BE WRITING. The lead under the
 * heading is HAND-WRITTEN, one sentence per category in config.json; everything
 * else on the page is headlines and theses that were written for their own
 * articles. A paragraph of keyword prose per topic is exactly the thing this
 * site's whole argument is against, and the lead was the one slot where it
 * could have crept in — it held a templated sentence for one round.
 */
export async function TopicView({
  lang,
  id,
  page,
  sort,
}: {
  lang: Lang;
  id: string;
  page: number;
  /**
   * `hot` reorders by the score the summariser gave, `latest` (the default) is
   * the archive's own order.
   *
   * IT ARRIVES AS A QUERY PARAMETER, `?sort=hot`, and that is deliberate rather
   * than lazy. A sort is a VIEW of one set, not a different set, so it must not
   * mint a second indexable URL for the same articles — the duplicate this site
   * has already been reported for once. `topicMetadata` builds its canonical
   * from the PATH, so `?sort=hot` self-canonicals to the plain topic URL with no
   * extra work, and the sitemap never names it.
   *
   * 「最热」 IS THE SCORE, NOT TRAFFIC. Nothing here counts reads per article —
   * there is no per-piece counter anywhere on this site — so the only ranking
   * available is the one the scorer produced that morning, which is a judgement
   * about the writing rather than about its audience. That is a narrower claim
   * than 「热」 usually makes, and it is the honest one this data supports.
   */
  sort?: string;
}) {
  const t = strings(lang);

  /**
   * `CATEGORY_BY_ID`, NOT `categoryOf`. That helper falls back to the catch-all
   * so an archived digest naming a retired category still renders — right on a
   * card and wrong here, where it would give every typo a page and title it with
   * 人文.
   */
  const category = CATEGORY_BY_ID.get(id);
  if (!category) notFound();

  const [byTopic, siblings, dates] = await Promise.all([
    articlesByTopic(),
    liveTopics(),
    listDates(),
  ]);
  const articles = byTopic.get(category.id) ?? [];
  if (!hasTopicPage(articles.length)) notFound();

  const hot = sort === "hot";
  /* A COPY BEFORE SORTING. `articles` is the cached index's own array — see
     `archiveIndex` — and sorting it in place would reorder what every other
     caller on this request sees, including the sibling row and the hub. */
  const ordered = hot
    ? [...articles].sort((a, b) => b.article.score - a.article.score)
    : articles;

  const total = topicPages(articles.length);
  if (page < 1 || page > total) notFound();
  const shown = topicSlice(ordered, page);

  const name = categoryName(category, lang);
  const path = topicPath(category.id, page);
  const url = `${SITE}${href(lang, path)}`;

  return (
    <PageShell lang={lang} path={path}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": url,
          url,
          name: `${t.topicDocTitle(name)} · ${t.brand}`,
          description: t.topicLead(name),
          inLanguage: lang === "zh" ? "zh-CN" : "en-US",
          publisher: publisher(t.brand),
          isPartOf: { "@id": `${SITE}${href(lang, "/")}#site` },
          /**
           * `about` IS THE PAGE'S WHOLE STRUCTURED-DATA CLAIM: this page is
           * about a SUBJECT, and `Thing` with a name is the honest way to say
           * so. No `sameAs` to a Wikipedia entry — the categories here are this
           * site's own editorial boundaries (see `Category.hint` in
           * config.json), not encyclopedia entities, and claiming 技术 IS
           * https://en.wikipedia.org/wiki/Technology would be asserting an
           * identity nobody decided.
           */
          about: { "@type": "Thing", name },
          /* THREE LEVELS NOW, because the middle one exists: the hub at
             `/topic` is this page's parent, and a trail that skipped it would
             be telling a crawler the topic hangs directly off the home page
             while the visible trail above says otherwise. */
          breadcrumb: breadcrumb([
            { name: t.brand, url: `${SITE}${href(lang, "/")}` },
            { name: t.topicHubTitle, url: `${SITE}${href(lang, TOPIC_PATH)}` },
            { name, url: `${SITE}${href(lang, topicPath(category.id))}` },
          ]),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: shown.length,
            itemListElement: shown.map(({ date, article }, at) => ({
              "@type": "ListItem",
              /* Continuing the run across pages rather than restarting at 1 —
                 the position is where the piece sits in the topic, which is what
                 the number is for. Same rule as `ArchiveView`, and computed off
                 the PAGE SIZE rather than off this page's length, so a short
                 last page cannot renumber the ones before it. */
              position: (page - 1) * shown.length + at + 1,
              url: `${SITE}${href(lang, articlePath(date, article))}`,
              name: displayTitle(article, lang),
            })),
          },
        }}
      />

      {/* NO TITLE AND NO TRAIL IN THE MASTHEAD — the subject is the heading and
          it is set over the band below. The trail went the way the article
          page's did: `BreadcrumbList` is still in the JSON-LD above, which is
          the half a search result draws. */}

      {/**
       * THE BAND: the topic's picture with its name over it.
       *
       * `TopicImage` draws the category's accent gradient underneath and layers
       * `public/topics/<id>.jpg` on top, so a topic with no file yet renders as a
       * deliberate flat colour rather than as a broken image. See that component
       * — there is no config field and nothing to keep in step.
       *
       * `priority` on this one instance only: it is the page's first screen. The
       * hub's eight cards stay lazy.
       */}
      <section className={`${SECTION} ${PAD}`}>
        <div className="relative overflow-hidden rounded-card">
          <TopicImage
            category={category}
            className="absolute inset-0 size-full"
            priority
          />
          {/* The scrim, ONLY OVER A PHOTOGRAPH — see `hasTopicImage`. A
              gradient rather than a flat wash: the words sit at the bottom, so
              that is where the ink has to be. */}
          {hasTopicImage(category) ? (
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-black/5" />
          ) : null}

          <div className="relative flex min-h-[200px] flex-col justify-end p-6 sm:min-h-[240px] sm:p-8">
            {/* THE ENGLISH NAME UNDER THE CHINESE ONE, which is the one place on
                this site that breaks the one-language-at-a-time rule on purpose
                besides an article's headline — and for the same reason: a
                category's two names are not a translated label pair, they are
                what the subject is called in the two places a reader might have
                met it. `nameEn` is what the JSON-LD's `articleSection` has always
                declared. */}
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {name}
            </h1>
            <p className="mt-1 text-sm font-bold tracking-wide text-white/70">
              {category.nameEn}
            </p>
          </div>
        </div>

        {/* The hand-written line, under the band rather than on it — it runs to
            two lines and prose over a photograph is where legibility goes. See
            `RawCategory.description` in user-config for why it is written rather
            than generated. */}
        <p className="mt-4 max-w-prose text-base leading-relaxed font-medium text-ink-mid">
          {topicDescription(category, lang)}
        </p>

        <p className="mt-2 text-sm font-bold text-ink-soft">
          {t.topicArticles(articles.length)}
          {total > 1 ? ` · ${t.pageOf(page, total)}` : ""}
        </p>

        {/**
         * THE TWO ORDERS. `aria-current` as well as the underline, so a reader
         * who cannot see the rule is still told which one is on.
         *
         * BOTH LINK TO PAGE 1. A sort and a page number are independent, and
         * carrying the page across would land a reader on page 3 of an order
         * they have not seen the top of.
         */}
        <nav className="mt-5 flex gap-5 border-b border-line">
          {[
            { key: "latest", label: t.topicSortLatest, on: !hot },
            { key: "hot", label: t.topicSortHot, on: hot },
          ].map((tab) => (
            <a
              key={tab.key}
              href={`${href(lang, topicPath(category.id))}${
                tab.key === "hot" ? "?sort=hot" : ""
              }`}
              aria-current={tab.on ? "page" : undefined}
              className={`-mb-px border-b-2 pb-2.5 text-sm font-bold transition duration-150 ease-out ${
                tab.on
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-soft hover:text-ink-mid"
              }`}
            >
              {tab.label}
            </a>
          ))}
        </nav>
      </section>

      {/**
       * The run of takes.
       *
       * A ROW CARRIES WHAT A DECISION NEEDS: the date, the source, the headline
       * and the thesis. That is more than a source page's rows show (date +
       * headline) and less than a day page's cards show (cover + actions), and
       * the middle is right here for one reason — a reader arriving from a
       * search has no idea what this site's summaries read like, so the thesis is
       * the sample that says whether the next click is worth it. On a source page
       * they have usually arrived knowing the blog.
       *
       * ONE LINK PER ROW, covering the whole row. The day and the source are
       * printed rather than linked: a row with three destinations in it is three
       * decisions where the reader wanted one, and both of those places are one
       * hop from the article page this leads to.
       */}
      <section className={`${SECTION} ${PAD} flex flex-col gap-2`}>
        {shown.map(({ date, article }, at) => {
          const source = sourceOf(article.sourceId);
          const thesis = summaryFor(article, lang).thesis;
          return (
            <a
              className="flex flex-col gap-1.5 rounded-xl border border-line bg-paper px-5 py-4 transition duration-150 ease-out hover:border-ink-soft"
              key={`${date}-${article.id}`}
              href={href(lang, articlePath(date, article))}
              /* `summary_open`, the same event every other way into an article's
                 take sends — `from` is what separates this list from the day's
                 and the front page's. `age` is the row's depth, which is how far
                 down a topic anybody actually reads. */
              data-track="summary_open"
              data-track-source={article.sourceId}
              data-track-from="topic"
              data-track-age={at}
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-bold text-ink-soft">
                <time dateTime={date}>{date}</time>
                <span className="size-0.75 rounded-full bg-current opacity-55" />
                <span>{source.name}</span>
              </div>
              <span className="text-lg leading-snug font-bold text-ink">
                {displayTitle(article, lang)}
              </span>
              {thesis ? (
                <span className="text-sm leading-relaxed font-medium text-ink-mid">
                  {thesis}
                </span>
              ) : null}
            </a>
          );
        })}
      </section>

      {/**
       * The pager, identical in shape and reasoning to the archive's: plain
       * links, both directions, only the ones that exist, no `rel=prev/next`
       * (Google stopped reading them years ago and said so), and every page
       * self-canonical — a canonical pointing page 2 at page 1 is the common
       * mistake and it hides most of a long topic from the index.
       */}
      {total > 1 ? (
        <nav className={`${PAD} mt-8 flex items-center justify-between gap-3`}>
          {page > 1 ? (
            <a
              className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-bold text-ink-mid transition duration-150 ease-out hover:border-ink-soft hover:text-ink active:opacity-80"
              href={href(lang, topicPath(category.id, page - 1))}
              data-track="topic_open"
              data-track-topic={category.id}
              data-track-from="pager"
              data-track-lang={lang}
            >
              ← {t.newer}
            </a>
          ) : (
            <span />
          )}
          {page < total ? (
            <a
              className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-bold text-ink-mid transition duration-150 ease-out hover:border-ink-soft hover:text-ink active:opacity-80"
              href={href(lang, topicPath(category.id, page + 1))}
              data-track="topic_open"
              data-track-topic={category.id}
              data-track-from="pager"
              data-track-lang={lang}
            >
              {t.older} →
            </a>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      {/**
       * THE SIBLING TOPICS — peer navigation, and it stays now that `/topic` exists.
       *
       * The two are not the same thing and neither replaces the other. The hub
       * answers "what does this site cover" for somebody who has not chosen a
       * topic; this row answers "where else can I go from here" for somebody who
       * is already inside one, without making them go up a level first. It is
       * also what keeps every live topic ONE hop from every other — through the
       * hub it would be two — which is the property that matters to a crawler
       * walking in from an article page.
       *
       * IT NAMES ONLY LIVE TOPICS, through `liveTopics` — which asks
       * `hasTopicPage`, so this row cannot link to a 404 and cannot disagree with
       * the sitemap about which pages exist.
       *
       * The current topic is dropped rather than drawn as plain text: a row that
       * includes where you already are is a row with one dead item in it, and the
       * `<h1>` above says which topic this is.
       */}
      {siblings.length > 1 ? (
        <section className={`${SECTION} ${PAD}`}>
          <h2 className="text-sm font-bold text-ink-soft">{t.topicOthers}</h2>
          <div className="mt-3">
            {/* WRAPPED, not scrolled — see the `layout` prop. This row is at
                the foot of the page with nothing under it to push down, so
                showing all seven at once costs nothing; the front page's copy
                of this row is above the day's first headline and must not. */}
            <TopicChips
              lang={lang}
              from="topic_page"
              exclude={category.id}
              layout="wrap"
            />
          </div>
        </section>
      ) : null}

      {/* Back to the front page. A reader who came in on a topic from search has
          never seen this site's actual shape, and the front page is the one page
          that shows it — which is also the one thing a list of more topics
          cannot do. */}
      <div className={PAD}>
        <EndLink
          href={href(lang, "/")}
          label={t.allDays}
          sub={t.allDaysSub}
          track="home_open"
          trackFrom="topic"
        />
      </div>

      <Footer
        year={dates[0]?.slice(0, 4) ?? String(new Date().getUTCFullYear())}
        lang={lang}
      />
    </PageShell>
  );
}
