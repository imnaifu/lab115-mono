import {
  Breadcrumb,
  Footer,
  Masthead,
  PAD,
  PageShell,
  SECTION,
  SectionHead,
} from "./Shell";
import { SubscribeSection } from "./SubscribeSection";
import { themedAccent } from "@/lib/accent";
import { accentColor, CATEGORIES, categoryOf } from "@/lib/categories";
import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { SOURCES_PATH, sourcePath } from "@/lib/links";
import { descriptionFor, hasSourcePage, SOURCES, type Source } from "@/lib/sources";
import { breadcrumb, JsonLd, publisher } from "@/lib/seo";
import { articlesBySource, listDates } from "@/lib/store";

/**
 * `/s` — every blog this site reads, grouped by the beat it usually writes on.
 *
 * WHAT MAKES THIS A PAGE RATHER THAN A LIST. The site had no page that answered
 * "where does this come from" — the only place a source was named was a chip on a
 * card, linking straight out to the blog itself. So the one genuinely original
 * thing this app knows, the hand-written line about each of sixty-four blogs in
 * config.json plus the count of how many of its pieces cleared the floor, was
 * visible nowhere. That is also the answer to the question a reader arriving from
 * a search has: not "what is today's digest" but "who decides what I am reading".
 *
 * IT IS THE ONLY INTERNAL WAY IN to the source pages, which is why it exists at
 * all rather than the per-source pages standing alone: a page nothing links to is
 * a page a crawler reaches only through the sitemap and weighs accordingly.
 *
 * GROUPED BY `Source.category`, and lib/categories.ts explicitly warns that a
 * source→category map misfiles ARTICLES — Hacker News spans everything, so every
 * article is classified on its own. That warning is about a different question.
 * This page is a directory OF BLOGS, and `Source.category` is documented as
 * exactly that: editorial metadata for reviewing the list, i.e. the blog's usual
 * beat. Nothing here claims anything about where a given piece was filed.
 */
export async function SourcesView({ lang }: { lang: Lang }) {
  const t = strings(lang);
  const [bySource, dates] = await Promise.all([articlesBySource(), listDates()]);

  const pickedOf = (source: Source) => bySource.get(source.id)?.length ?? 0;

  /**
   * The order the digest itself runs in, from config.json, and a trailing group
   * for anything whose `category` no longer names a live one.
   *
   * Same fallback rule as everywhere else — see CATEGORY_BY_ID in lib/categories —
   * so a source pointing at a retired id lands in the catch-all rather than
   * vanishing from a page whose whole job is to be the complete list.
   */
  const groups = CATEGORIES.map((category) => ({
    category,
    sources: SOURCES.filter(
      (source) => categoryOf(source.category).id === category.id,
    ),
  })).filter((group) => group.sources.length > 0);

  const url = `${SITE}${href(lang, SOURCES_PATH)}`;
  // Only the ones a reader can actually open. A list item pointing at a 404 is
  // worse than a shorter list — see SOURCE_MIN_ARTICLES.
  const linkable = SOURCES.filter((source) => hasSourcePage(pickedOf(source)));

  return (
    <PageShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": url,
          url,
          name: `${t.brand} · ${t.sourcesTitle}`,
          description: t.sourcesLead,
          inLanguage: lang === "zh" ? "zh-CN" : "en-US",
          publisher: publisher(t.brand),
          isPartOf: { "@id": `${SITE}${href(lang, "/")}#site` },
          breadcrumb: breadcrumb([
            { name: t.brand, url: `${SITE}${href(lang, "/")}` },
            { name: t.sourcesTitle, url },
          ]),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: linkable.length,
            itemListElement: linkable.map((source, at) => ({
              "@type": "ListItem",
              position: at + 1,
              url: `${SITE}${href(lang, sourcePath(source.id))}`,
              name: source.name,
            })),
          },
        }}
      />

      <Masthead
        title={t.brand}
        subtitle={t.tagline}
        crumb={
          <Breadcrumb
            label={t.breadcrumb}
            items={[
              { label: t.home, href: href(lang, "/") },
              { label: t.sourcesTitle },
            ]}
          />
        }
        lang={lang}
        path={SOURCES_PATH}
      >
        <span>{t.sourceCount(SOURCES.length)}</span>
      </Masthead>

      {/**
       * THE ONE PARAGRAPH ON THIS SITE THAT IS OURS.
       *
       * Every other body of text here is a summary of somebody else's article, and
       * that is the shape a search engine is most sceptical of. This says what the
       * list is and what the two admission rules are — a question a reader actually
       * has, answered in a sentence nobody else could write. See `sourcesLead` in
       * lib/i18n.
       */}
      <p className={`${SECTION} ${PAD} max-w-prose text-ink-mid`}>
        {t.sourcesLead}
      </p>

      {groups.map(({ category, sources }) => (
        <section className={`${SECTION} ${PAD}`} key={category.id}>
          <SectionHead
            title={lang === "zh" ? category.name : category.nameEn}
            count={t.sectionCount(sources.length)}
            dot={accentColor(category)}
          />
          <div className="mt-3 flex flex-col gap-2">
            {sources.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                picked={pickedOf(source)}
                lang={lang}
              />
            ))}
          </div>
        </section>
      ))}

      <SubscribeSection lang={lang} />

      <Footer
        year={dates[0]?.slice(0, 4) ?? String(new Date().getUTCFullYear())}
        lang={lang}
      />
    </PageShell>
  );
}

