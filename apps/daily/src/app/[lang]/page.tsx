import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { displayTitle } from "@/components/ArticleTitle";
import { summaryFor } from "@/lib/take";
import { ArticleBrief } from "@/components/ArticleCards";
import { PageShell } from "@/components/PageShell";
import { SubscribeDialog } from "@/components/SubscribeDialog";
import { Footer, HEADING, PAD, SECTION } from "@/components/Shell";
import { MAIL_TOP_N, SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { signupOpen } from "@/lib/mail/resend";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { articlePath, dayPath } from "@/lib/links";
import { JsonLd, publisher, website } from "@/lib/seo";
import { listDates, readDigest, shownArticles } from "@/lib/store";

// Read from the git clone on every request — the cron rewrites those files
// underneath a long-running server, so nothing here may be cached at build time.
export const dynamic = "force-dynamic";

/** The hover system — see the note on these in components/ArticleCards. */
const ACTION_TEXT =
  " transition duration-150 ease-out hover:opacity-70 active:opacity-55";

/**
 * The hero heading with its second half under the highlighter — the design
 * system's cover marks the phrase after the comma (「理解更大的世界」).
 *
 * SPLIT AT THE LAST COMMA rather than marked up in lib/i18n, so the strings
 * stay plain text for the places that read them as text (the page title, the
 * JSON-LD). A heading with no comma is drawn whole and unmarked.
 *
 * `box-decoration-clone` so a phrase that wraps gets the stroke on each line
 * rather than one stroke broken across the wrap.
 */
function HighlightTail({ text }: { text: string }) {
  const comma = Math.max(text.lastIndexOf("，"), text.lastIndexOf(", "));
  if (comma < 0) return <>{text}</>;
  const cut = text[comma] === "，" ? comma + 1 : comma + 2;
  return (
    <>
      {text.slice(0, cut)}
      <mark className="box-decoration-clone bg-transparent bg-[linear-gradient(transparent_62%,var(--color-highlight)_62%)] px-0.5 text-inherit">
        {text.slice(cut)}
      </mark>
    </>
  );
}

/** The arrow on the hero's primary pill — the design system's line icon. */
function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 flex-none"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * How many pieces the list under the teaser runs to.
 *
 * NOT IN lib/paging, unlike `FRONT_DAYS` and `ARCHIVE_PAGE_SIZE`. Those two live
 * there because three files have to agree about them — the front page, the
 * archive and the sitemap — and a disagreement means a sitemap pointing at a page
 * that does not exist. This number is read in one place and changes nothing
 * anywhere else, so it lives where it is used.
 *
 * FIVE, AND IT IS NOW A SLICE OF ONE DAY rather than a run across seven.
 *
 * It was seven, matching `FRONT_DAYS`, because the list under the teaser took
 * one piece from each of the last seven editions. The page leads with the newest
 * edition now, so this is "how much of today the front page shows" — and the
 * number that matters about it is that it is LESS THAN A DAY HOLDS. The front
 * page rendered the whole digest for most of this site's life and Google
 * clustered it with the day's permalink; five rows against twelve is a different
 * page, and the button under them is the way to the rest.
 */
const FRONT_POSTS = 5;

/* `POSTS_PER_DAY` LIVED HERE and is gone with the seven-day list it capped. It
   existed because without it `FRONT_POSTS` was filled entirely by the newest
   digest — fifteen rows all stamped one date, and no way to reach days two
   through seven. The front page does not span days at all now, so there is
   nothing left to ration. `/archive` is the page that spans them. */

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
   * ONE DAY, NOT SEVEN, and that is the whole of what this page reads now.
   *
   * It used to open `FRONT_DAYS` digests to build a seven-day run of headlines
   * under the teaser. That list is gone: the page leads with the newest edition
   * and hands the reader to `/archive` for the rest, so six of those seven file
   * reads were paying for a block that no longer exists.
   */
  const digest = latest ? await readDigest(latest) : null;
  const shown = digest ? shownArticles(digest) : [];
  const todays = shown.slice(0, FRONT_POSTS);
  const lead = shown[0];

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
      {/**
       * THE HERO BAND — the site's standing claim, on the design system's cover:
       * a cream band with a few pastel discs and the yellow, the second half of
       * the heading under the highlighter.
       *
       * IT WAS A FIXED PHOTOGRAPH (`public/hero.webp`) under a dark scrim, and
       * before that, for one commit, the day's Wikimedia picture. The argument
       * that retired the Wikimedia picture still holds — a front page's
       * masthead should say what the PUBLICATION is, the same every visit — and
       * this band says it the way lab115.com does, in flat colour rather than a
       * picture. The photograph went with the Sokosoko restyle.
       *
       * THE WIKIMEDIA PICTURE OF THE DAY APPEARS NOWHERE, as it has not since
       * that commit. The pipeline still fetches one every morning and still
       * stores it — see `DailyPhoto` in lib/types and `dailyPhoto` in lib/photo
       * — so nothing is lost from the archive and `PhotoCard` is intact in
       * components/Photo. Putting it back is one element on whichever page
       * wants it, and its CC BY-SA credit line has to come back with it.
       *
       * THE DISCS ARE DECORATION — `aria-hidden`, and they keep their light
       * pastel in the dark, as every illustration fill does; they are toned
       * down there so they do not outshine the heading.
       */}
      <section className={`pt-4 ${PAD}`}>
        <div className="relative overflow-hidden rounded-panel bg-page-deep">
          <span
            aria-hidden
            className="absolute -top-16 -left-20 size-64 rounded-full bg-fill-mint opacity-60 dark:opacity-20"
          />
          <span
            aria-hidden
            className="absolute -right-10 -bottom-20 size-52 rounded-full bg-fill-sky opacity-60 dark:opacity-20"
          />
          <span
            aria-hidden
            className="absolute top-5 right-5 size-8 rounded-full bg-brand sm:top-8 sm:right-[10%] sm:size-12"
          />

          <div className="relative flex min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center sm:min-h-[320px] sm:px-8 sm:py-16">
            <h1 className="max-w-xl font-display text-3xl leading-tight font-extrabold text-pretty text-ink sm:text-4xl">
              <HighlightTail text={t.homeHeading(MAIL_TOP_N)} />
            </h1>
            <p className="mt-3 max-w-md text-base leading-relaxed font-normal text-pretty text-ink-soft">
              {t.dayLead}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {latest ? (
                <a
                  /* `text-ink-fixed`, NOT `text-ink`: the yellow is the same in
                     both themes and `ink` inverts — in dark mode the label would
                     go near-white on the yellow and vanish. See the token in
                     index.css. */
                  className="flex items-center gap-1.5 rounded-button bg-brand px-5 py-2.5 text-sm font-bold text-ink-fixed transition duration-150 ease-out hover:bg-brand-deep active:bg-brand-deep"
                  href={href(lang, dayPath(latest))}
                  data-track="day_open"
                  data-track-from="home"
                >
                  {t.homeSeeToday}
                  <ArrowIcon />
                </a>
              ) : null}
              {/* The subscribe control reuses the one sheet the whole site has —
                  see `SubscribeVariant`. `hero` is its third trigger; without
                  `onPhoto` it draws as the outlined secondary pill. */}
              {signupOpen() ? (
                <SubscribeDialog lang={lang} variant="hero" picks={MAIL_TOP_N} />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/**
       * TODAY'S PICKS — the top few of the newest edition, in its own order.
       *
       * FIVE, NOT THE WHOLE DAY. The front page rendered the entire digest for
       * most of this site's life and that made it a byte-for-byte twin of the
       * day's permalink: Google clustered the two and Search Console reported one
       * as a duplicate whose canonical it had overridden. Five rows against
       * twelve is a different page, and the button under them is the way to the
       * rest.
       *
       * THE SAME ROW COMPONENT THE DAY PAGE USES, numbered from 1. A front page
       * that draws its own version of a row is a second place for the number's
       * width, the thumbnail's side and the dek's clamp to drift.
       */}
      {todays.length ? (
        <section className={`${SECTION} ${PAD}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={`${HEADING} inline-block text-xl`}>
              {t.todayPicks}
            </h2>
            {latest ? (
              <a
                className={`text-sm font-bold text-link${ACTION_TEXT}`}
                href={href(lang, dayPath(latest))}
                data-track="day_open"
                data-track-from="home"
              >
                {t.seeAll} →
              </a>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {todays.map((article, at) => (
              <ArticleBrief
                article={article}
                date={latest!}
                key={article.id}
                lang={lang}
                index={at + 1}
              />
            ))}
          </div>

          {/**
           * THE WAY-ONWARD PILL WAS HERE. It read 「查看今日全部 12 篇 →」 and
           * sat centred under the five rows, shown only when the day held more
           * than five.
           *
           * IT WAS THE THIRD LINK TO ONE PAGE on one screen. The hero's
           * 「查看今日精选」 and this section's own 「查看全部」 both already
           * point at `dayPath(latest)`, so the day page keeps its inbound links
           * and nothing is orphaned — what went is a reader being offered the
           * same destination three times before the footer.
           *
           * `dayCount` WENT WITH IT. It existed only to fill this button's
           * count and to decide whether the button drew at all.
           */}
        </section>
      ) : null}

      <Footer
        year={dates[0]?.slice(0, 4) ?? String(new Date().getUTCFullYear())}
        lang={lang}
      />
    </PageShell>
  );
}
