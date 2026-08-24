import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { ArticleTitle } from "@/components/ArticleTitle";
import { Cover } from "@/components/Cover";
import { EndLink, Footer, Masthead, PAD, PageShell, SECTION } from "@/components/Shell";
import { Summary } from "@/components/Summary";
import { categoryOf } from "@/lib/categories";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href as langHref, isLang } from "@/lib/lang";
import { POSTER_HEIGHT, POSTER_WIDTH } from "@/lib/share";
import { sourceOf } from "@/lib/sources";
import { articlePath, dayPath, posterBase, posterPartUrl } from "@/lib/links";
import { summaryFor } from "@/lib/take";
import { alternatesFor, breadcrumb, JsonLd, publisher } from "@/lib/seo";
import { readArticleBySlug } from "@/lib/store";

export const dynamic = "force-dynamic";

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

  return {
    // The ORIGINAL headline, in both languages: a <title> is how this page is
    // identified in a tab, a bookmark and a search result, and the headline is
    // the article's name. The Chinese rendering is a reading aid on the page,
    // not a second identity for it.
    title: `${article.title} · ${t.brand}`,
    description: summary.thesis,
    // Both languages, not just this one — see alternatesFor. `path` above is
    // already language-prefixed; this wants the bare form.
    alternates: alternatesFor(pageLang, canonicalPath),
    openGraph: {
      type: "article",
      title: article.title,
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
      title: article.title,
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
  if (!found) notFound();

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

  return (
    <PageShell>
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
          ...(article.titleZh ? { alternativeHeadline: article.titleZh } : {}),
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
      <Masthead title={t.brand} lang={lang} path={articlePath(date, article)}>
        <a href={langHref(lang, dayPath(date))}>{date}</a>
        <span className="size-1 rounded-full bg-orange" />
        <span style={{ color: category.accent }}>{lang === "en" ? category.nameEn : category.name}</span>
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
              <span style={{ color: source.accent }}>{source.name}</span>
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

          <Summary summary={summaryFor(article, lang)} variant="hero" />

          {/* Right-aligned, the same way a list card ends — and secondary for the
              same reason it is there: the summary is the product, not the trip
              off-site. */}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <a
              className="rounded-full border border-line px-4 py-2 text-sm font-bold text-ink-mid"
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
          </div>
        </div>
      </section>

      <div className={PAD}>
        <EndLink
          href={langHref(lang, `/d/${date}`)}
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
