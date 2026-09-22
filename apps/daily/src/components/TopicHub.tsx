import { PageShell } from "./PageShell";
import { TopicImage } from "./TopicImage";
import { Breadcrumb, Footer, Masthead, PAD } from "./Shell";
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
 * person, never generated), beside the topic's own mark and how much is in it.
 * A reader who has never seen this site learns what it covers without following
 * a single link, which is what separates a hub from a doorway.
 *
 * IT IS THE INFORMATION ARCHITECTURE, NOT A KEYWORD PAGE. The bar links here on
 * every page, the drawer does on a phone, and every topic page's trail passes
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

      {/**
       * FLUSH ROWS, WHERE THIS WAS A TWO-COLUMN GRID OF PICTURE CARDS.
       *
       * THE CARDS WERE TOO BIG FOR WHAT THEY CARRY. Each one was a 16:9 band
       * over a `p-5` block, so eight of them ran past 1300px on a desktop and
       * close to 2800px on a phone — that is several screens of scrolling to
       * choose between eight links, and the picture was doing none of the
       * choosing. A topic's photograph is an identifying mark, not a preview of
       * anything; at 80px it still says which topic this is.
       *
       * THE SAME ROW THE REST OF THE SITE IS BUILT FROM — `ArticleBrief`, the
       * day list, the archive. All of them gave their cards up (see the note on
       * `ArticleBrief`); this grid was the last one still drawing them, which
       * made the hub look like a page from a different version of the site. The
       * thumbnail is even the same box: `size-20 sm:size-24`, which is `Cover`'s
       * `card` variant to the pixel, so the two kinds of list sit on one grid.
       *
       * THE PICTURE IS ON THE LEFT AND AN ARTICLE'S IS ON THE RIGHT, which is
       * deliberate rather than an oversight. An article row is words with a
       * thumbnail attached — the headline is what is being chosen between, so it
       * holds the left edge. A topic row is the opposite: eight emblems a reader
       * scans down before reading a single name, and putting them in one column
       * on the left is what makes that scan possible.
       *
       * THE WHOLE ROW IS THE LINK, with no stretched-link trick: there is one
       * destination per row and nothing else in it to click.
       */}
      <div className={PAD}>
        {topics.map(({ category, articles }) => (
          <a
            key={category.id}
            href={href(lang, topicPath(category.id))}
            /* The hover tint runs to the screen edge via the negative margin,
               so it does not stop 16px short and read as a misaligned box —
               same arrangement as every other row on the site. */
            className="group relative -mx-4 flex items-start gap-4 border-b border-line px-4 py-4 transition duration-150 ease-out last:border-0 hover:bg-page-deep sm:-mx-7 sm:px-7"
            data-track="topic_open"
            data-track-topic={category.id}
            data-track-from="topic_hub"
            data-track-lang={lang}
          >
            <TopicImage
              category={category}
              className="size-20 flex-none rounded-xl shadow-cover sm:size-24"
            />

            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
                <span
                  className="size-2 flex-none rounded-full"
                  style={{ background: accentColor(category) }}
                />
                {categoryName(category, lang)}
              </h2>

              {/* The hand-written line — see `RawCategory.description` in
                  user-config. It is the only original prose on this page and
                  it is what separates a hub from a list of links.
                  `line-clamp-2` so one long description cannot make its row
                  twice the height of the seven beside it. */}
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed font-semibold text-pretty text-ink-mid">
                {topicDescription(category, lang)}
              </p>

              <p className="mt-1.5 text-xs font-bold text-ink-soft">
                {t.topicPicked(articles.length)}
              </p>
            </div>
          </a>
        ))}
      </div>

      {/* Back to today. A reader who came in on this page from search has seen
          what the site covers and not what one edition looks like, and the front
          page is the only page that answers that. */}
      {/**
       * NO WAY-ONWARD CARD HERE ANY MORE. It read 「看其它日期 / 最近一周，以及
       * 更早的归档」 and pointed at `/`, and both halves of that had gone stale:
       * the front page is today's picks rather than a run of dates, and 归档 is
       * its own destination in the bar with a month browser behind it. A card
       * promising "the past week and the archive beyond it" led to neither.
       *
       * NOTHING REPLACES IT. The bar carries 今天 / 话题 / 归档 / 关于 on every
       * page and the phone gets the same four in the drawer, so the end of a
       * page no longer has to be a navigation surface — which is what let this
       * card exist in the first place, back when the footer was fine print and
       * the bar had one link in it.
       */}

      <Footer
        year={dates[0]?.slice(0, 4) ?? String(new Date().getUTCFullYear())}
        lang={lang}
      />
    </PageShell>
  );
}
