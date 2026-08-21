import { notFound } from "next/navigation";
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
import { articlePath } from "@/lib/links";
import { readArticle } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ lang: string; date: string; id: string }> };

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
  const { lang, date, id } = await params;
  // Resolved before the lookup, because the not-found title needs it too.
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);

  const found = await readArticle(date, id);
  if (!found) return { title: `${t.notFoundTitle} · ${t.brand}` };

  const { article } = found;
  // The thesis, for og:description. There is one summary and it is Chinese —
  // an /en page renders the same one, as the page below does.
  const summary = article.summary.zh;
  const path = langHref(pageLang, articlePath(date, article.id));

  return {
    // The ORIGINAL headline, in both languages: a <title> is how this page is
    // identified in a tab, a bookmark and a search result, and the headline is
    // the article's name. The Chinese rendering is a reading aid on the page,
    // not a second identity for it.
    title: `${article.title} · ${t.brand}`,
    description: summary.thesis,
    alternates: { canonical: `${SITE}${path}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: summary.thesis,
      url: `${SITE}${path}`,
      images: [
        {
          // No `?part=` — the route's default IS part 1, which is what a caller
          // that knows nothing about parts should get. See `posterPart`.
          url: `${SITE}${path}/share.png`,
          width: POSTER_WIDTH,
          height: POSTER_HEIGHT,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: summary.thesis,
      images: [`${SITE}${path}/share.png`],
    },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { lang, date, id } = await params;
  if (!isLang(lang)) notFound();
  const t = strings(lang);

  const found = await readArticle(date, id);
  if (!found) notFound();

  const { article } = found;
  const source = sourceOf(article.sourceId);
  const category = categoryOf(article.category);
  const path = langHref(lang, articlePath(date, article.id));

  return (
    <PageShell>
      <Masthead
        title={t.brand}
        lang={lang}
        path={articlePath(date, article.id)}
      >
        <a href={langHref(lang, `/d/${date}`)}>{date}</a>
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
              <span className="size-0.75 rounded-full bg-current opacity-55" />
              <span>{t.minutesToRead(article.readingMinutes)}</span>
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

          <Summary summary={article.summary} variant="hero" />

          {/* Right-aligned, the same way a list card ends — and secondary for the
              same reason it is there: the summary is the product, not the trip
              off-site. */}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <a
              className="rounded-full border border-line px-4 py-2 text-sm font-bold text-ink-mid"
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
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
        />
      </div>

      <Footer year={date.slice(0, 4)} lang={lang} />
    </PageShell>
  );
}
