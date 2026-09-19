import { themedAccent } from "@/lib/accent";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { ArticleTitle, displayTitle } from "@/components/ArticleTitle";
import { Cover } from "@/components/Cover";
import { PageShell } from "@/components/PageShell";
import {
  Breadcrumb,
  EndLink,
  Footer,
  Masthead,
  PAD,
  SECTION,
} from "@/components/Shell";
import { RelatedArticles } from "@/components/RelatedArticles";
import { ShareButton } from "@/components/ShareButton";
import { SubscribeDialog } from "@/components/SubscribeDialog";
import { Summary } from "@/components/Summary";
import {
  accentColor,
  categoryName,
  categoryOf,
} from "@/lib/categories";
import { MAIL_TOP_N, SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href as langHref, isLang } from "@/lib/lang";
import { signupOpen } from "@/lib/mail/resend";
import { posterParts, POSTER_HEIGHT, POSTER_WIDTH } from "@/lib/share";
import { sourceOf } from "@/lib/sources";
import {
  articlePath,
  dayPath,
  posterBase,
  posterPartUrl,
  topicPath,
} from "@/lib/links";
import { summaryFor } from "@/lib/take";
import { alternatesFor, breadcrumb, JsonLd, publisher } from "@/lib/seo";
import { readArticleBySlug, readDigest, retiredMatch } from "@/lib/store";
import { topicLinkFor } from "@/lib/topics";

export const dynamic = "force-dynamic";

/** The hover system — see the note on these in components/ArticleCards. */
const ACTION_OUTLINE =
  " transition duration-150 ease-out hover:border-ink-soft hover:text-ink active:opacity-80";

type Params = {
  params: Promise<{
    lang: string;
    year: string;
    month: string;
    day: string;
    slug: string;
  }>;
};

/** The date these three segments name — see the note on the day page next door. */
function dateFrom(params: { year: string; month: string; day: string }): string {
  return `${params.year}-${params.month}-${params.day}`;
}

