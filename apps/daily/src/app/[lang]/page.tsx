import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { displayTitle } from "@/components/ArticleTitle";
import { summaryFor } from "@/lib/take";
import { ArticleBrief } from "@/components/ArticleCards";
import { PageShell } from "@/components/PageShell";
import { SubscribeDialog } from "@/components/SubscribeDialog";
import { Footer, PAD, SECTION } from "@/components/Shell";
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
       * THE HERO BAND — the site's standing claim over a fixed photograph.
       *
       * IT WAS THE DAY'S WIKIMEDIA PICTURE for one commit, and the argument then
       * was that it is the only image this site has that belongs to the DAY
       * rather than to somebody's article. That is still true and it is no longer
       * what this band is for: a front page's masthead image should say what the
       * PUBLICATION is, and a picture that changes every morning says what today
       * is. `public/hero.webp` is ours, it is the same every visit, and it is the
       * thing a returning reader recognises.
       *
       * WHAT THAT COSTS, and it is a feature removal rather than a move: the
       * Wikimedia picture of the day now appears NOWHERE. It left the day page in
       * the previous commit (it was pushing twelve headlines off the first
       * screen) on the understanding that this band was its new home, and this
       * band is no longer it. The pipeline still fetches one every morning and
       * still stores it — see `DailyPhoto` in lib/types and `dailyPhoto` in
       * lib/photo — so nothing is lost from the archive and `PhotoCard` is intact
       * in components/Photo. It simply is not drawn. Putting it back is one
       * element on whichever page wants it.
       *
       * NO ATTRIBUTION LINE ANY MORE, and that follows from the same change
       * rather than being an oversight: the credit under this band was a LICENCE
       * OBLIGATION for a CC BY-SA photograph (see components/Photo). This image
       * is the site's own, so there is nobody to credit — and the moment that
       * stops being true, the line has to come back.
       */}
      <section className={`pt-4 ${PAD}`}>
        <div className="relative overflow-hidden rounded-card bg-page-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="absolute inset-0 size-full object-cover"
            src="/hero.webp"
            alt=""
            /* EAGER, and the only image on this site that is. It is the first
               screen by construction; deferring it is how a page ends up drawing
               itself twice. */
            loading="eager"
            fetchPriority="high"
          />
          {/* THE SCRIM, and it is a gradient rather than a flat wash: the words
              sit at the bottom left, so that is where the ink has to be and the
              top of the photograph should stay visible. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/10" />

          <div className="relative flex min-h-[260px] flex-col justify-end p-6 sm:min-h-[320px] sm:p-8">
            <h1 className="max-w-xl text-3xl leading-tight font-bold tracking-tight text-pretty text-white sm:text-4xl">
              {t.homeHeading(MAIL_TOP_N)}
            </h1>
            <p className="mt-3 max-w-md text-base leading-relaxed font-semibold text-pretty text-white/85">
              {t.dayLead}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {latest ? (
                <a
                  className="rounded-button bg-white px-5 py-2.5 text-sm font-bold text-ink transition duration-150 ease-out hover:bg-white/85"
                  href={href(lang, dayPath(latest))}
                  data-track="day_open"
                  data-track-from="home"
                >
                  {t.homeSeeToday} →
                </a>
              ) : null}
              {/* The subscribe control reuses the one sheet the whole site has —
                  see `SubscribeVariant`. `hero` is its third trigger, and it is
                  always on a photograph here, which is what `onPhoto` says. */}
              {signupOpen() ? (
                <SubscribeDialog
                  lang={lang}
                  variant="hero"
                  picks={MAIL_TOP_N}
                  onPhoto
                />
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
            <h2 className="text-xl font-bold tracking-tight text-ink">
              {t.todayPicks}
            </h2>
            {latest ? (
              <a
                className={`text-sm font-bold text-orange${ACTION_TEXT}`}
                href={href(lang, dayPath(latest))}
                data-track="day_open"
                data-track-from="home"
              >
                {t.seeAll} →
              </a>
            ) : null}
          </div>

          <div className="mt-2">
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
