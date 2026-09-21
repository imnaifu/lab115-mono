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
import {
  readArticleBySlug,
  readDigest,
  retiredMatch,
  shownArticles,
} from "@/lib/store";
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
  /**
   * THE THESIS, for `description` / `og:description` / `twitter:description` —
   * in the language of the page being described, which is the whole point of a
   * per-language `<meta>`: a link to /en unfurling with a Chinese sentence under
   * an English title is the mismatch that rule fixes.
   *
   * NEVER `whyItMatters`, and it was that for one round. A search result has to
   * answer "what is at this URL"; 「为什么值得关注」 answers "why we thought it
   * mattered", which is a sentence about our editing rather than about the
   * subject somebody typed into the box. It is also the sentence a crawler would
   * find nowhere near the top of the page — the thesis is the dek, and a
   * description that matches the page's opening is the one a result shows
   * unaltered. See the note on `leadOf`'s absence in lib/take.
   */
  const lead = summaryFor(article, pageLang).thesis;
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
    description: lead,
    // Both languages, not just this one — see alternatesFor. `path` above is
    // already language-prefixed; this wants the bare form.
    alternates: alternatesFor(pageLang, canonicalPath),
    openGraph: {
      type: "article",
      // The same headline the tab and the page show — an unfurl that disagrees
      // with the page it links to is the same mismatch one surface over.
      title: heading,
      description: lead,
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
      description: lead,
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

  /**
   * THE NEIGHBOURS, WITHIN THIS DAY ONLY.
   *
   * `shownArticles` returns the digest's own order, which is by score — so
   * "previous" and "next" mean one place up and one place down THIS EDITION's
   * running order, and the first and last piece of a day each have one
   * direction rather than two.
   *
   * NOT ACROSS DAYS, which was the other option and is a worse one for a
   * DAILY: a `next` that walks off the end of the 21st into the top of the
   * 20th quietly turns fifteen editions into one infinite scroll, and the thing
   * this site publishes is editions. Reaching yesterday is what the day link and
   * the archive are for. It also keeps this to one file read — the digest is
   * already in hand from `readArticleBySlug`.
   */
  const dayList = shownArticles(found.digest);
  const at = dayList.findIndex((entry) => entry.id === article.id);
  const previous = at > 0 ? dayList[at - 1] : null;
  const next = at >= 0 && at < dayList.length - 1 ? dayList[at + 1] : null;

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
      {/* NO TITLE. This page's heading is the headline, set in the column
          below — it was already an `<h1>` there, under a second one reading
          每日严选. See the `title` prop in Shell.tsx. */}
      <Masthead
        /**
         * `← 返回` REPLACES THE VISIBLE TRAIL, and the trail's STRUCTURED half
         * stays — the `BreadcrumbList` in the JSON-LD above is untouched, and it
         * is the half Google draws in a result.
         *
         * What went is 首页 › 2026-09-18 › 标题 as three links above the
         * headline. On a phone that was a line of small grey type whose last
         * crumb had to be truncated mid-headline to fit, and its two useful
         * destinations are both still one press away: the day is this link, and
         * the home page is the wordmark in the bar on every page.
         *
         * IT POINTS AT THE DAY, not at `history.back()`. A real href is a link a
         * crawler follows, a middle-click opens and a reader can see the
         * destination of; `back()` would need a client component and would send
         * a reader who arrived from a search result to Google.
         */
        crumb={
          <div className="mt-6">
            <a
              className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
              href={langHref(lang, dayPath(date))}
            >
              ← {t.backToDay}
            </a>
          </div>
        }
      >
        {/**
         * THE TOPIC, THE SOURCE, THE DATE — one row, and the topic and the date
         * are links.
         *
         *     [● 技术] · The Conversation · 2026-09-18
         *        ↓                              ↓
         *    /topic/tech                   /2026/09/18
         *
         * DATE AND TOPIC DO NOT REPLACE EACH OTHER. An article belongs to an
         * EDITION (the day it ran in, which is what this site publishes) and to
         * a SUBJECT (what it is about, which is what anybody searches for), and
         * both have a page holding the rest of their kind. This row is the only
         * place a reader is offered both.
         *
         * THE TOPIC LEADS. The date is where this piece came from; the topic is
         * what it is — and a reader arriving from a search result has no
         * relationship with 2026-09-18 at all.
         *
         * THE SOURCE IS IN THIS ROW NOW, and it was in the plate below for a
         * long time — beside the author, in its own colour. It came up here with
         * the plate: the page is a plain column, so there is no longer a card
         * header for it to live in, and a byline row is where a reader looks for
         * "who published this" anyway. It keeps its own accent colour, which is
         * the one thing in this row that is not grey.
         *
         * THE SOURCE IS NOT A LINK. `/s/<id>` exists and is switched off — see
         * SOURCE_PAGES_LIVE in lib/sources — so linking it would be pointing at
         * a 404. It becomes one the day that flag flips.
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
        <span style={{ color: themedAccent(source.accent) }}>{source.name}</span>
        {article.author ? (
          <>
            <span className="size-1 rounded-full bg-orange" />
            <span>{article.author}</span>
          </>
        ) : null}
        <span className="size-1 rounded-full bg-orange" />
        <a href={langHref(lang, dayPath(date))}>{date}</a>
      </Masthead>

      {/**
       * A PLAIN COLUMN, WHERE THIS WAS A RAISED PLATE.
       *
       * `rounded-card bg-card p-5 shadow-soft` wrapped the whole article — a
       * panel containing a headline, a summary and a row of buttons. On the one
       * page of the site devoted to a single piece, a card is a container around
       * the only thing on screen, which is a container around nothing. The day
       * list gave its cards up in the same round (see `ArticleBrief`), and the
       * whole site now reads as one column with rules across it.
       *
       * WHAT THE PLATE WAS DOING that now has to be done by type: separating
       * the article from the page. The headline is `text-3xl` ink, the dek is
       * 18px ink-mid, the prose 16px — that hierarchy was always there, and it
       * was being drawn on top of a second, redundant one made of shadow.
       */}
      <section className={`${SECTION} ${PAD}`}>
        <h1 className="text-2xl leading-tight font-bold text-ink sm:text-3xl">
          <ArticleTitle article={article} lang={lang} variant="hero" />
        </h1>

        <Summary
          summary={summaryFor(article, lang)}
          variant="hero"
          lang={lang}
          /**
           * THE HERO BAND, between the dek and the prose — which is where a
           * lede image goes in every publication and is why `Summary` takes a
           * slot for it rather than the page drawing the three parts itself.
           *
           * IT WAS A 144px SQUARE beside the headline, the same shape a list row
           * uses. That made the article page match the list it was reached from,
           * which was the old argument for it; the list is a row of navigation
           * with a thumbnail on the right now, and this is the one place the
           * picture is the piece's own rather than an identifying mark.
           *
           * NO CAPTION AND NO CREDIT LINE, and that is a data limit rather than
           * a design choice: `Article.image` is a URL off the source's feed and
           * nothing in the digest carries a description or a rights holder for
           * it. (The one image on this site that DOES have both is the day's
           * Wikimedia photograph — see `DailyPhoto`, which stores `caption`,
           * `artist` and `license` precisely because the licence requires it.)
           * Inventing 「图片来源：The Conversation」 would be asserting a credit
           * nobody checked, and printing the source's name under somebody's
           * photograph is exactly the kind of claim that is wrong occasionally
           * and silently.
           */
          lede={
            <Cover
              id={article.id}
              sourceId={article.sourceId}
              image={article.image}
              variant="banner"
            />
          }
        />

        {/**
         * OUT TO THE ORIGINAL — a whole card now, where this was one pill in a
         * right-aligned row.
         *
         * IT IS THE ONE ACTION THIS PAGE OWES and it earns the width: a reader
         * at the foot of our summary either wants the article or does not, and a
         * 40px pill among two others made that the same size as a decision about
         * sharing. The card also has room for the thing the pill could not
         * carry — THE ORIGINAL'S OWN HEADLINE, in its own language — which is
         * what tells a reader what they are about to open before they open it,
         * and doubles as the honest statement that this page has been a summary
         * of somebody else's writing.
         *
         * STILL SECONDARY IN WEIGHT despite the size: an outline card, not a
         * filled one. This digest exists so that most of the time a reader does
         * not have to click here — `read_original` is the counter-metric, see
         * TRACKING.md — so the emphasis must not push them off the page it just
         * spent 450 characters replacing.
         */}
        <a
          className={`${SECTION} flex items-center gap-4 rounded-card border border-line px-5 py-4${ACTION_OUTLINE}`}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          /* `from` separates the two places this exists: a reader on a
             single-article page arrived from a share or a search, which is a
             different reader from one scrolling the day's list. */
          data-track="read_original"
          data-track-source={article.sourceId}
          data-track-from="article"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-base font-bold text-ink">
                {t.readOriginal}
              </span>
              <span className="size-1 flex-none rounded-full bg-orange" />
              <span
                className="text-sm font-semibold"
                style={{ color: themedAccent(source.accent) }}
              >
                {source.name}
              </span>
            </span>
            {/* The article's OWN name, which on this site is always
                `article.title` — never the rewrite. See `titleZh` in lib/types:
                the rewrite is our headline, and what is on the other end of this
                link is the piece the source published. */}
            <span className="mt-1 block text-sm leading-snug font-medium text-ink-soft">
              {article.title}
            </span>
          </span>
          {/* The outbound mark. `aria-hidden` because the anchor's own text
              already says where this goes. */}
          <span aria-hidden className="flex-none text-base text-ink-soft">
            ↗
          </span>
        </a>

        {/**
         * SHARING, and it is at the FOOT of the article rather than in the top
         * bar — which is where the reference design puts it.
         *
         * The bar stopped being sticky in this same round, so a control up there
         * is only reachable by scrolling back to the top of a long page: exactly
         * the cost that change was noted as having. The moment a reader wants to
         * pass a piece on is the moment they finish it, and that moment is here.
         *
         * IDENTICAL PROPS TO EVERY OTHER SHARE ENTRY POINT, deliberately: the
         * same permalink, the same poster set, the same title and thesis in the
         * same language, so a share made here and one made anywhere else are the
         * same object.
         */}
        <div className="mt-3 flex justify-end">
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

      {/**
       * PREVIOUS / NEXT, WITHIN THIS EDITION.
       *
       * Two links at the foot of the piece, in the day's own running order — see
       * `previous`/`next` above for why this does not walk into yesterday.
       *
       * EACH ONE NAMES THE PIECE IT LEADS TO rather than saying only 「下一篇」.
       * A bare direction asks a reader to press a control to find out what is
       * behind it; a headline lets them decide. That is the same reason the day
       * list shows a dek rather than a chevron alone.
       *
       * `min-w-0` + `line-clamp-2` on each label: these are headlines, and two
       * of them side by side on a phone is the one place on this site where a
       * long one would push the other off the row.
       *
       * The FIRST and LAST piece of a day each get one direction, and the empty
       * side renders a bare `<span />` so the surviving link stays on its own
       * end of the row rather than sliding to the middle — the same shape the
       * archive's pager uses.
       *
       * `summary_open` with `from=neighbour`, which is a number worth having on
       * its own: it says whether a reader who finished one take reads the next
       * one in the same edition, and that is the closest thing this site has to
       * a measure of an edition being read rather than a page being landed on.
       */}
      {previous || next ? (
        <nav className={`${PAD} mt-8 flex items-start justify-between gap-4`}>
          {previous ? (
            <a
              className="group min-w-0 flex-1 text-left"
              href={langHref(lang, articlePath(date, previous))}
              data-track="summary_open"
              data-track-source={previous.sourceId}
              data-track-from="neighbour"
            >
              <span className="block text-xs font-bold text-ink-soft">
                ← {t.prevArticle}
              </span>
              <span className="mt-1 block line-clamp-2 text-sm leading-snug font-bold text-ink-mid transition duration-150 ease-out group-hover:text-ink">
                {displayTitle(previous, lang)}
              </span>
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a
              className="group min-w-0 flex-1 text-right"
              href={langHref(lang, articlePath(date, next))}
              data-track="summary_open"
              data-track-source={next.sourceId}
              data-track-from="neighbour"
            >
              <span className="block text-xs font-bold text-ink-soft">
                {t.nextArticle} →
              </span>
              <span className="mt-1 block line-clamp-2 text-sm leading-snug font-bold text-ink-mid transition duration-150 ease-out group-hover:text-ink">
                {displayTitle(next, lang)}
              </span>
            </a>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <Footer year={date.slice(0, 4)} lang={lang} />
    </PageShell>
  );
}
