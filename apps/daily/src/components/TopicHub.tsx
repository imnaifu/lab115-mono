import { displayTitle } from "./ArticleTitle";
import { PageShell } from "./PageShell";
import {
  Breadcrumb,
  EndLink,
  Footer,
  Masthead,
  PAD,
  SECTION,
} from "./Shell";
import { accentColor, categoryName, topicDescription } from "@/lib/categories";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { articlePath, TOPIC_PATH, topicPath } from "@/lib/links";
import { breadcrumb, JsonLd, publisher } from "@/lib/seo";
import { liveTopics } from "@/lib/topics";
import { listDates } from "@/lib/store";

/**
 * `/topic` — the way IN to the topic system, for somebody who has not got one
 * in mind yet.
 *
 * WHY IT IS A PAGE RATHER THAN A ROW OF LINKS. The previous round argued against
 * this URL, and the argument was about a list of eight names with counts —
 * correctly, that is a doorway page. What is here instead is one hand-written
 * sentence per topic (see `RawCategory.description` in user-config: written by a
 * person, never generated) and the two newest pieces in it. A reader who has
 * never seen this site learns what it covers and what is in it this week
 * without following a single link, which is what separates a hub from a
 * doorway.
 *
 * IT IS THE INFORMATION ARCHITECTURE, NOT A KEYWORD PAGE. The bar links here,
 * the front page's chip row ends here, and every topic page's trail passes
 * through it — so it is the parent node the topic system was missing, and its
 * job is answering "what does this site write about" for a person. The SEO
 * value is a consequence of that being a real question, not the reason for the
 * page.
 *
 * HOW MANY ROWS IT CAN EVER HAVE: as many as config.json has categories, minus
 * the quiet ones. Eight today. A topic is a category the summariser classifies
 * against, not a keyword, so this list cannot grow by accident — which is the
 * property that makes a hub safe here and would not make a tag index safe.
 */

/** How many recent pieces each card names. TWO — enough to show the topic is
 *  alive and what it sounds like, few enough that eight cards stay a page
 *  rather than a feed. The topic's own page is one tap away for the rest. */
const RECENT_PER_TOPIC = 2;

export async function TopicHub({ lang }: { lang: Lang }) {
  const t = strings(lang);
  const [topics, dates] = await Promise.all([liveTopics(), listDates()]);
  const url = `${SITE}${href(lang, TOPIC_PATH)}`;

  return (
    <PageShell lang={lang} path={TOPIC_PATH}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": url,
          url,
          name: `${t.topicHubTitle} · ${t.brand}`,
          description: t.topicHubLead,
          inLanguage: lang === "zh" ? "zh-CN" : "en-US",
          publisher: publisher(t.brand),
          isPartOf: { "@id": `${SITE}${href(lang, "/")}#site` },
          breadcrumb: breadcrumb([
            { name: t.brand, url: `${SITE}${href(lang, "/")}` },
            { name: t.topicHubTitle, url },
          ]),
          /**
           * The topics, as a list of the PAGES rather than of the articles on
           * them — which is the one structural difference from every other
           * `ItemList` on this site. A hub's items are sections; naming the
           * sixteen articles it happens to preview would describe a page that
           * changes twice a week and would compete with the `ItemList` each
           * topic page already declares for itself.
           */
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: topics.length,
            itemListElement: topics.map(({ category }, at) => ({
              "@type": "ListItem",
              position: at + 1,
              url: `${SITE}${href(lang, topicPath(category.id))}`,
              name: categoryName(category, lang),
            })),
          },
        }}
      />

      <Masthead
        title={t.topicHubTitle}
        crumb={
          <Breadcrumb
            label={t.breadcrumb}
            items={[
              { label: t.home, href: href(lang, "/") },
              { label: t.topicHubTitle },
            ]}
          />
        }
      />

      <section className={`${SECTION} ${PAD}`}>
        <p className="max-w-prose text-ink-mid">{t.topicHubLead}</p>
      </section>

      {/**
       * The cards. Two columns from `sm:`, one on a phone.
       *
       * THE WHOLE CARD IS NOT A LINK, and that is not an oversight — the two
       * recent pieces inside it are links of their own, and an anchor cannot
       * legally contain another. The site has been here before: `ArticleBrief`
       * used to be one big link with the share pill floated over it on `z-10`,
       * and the note there records naming the actions instead as the fix. Same
       * answer, so the topic name is the link and the rows under it are theirs.
       */}
      <div className={`${SECTION} ${PAD} grid gap-3 sm:grid-cols-2`}>
        {topics.map(({ category, articles }) => {
          const name = categoryName(category, lang);
          const recent = articles.slice(0, RECENT_PER_TOPIC);
          return (
            <section
              key={category.id}
              className="flex flex-col rounded-card border border-line bg-paper px-5 py-4"
            >
              <h2 className="font-serif text-xl font-bold tracking-tight text-ink">
                <a
                  className="flex items-center gap-2.5 transition duration-150 ease-out hover:text-orange"
                  href={href(lang, topicPath(category.id))}
                  data-track="topic_open"
                  data-track-topic={category.id}
                  data-track-from="topic_hub"
                  data-track-lang={lang}
                >
                  <span
                    className="size-2.5 flex-none rounded-full"
                    style={{ background: accentColor(category) }}
                  />
                  {name}
                </a>
              </h2>

              <p className="mt-1 text-xs font-bold text-ink-soft">
                {t.topicPicked(articles.length)}
              </p>

              {/* The hand-written line. `text-pretty` because these run to two
                  lines in a 2-up grid and a one-word last line looks broken. */}
              <p className="mt-2.5 text-sm leading-relaxed font-medium text-pretty text-ink-mid">
                {topicDescription(category, lang)}
              </p>

              {/* WHAT IS ACTUALLY IN THERE THIS WEEK, which is the half that
                  stops this being a directory. A card with a description and no
                  contents describes a section; these two rows show it is alive
                  and what it sounds like. `mt-auto` pins them to the bottom so
                  the eight cards' rules line up across the grid however long
                  each description runs. */}
              {recent.length ? (
                <div className="mt-auto pt-4">
                  <p className="text-[11px] font-bold tracking-[0.08em] text-ink-soft">
                    {t.topicRecent}
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {recent.map(({ date, article }, at) => (
                      <li key={article.id}>
                        <a
                          className="flex gap-2.5 text-sm leading-snug font-medium text-ink transition duration-150 ease-out hover:text-orange"
                          href={href(lang, articlePath(date, article))}
                          data-track="summary_open"
                          data-track-source={article.sourceId}
                          data-track-from="topic_hub"
                          data-track-age={at}
                        >
                          <time
                            className="flex-none pt-px text-xs tabular-nums text-ink-soft"
                            dateTime={date}
                          >
                            {date.slice(5)}
                          </time>
                          <span className="min-w-0 flex-1">
                            {displayTitle(article, lang)}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {/* Back to today. A reader who came in on this page from search has seen
          what the site covers and not what one edition looks like, and the front
          page is the only page that answers that. */}
      <div className={PAD}>
        <EndLink
          href={href(lang, "/")}
          label={t.allDays}
          sub={t.allDaysSub}
          track="home_open"
          trackFrom="topic_hub"
        />
      </div>

      <Footer
        year={dates[0]?.slice(0, 4) ?? String(new Date().getUTCFullYear())}
        lang={lang}
      />
    </PageShell>
  );
}