/**
 * One blog in the directory: its name, the line about what it publishes, and how
 * much of it we have run.
 *
 * A LINK OR A DIV, on `hasSourcePage`. Below the threshold the source is still
 * LISTED — this page's promise is that it is the whole list, and quietly dropping
 * the quiet blogs would break that for the exact sources a reader is least likely
 * to already know — but it is not a link, because there is no page behind it yet.
 * A row that looks clickable and 404s is the worse of the two failures.
 *
 * The count line is the tell either way, so nothing has to explain the absence:
 * `收录过 2 篇` next to an unlinked name reads as "not much yet", which is true.
 */
function SourceRow({
  source,
  picked,
  lang,
}: {
  source: Source;
  picked: number;
  lang: Lang;
}) {
  const t = strings(lang);
  const linked = hasSourcePage(picked);
  const description = descriptionFor(source, lang);

  const body = (
    <>
      <span className="flex items-center justify-between gap-3.5">
        <span className="flex min-w-0 items-center gap-2">
          {/* The source's own colour, the same one its cards and its poster
              carry, so a name learned on a card is recognisable here. */}
          <span
            className="size-2 flex-none rounded-full"
            style={{ background: themedAccent(source.accent) }}
          />
          <span className="truncate text-lg font-bold text-ink">
            {source.name}
          </span>
        </span>
        <span className="text-sm font-bold whitespace-nowrap text-ink-soft">
          {linked ? t.sourcePicked(picked) : t.sourceQuiet(picked)}
        </span>
      </span>
      {/**
       * The hand-written line from config.json, in the reader's language.
       *
       * IT USED TO BE CHINESE-ONLY, and /en got a name and a count and nothing
       * else — sixty-four rows of it. `descriptionEn` is now a required field
       * for the same reason the count is not optional: this line is most of what
       * distinguishes one row from the next, and a directory without it is a
       * list of names.
       *
       * Still branched on empty rather than assumed present: `sourceOf`'s
       * placeholder has neither language, which is a real state for a source id
       * that has left config.json. See `descriptionFor`.
       */}
      {description ? (
        <span className="line-clamp-2 text-sm text-ink-mid">{description}</span>
      ) : null}
    </>
  );

  const shell = "flex flex-col gap-1.5 rounded-xl border border-line px-5 py-4";

  return linked ? (
    <a
      className={`${shell} bg-paper`}
      href={href(lang, sourcePath(source.id))}
      data-track="source_open"
      data-track-from="sources"
    >
      {body}
    </a>
  ) : (
    /* `bg-page-deep`, the same ground the empty state uses: a row that is not a
       target should not be wearing a card's raised paper. */
    <div className={`${shell} bg-page-deep`}>{body}</div>
  );
}
