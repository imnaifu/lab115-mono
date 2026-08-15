import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleShare } from "@/components/ArticleShare";
import { Cover } from "@/components/Cover";
import { EndLink, Footer, Masthead, PAD, PageShell, SECTION } from "@/components/Shell";
import { Summary } from "@/components/Summary";
import { categoryOf } from "@/lib/categories";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href as langHref, isLang } from "@/lib/lang";
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
  const found = await readArticle(date, id);
  if (!found) return { title: "未找到 · 每日干货" };

  const { article } = found;
  const summary = article.summary.zh;
  const path = langHref(isLang(lang) ? lang : "zh", articlePath(date, article.id));

  return {
    title: `${article.title} · 每日干货`,
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
          height: posterHeight(summary, article.title),
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
        title="每日干货"
        subtitle="Daily Takes"
        lang={lang}
        path={articlePath(date, article.id)}
      >
        <a href={langHref(lang, `/d/${date}`)}>{date}</a>
        <span className="size-1 rounded-full bg-orange" />
        <span style={{ color: category.accent }}>{lang === "en" ? category.nameEn : category.name}</span>
      </Masthead>

      <section className={`${SECTION} ${PAD} flex flex-col gap-4`}>
        <div className="flex items-start gap-5 rounded-card bg-card p-5 shadow-soft">
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
              {article.title}
            </h1>

            <Summary summary={article.summary} variant="hero" lang={lang} />

            <a
              className="mt-5 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper"
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.readFull}
            </a>
          </div>

          {/* Hidden on a phone: the cover is decoration here, and the summary
              is what the page is for. */}
          <div className="hidden sm:flex">
            <Cover
              id={article.id}
              sourceId={article.sourceId}
              image={article.image}
              variant="hero"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-card border border-line bg-paper px-6 py-5">
          <div className="text-sm font-bold text-ink">{t.shareThis}</div>
          <ArticleShare
            url={`${SITE}${path}`}
            imageUrl={`${path}/share.png`}
            title={article.title}
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
