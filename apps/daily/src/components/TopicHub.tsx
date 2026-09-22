import { PageShell } from "./PageShell";
import { TopicImage } from "./TopicImage";
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
import { TOPIC_PATH, topicPath } from "@/lib/links";
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

/* `RECENT_PER_TOPIC` LIVED HERE. Each card used to name the two newest pieces in
   its topic, and the argument for them was that they showed a reader "what is in
   it this week" without following a link. They are gone with the redesign: eight
   cards times two rows is sixteen extra links on a page whose whole job is to
   offer eight, and a picture says "this section is alive" in the space two
   headlines took. What keeps this a hub rather than a doorway is unchanged and
   is now carrying the argument alone — the hand-written sentence per topic, see
   `RawCategory.description` in lib/user-config. */

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

      {/* THE VISIBLE SUB IS NOT THE `<meta name="description">`, and this is the
          one page on the site where they differ — see `topicHubSub` in lib/i18n
          for why two sentences for two audiences is right here and wrong
          everywhere else. */}
      <Masthead title={t.topicHubTitle} lead={t.topicHubSub} />

      {/* The cards. Two columns from `sm:`, one on a phone. */}
      <div className={`${SECTION} ${PAD} grid gap-3 sm:grid-cols-2`}>
        {topics.map(({ category, articles }) => {
          const name = categoryName(category, lang);
          return (
            <a
              key={category.id}
              href={href(lang, topicPath(category.id))}
              className="group flex flex-col overflow-hidden rounded-card border border-line bg-paper transition duration-150 ease-out hover:border-ink-soft"
              data-track="topic_open"
              data-track-topic={category.id}
              data-track-from="topic_hub"
              data-track-lang={lang}
            >
              {/* THE WHOLE CARD IS A LINK AGAIN, which it was not a moment ago:
                  the card used to carry two article rows of its own, and an
                  anchor cannot contain another. Those rows are gone (see the
                  note above), so there is one destination per card and the card
                  can simply be it — no stretched link, no overlay. */}
              <TopicImage category={category} className="aspect-video w-full" />

              <div className="flex flex-1 flex-col p-5">
                <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-ink">
                  <span
                    className="size-2.5 flex-none rounded-full"
                    style={{ background: accentColor(category) }}
                  />
                  {name}
                </h2>

                {/* The hand-written line — see `RawCategory.description` in
                    user-config. It is the only original prose on this page and
                    it is what separates a hub from a list of links. */}
                <p className="mt-2 text-sm leading-relaxed font-medium text-pretty text-ink-mid">
                  {topicDescription(category, lang)}
                </p>

                <p className="mt-auto pt-3 text-xs font-bold text-ink-soft">
                  {t.topicPicked(articles.length)}
                </p>
              </div>
            </a>
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