/**
 * og:image is wired here rather than through Next's `opengraph-image` file
 * convention, because a share is now a SET of images and that convention gives
 * one per page.
 *
 * It points at PART 1 — the identity card — and not at the whole summary. It used
 * to be a single canvas as tall as the prose needed, which in a WeChat or X link
 * card is a wall of text scaled to thumbnail size: unreadable, and it buried the
 * headline it was supposed to be selling. Part 1 is a 3:4 card with the cover, the
 * headline and the claim on it, and og:description already carries the thesis, so
 * nothing an unfurl can show is lost.
 *
 * The dimensions are CONSTANTS now. The poster canvas is fixed at 1080x1440, so
 * the old hazard — meta declaring a height computed separately from the one the
 * route drew — cannot happen.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const resolved = await params;
  const { lang, slug } = resolved;
  const date = dateFrom(resolved);
  // Resolved before the lookup, because the not-found title needs it too.
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);

  const found = await readArticleBySlug(date, slug);
  if (!found) return { title: `${t.notFoundTitle} · ${t.brand}` };

  const { article } = found;
  // The thesis, for og:description — in the language of the page being described,
  // which is the whole point of a per-language `<meta>`: a link to /en unfurling
  // with a Chinese sentence under an English title is the mismatch this fixes.
  const summary = summaryFor(article, pageLang);
  /**
   * Built from the ARTICLE, never from the `slug` that was requested.
   *
   * The two can differ — an eight-character link from before slugs existed, a URL
   * whose headline has since been edited — and every URL declared below is a
   * canonical claim. Echoing the requested spelling back into `og:url` and
   * `alternates` would be the site nominating two addresses for one page, which is
   * the exact mistake `x-default` was making. See the note in lib/seo.
   */
  const canonicalPath = articlePath(date, article);
  const path = langHref(pageLang, canonicalPath);
  const posterUrl = posterPartUrl(posterBase(pageLang, date, article.id), 1);

  /**
   * OUR headline, in whichever language this page is — not the source's.
   *
   * IT WAS `article.title` IN BOTH LANGUAGES, on the reasoning that a `<title>`
   * names the piece and the source's headline is its name, the rewrite being "a
   * reading aid on the page, not a second identity for it". That stopped being
   * true: the rewrite is the one piece of editing this site does that the source
   * cannot, and it is now what both languages show as the H1.
   *
   * LEAVING IT MEANT THE TAB AND THE SEARCH RESULT DISAGREED WITH THE PAGE — a
   * Chinese search result reading "Doomscrolling ourselves to death" over a page
   * whose heading says 「当读书成往事，文明还撑得住吗？」. Google rewrites a title it
   * finds unrepresentative of the page, and a rewritten title is a title nobody
   * chose.
   *
   * `displayTitle` FALLS BACK TO `article.title` on its own — for a day archived
   * before the rewrite existed, and for one the model declined — so this is the
   * old behaviour wherever the old reasoning still applies.
   */
  const heading = displayTitle(article, pageLang);

  return {
    title: `${heading} · ${t.brand}`,
    description: summary.thesis,
    // Both languages, not just this one — see alternatesFor. `path` above is
    // already language-prefixed; this wants the bare form.
    alternates: alternatesFor(pageLang, canonicalPath),
    openGraph: {
      type: "article",
      // The same headline the tab and the page show — an unfurl that disagrees
      // with the page it links to is the same mismatch one surface over.
      title: heading,
      description: summary.thesis,
      url: `${SITE}${path}`,
      /**
       * The three fields an `article` og object is supposed to carry and did not.
       * `type: "article"` on its own tells a crawler the shape and then withholds
       * everything that shape is for — when it was published, who wrote it, what
       * it is about.
       */
      publishedTime: article.publishedAt,
      ...(article.author ? { authors: [article.author] } : {}),
      section: categoryOf(article.category).nameEn,
      images: [
        {
          // PART 1 NAMED EXPLICITLY. It used to be a bare `share.png` whose route
          // defaulted the part, and there is no default to lean on now that the
          // part is a path segment rather than a `?part=` — see `posterPartUrl`.
          // Naming it is also clearer: this tag points at the identity card, and
          // now it says so.
          url: `${SITE}${posterUrl}`,
          width: POSTER_WIDTH,
          height: POSTER_HEIGHT,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: heading,
      description: summary.thesis,
      images: [`${SITE}${posterUrl}`],
    },
  };
}

export default async function ArticlePage({ params }: Params) {
  const resolved = await params;
  const { lang, slug } = resolved;
  const date = dateFrom(resolved);
  if (!isLang(lang)) notFound();
  const t = strings(lang);

  const found = await readArticleBySlug(date, slug);
  /**
   * NOT FOUND IS TWO DIFFERENT ANSWERS, and only one of them is a 404.
   *
   * A day's file is rewritten whole on every rerun, so an article that had a page
   * here yesterday can be absent today — and the URL that was shared, mailed and
   * indexed would answer 404 forever. `retired` on the digest is the record of
   * exactly those, written by the publish job when it notices the loss; see the
   * note on that field.
   *
   * The reader goes to the DAY, not the home page. It is the nearest thing that
   * still exists to what they asked for — the same date, the neighbouring
   * articles — whereas `/` is whatever happens to be today and answers a question
   * nobody asked. A 308 rather than rendering something here, because this URL
   * genuinely has no page any more and saying so permanently is what lets Google
   * fold it into the day instead of keeping a dead address alive.
   *
   * A URL THAT NEVER EXISTED STILL 404s. This branch fires only on an id this
   * site itself published, which is the distinction the previous code could not
   * make and the reason a tombstone list has to exist at all.
   */
  if (!found) {
    const digest = await readDigest(date);
    if (digest && retiredMatch(digest, slug)) {
      permanentRedirect(langHref(lang, dayPath(date)));
    }
    notFound();
  }

  const { article, canonical } = found;
  const path = langHref(lang, articlePath(date, article));

  /**
   * ONE ARTICLE, ONE URL — enforced with a redirect rather than left to the
   * canonical tag.
   *
   * `readArticleBySlug` finds an article by the id at the end of the segment when
   * the slug itself does not match, which is what keeps every link ever shared
   * working: the eight-character URLs from before slugs existed, and any link
   * whose headline has since been edited. Serving 200 at those addresses would
   * hand Google a second URL per article and rely on `<link rel="canonical">` to
   * be believed — and being believed is exactly what did not happen the last time
   * this site nominated two addresses for one page. A 308 is not a hint.
   *
   * AFTER the lookup, because the destination is built from the article that was
   * found. Before any rendering, because there is no reason to draw a page that
   * is about to be replaced.
   */
  if (!canonical) permanentRedirect(path);

  const source = sourceOf(article.sourceId);
  const category = categoryOf(article.category);
  /**
   * DOES THIS ARTICLE'S TOPIC HAVE A PAGE YET?
   *
   * Asked rather than assumed, because `TOPIC_MIN_ARTICLES` is real and bites:
   * `design` currently holds one published take across the whole archive, so
   * `/topic/design` 404s and is not in the sitemap. Linking to it from here
   * would be this page pointing at a URL the site itself refuses to serve —
   * exactly the listed-but-404 disagreement `hasSourcePage` exists to prevent
   * one route over. The link simply does not appear until the topic is live,
   * and then it appears on every article in it at once.
   *
   * `topicLinkFor` is a read of the cached archive index, which the related
   * block below already walks — one walk for both.
   */
  const topic = await topicLinkFor(article);

  return (
    <PageShell lang={lang} path={articlePath(date, article)}>
      {/**
       * The summary, as a thing with a date, a source and a subject.
       *
       * THE HONESTY OF THIS MARKUP IS THE WHOLE DESIGN. What this page holds is
       * OUR summary OF SOMEONE ELSE'S article, and the two easy ways to mark that
       * up are both lies: naming the original's author as `author` claims they
       * wrote this text, and omitting the original entirely claims there isn't
       * one.
       *
       * So `author` is the site — we wrote the summary — and `isBasedOn` carries
       * the original with its own byline and publisher. That is exactly what
       * schema.org defines isBasedOn for, and it is also the link that tells a
       * crawler this page is derivative rather than a competing copy of the
       * source, which is what stops it being read as scraped content.
       */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "@id": `${SITE}${path}`,
          mainEntityOfPage: `${SITE}${path}`,
          headline: article.title,
          /* The OTHER name this piece goes by. `headline` above is the source's
             own — the archived, citable one — and this is the headline this site
             gives it, whichever language the reader is on. */
          ...(displayTitle(article, lang) !== article.title
            ? { alternativeHeadline: displayTitle(article, lang) }
            : {}),
          description: summaryFor(article, lang).thesis,
          /**
           * The language of the BODY THIS PAGE RENDERS, not of the chrome around
           * it — and now they can differ per page rather than always being Chinese.
           *
           * Read off the summary that was actually chosen: an /en page with an
           * English take is `en-US`, and one that fell back (an archived digest,
           * or an article whose English half never came back) is still `zh-CN`,
           * because that is the language of the text a crawler will find there.
           * Declaring `en-US` over Chinese prose is the same lie in the other
           * direction.
           */
          inLanguage: article.summary.en && lang === "en" ? "en-US" : "zh-CN",
          datePublished: article.publishedAt,
          /**
           * WHEN THE SUMMARY WAS WRITTEN, which is the day, not `publishedAt`.
           *
           * The two are genuinely different here and that is the point of stating
           * both: `datePublished` above is the ORIGINAL article's date, carried
           * over from the source, and can be days older than this page. What this
           * page is — our summary of it — was made on the day of the digest and
           * never touched again. So `dateModified` is the digest's date, and the
           * pair now says "an article from the 20th, summarised on the 23rd"
           * rather than leaving a crawler to assume the page has been sitting
           * unchanged since whenever the source published.
           */
          dateModified: date,
          image: `${SITE}${posterPartUrl(posterBase(lang, date, article.id), 1)}`,
          author: publisher(t.brand),
          publisher: publisher(t.brand),
          articleSection: category.nameEn,
          /**
           * Three levels, on the deepest page the site has. The URL carries the
           * headline itself now (see `articleSlug` in lib/links), so this is no
           * longer standing in for an unreadable path — what it still does is NAME
           * the levels, so a crawler reading `/2026/08/23/…` is told that the
           * middle of that path is a day and that the home page is its parent
           * rather than having to infer both.
           */
          breadcrumb: breadcrumb([
            { name: t.brand, url: `${SITE}${langHref(lang, "/")}` },
            { name: date, url: `${SITE}${langHref(lang, dayPath(date))}` },
            { name: article.title, url: `${SITE}${path}` },
          ]),
          isBasedOn: {
            "@type": "Article",
            url: article.url,
            name: article.title,
            ...(article.author
              ? { author: { "@type": "Person", name: article.author } }
              : {}),
            publisher: { "@type": "Organization", name: source.name, url: source.site },
          },
        }}
      />
      {/* NO TITLE. This page's heading is the headline, set beside the cover in
          the plate below — it was already an `<h1>` there, under a second one
          reading 每日严选. See the `title` prop in Shell.tsx. */}
      <Masthead
        /* THREE LEVELS, which is what this page actually is and what its JSON-LD
           has always said: the front page, the day, and this take. The middle
           crumb is the one that matters — a reader arriving from a share or a
           search has no idea this article belongs to a daily edition, and the
           trail is where that is legible without reading to the bottom.

           The headline is the last crumb and is truncated there; see Breadcrumb.
           `displayTitle` rather than `article.title`, so the crumb says what the
           H1 below it says in this language. */
        crumb={
          <Breadcrumb
            label={t.breadcrumb}
            items={[
              { label: t.home, href: langHref(lang, "/") },
              { label: date, href: langHref(lang, dayPath(date)) },
              { label: displayTitle(article, lang) },
            ]}
          />
        }
      >
        {/**
         * THE TOPIC, THEN THE DATE — the two axes this article sits on, in one
         * row, both of them links.
         *
         *     [● 技术] · 2026-09-18
         *       ↓            ↓
         *   /topic/tech   /2026/09/18
         *
         * DATE AND TOPIC DO NOT REPLACE EACH OTHER. An article belongs to an
         * EDITION (the day it ran in, which is what this site publishes) and to
         * a SUBJECT (what it is about, which is what anybody searches for), and
         * both have a page holding the rest of their kind. This row is the only
         * place a reader is offered both, and it is why the topic system did not
         * need to take anything away from the date system to exist.
         *
         * THE TOPIC LEADS, and it was the other way round for one round. The
         * date is where this piece came from; the topic is what it is — and a
         * reader arriving from a search result has no relationship with
         * 2026-09-18 at all, while the subject is the thing they were looking
         * for. The breadcrumb directly above still runs 首页 › 日期 › 标题,
         * which is the URL's own hierarchy and a different statement.
         *
         * THE SOURCE IS NOT IN THIS ROW, deliberately: it is forty pixels below
         * in the article plate, in its own colour beside the author, where it
         * has always been. Lifting it here would empty that line and change the
         * plate's shape to save a reader one glance.
         *
         * ONE LINE ON A PHONE. `Masthead` wraps this row, so the worst case is
         * two — and the breadcrumb above it truncates its last crumb rather
         * than wrapping (see `Breadcrumb`), so the header stays at two lines of
         * chrome above the headline rather than the four or five it could be.
         */}
        {topic ? (
          <>
            <a
              className="flex items-center gap-1.5"
              href={langHref(lang, topicPath(topic.id))}
              data-track="topic_open"
              data-track-topic={topic.id}
              data-track-from="article"
              data-track-lang={lang}
            >
              <span
                className="size-1.5 flex-none rounded-full"
                style={{ background: accentColor(topic) }}
              />
              {categoryName(topic, lang)}
            </a>
            <span className="size-1 rounded-full bg-orange" />
          </>
        ) : null}
        <a href={langHref(lang, dayPath(date))}>{date}</a>
      </Masthead>

      <section className={`${SECTION} ${PAD} flex flex-col gap-4`}>
        {/* Same shape as a list card: cover on the left of the header row, the
            summary at full width beneath it, actions last. See the note on
            ArticleCard for why the split stops at the header — with a 450-
            character summary a full-height cover column leaves a hole under the
            headline and squeezes the prose. */}
        <div className="flex flex-col rounded-card bg-card p-5 shadow-soft">
          <div className="flex items-center gap-4 sm:gap-5">
            <Cover
              id={article.id}
              sourceId={article.sourceId}
              image={article.image}
              variant="hero"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs font-semibold text-ink-soft">
              <span style={{ color: themedAccent(source.accent) }}>{source.name}</span>
              {/* No reading time — see the note in ArticleCards. */}
              {article.author ? (
                <>
                  <span className="size-0.75 rounded-full bg-current opacity-55" />
                  <span>{article.author}</span>
                </>
              ) : null}
              </div>

              <h1 className="mt-2.5 text-2xl leading-tight font-bold text-ink sm:text-3xl">
                <ArticleTitle article={article} lang={lang} variant="hero" />
              </h1>
            </div>
          </div>

          <Summary
            summary={summaryFor(article, lang)}
            variant="hero"
            lang={lang}
          />

          {/* Right-aligned, the same way a list card ends — and secondary for the
              same reason it is there: the summary is the product, not the trip
              off-site. */}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <a
              className={`rounded-full border border-line px-4 py-2 text-sm font-bold text-ink-mid${ACTION_OUTLINE}`}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              /* `from` separates the two places this pill exists: a reader on a
                 single-article page arrived from a share or a search, which is a
                 different reader from one scrolling the day's list. */
              data-track="read_original"
              data-track-source={article.sourceId}
              data-track-from="article"
            >
              {t.readFull}
            </a>
            {/**
             * SHARING IS BACK ON THIS PAGE, and it belongs on both.
             *
             * It used to live here as a block of its own; it moved to the list
             * rows because the pill there was a LINK down to this page, which put
             * a navigation between deciding to share and being able to — see the
             * note on `Actions` in ArticleCards. That argument was about the list,
             * and it never said this page should have none. A reader who arrived
             * from a search or somebody else's share lands here, finishes the
             * take, and has nowhere to pass it on.
             *
             * IDENTICAL PROPS TO THE LIST'S, deliberately: the same permalink, the
             * same poster set, the same title and thesis in the same language. A
             * share made from this page and one made from the day page have to be
             * the same object, or the poster a reader sends depends on which
             * screen they happened to press it from.
             */}
            <ShareButton
              url={path}
              posterBase={posterBase(lang, date, article.id)}
              parts={posterParts(summaryFor(article, lang))}
              title={displayTitle(article, lang)}
              thesis={summaryFor(article, lang).thesis}
              tags={summaryFor(article, lang).tags ?? []}
              lang={lang}
            />
          </div>
        </div>
      </section>

      {/**
       * WHAT TO READ NEXT, IN THE ORDER A READER DECIDES IT.
       *
       * Three blocks, and the order is the argument. First more reading, because
       * a reader who has just finished a take is deciding whether there is
       * another one worth their time and the answer has to be in front of them
       * before anything is asked of them. Then the newsletter, which is the ask —
       * and it lands at the one moment on this site where "finished" is
       * unambiguous. Then the day, which is where this page has always ended.
       *
       * THE PAGE USED TO END AT THE THIRD OF THOSE AND NOTHING ELSE. One link
       * onward, to a list the reader has probably already seen, on the page that
       * receives almost every arrival from search and from every link anybody
       * shares. That was the whole of this site's session depth.
       */}
      <div className={PAD}>
        <RelatedArticles article={article} lang={lang} />
      </div>

      {/* Only when there is somewhere for the address to go — `signupOpen` reads
          the Resend configuration on the server, the same gate `PageShell` asks
          on behalf of the bar. A subscribe block with no mailing list behind it
          is a form that fails after the reader has typed into it.

          `SECTION` for the rhythm and `PAD` for the gutter, like every other
          full-width block; the component itself draws the plate. */}
      {signupOpen() ? (
        <div className={`${SECTION} ${PAD}`}>
          <SubscribeDialog lang={lang} variant="inline" picks={MAIL_TOP_N} />
        </div>
      ) : null}

      <div className={PAD}>
        <EndLink
          href={langHref(lang, dayPath(date))}
          label={t.wholeDay}
          sub={t.wholeDaySub(date, found.digest.stats.shown)}
          track="day_open"
          trackFrom="article"
        />
      </div>

      <Footer year={date.slice(0, 4)} lang={lang} />
    </PageShell>
  );
}
