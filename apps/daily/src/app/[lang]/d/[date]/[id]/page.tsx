import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleShare } from "@/components/ArticleShare";
import { ArticleTitle, displayTitle } from "@/components/ArticleTitle";
import { Cover } from "@/components/Cover";
import { EndLink, Footer, Masthead, PAD, PageShell, SECTION } from "@/components/Shell";
import { Stars } from "@/components/Stars";
import { Summary } from "@/components/Summary";
import { categoryOf } from "@/lib/categories";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href as langHref, isLang } from "@/lib/lang";
import { posterHeight, POSTER_WIDTH } from "@/lib/share";
import { sourceOf } from "@/lib/sources";
import { articlePath } from "@/lib/links";
import { readArticle } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ lang: string; date: string; id: string }> };

/**
 * og:image is wired here rather than through Next's `opengraph-image` file
 * convention, because that convention needs a static `size` and the poster's
 * height depends on the summary. `posterHeight` is deterministic, so the meta
 * can state the real dimensions — the same call the route itself makes.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, date, id } = await params;
  // Resolved before the lookup, because the not-found title needs it too.
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);

  const found = await readArticle(date, id);
  if (!found) return { title: `${t.notFoundTitle} · ${t.brand}` };

  const { article } = found;
  /**
   * The summary of THIS page's language, which is what the poster route renders.
   *
   * It was hardcoded to `.zh`, so an English page declared an og:image height
   * computed from the Chinese summary — and the English text is roughly twice the
   * characters, so the number was wrong by hundreds of pixels on every /en
   * article. The height below is the whole reason this has to agree with the
   * route: `ImageResponse` needs concrete dimensions, and og:image promises them
   * to crawlers before the image is ever fetched.
   */
  const summary = article.summary[pageLang];
  const path = langHref(pageLang, articlePath(date, article.id));

  // Mirrors the poster route's headline choice — see the note there.
  const translated = pageLang === "zh" ? (article.titleZh ?? "") : "";

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
          url: `${SITE}${path}/share.png`,
          width: POSTER_WIDTH,
          height: posterHeight(
            summary,
            translated || article.title,
            translated ? article.title : "",
          ),
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
              {article.score > 0 ? (
                <>
                  <span className="size-0.75 rounded-full bg-current opacity-55" />
                  <Stars score={article.score} lang={lang} />
                </>
              ) : null}
              </div>

              <h1 className="mt-2.5 text-2xl leading-tight font-bold text-ink sm:text-3xl">
                <ArticleTitle article={article} lang={lang} variant="hero" />
              </h1>
            </div>
          </div>

          <Summary summary={article.summary} variant="hero" lang={lang} />

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

        <div className="flex flex-col gap-3 rounded-card border border-line bg-paper px-6 py-5">
          <div className="text-sm font-bold text-ink">{t.shareThis}</div>
          {/* This page's own URL, which is also what a card's dialog copies —
              one shared-link shape for the whole site. */}
          <ArticleShare
            url={`${SITE}${path}`}
            imageUrl={`${path}/share.png`}
            title={displayTitle(article, lang)}
            lang={lang}
          />
          <div className="text-xs font-medium text-ink-soft">
            {t.shareHint}
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
