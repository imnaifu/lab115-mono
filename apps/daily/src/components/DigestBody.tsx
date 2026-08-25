"use client";

import { useState } from "react";
import { ArticleCard } from "./ArticleCards";
import { PAD, SECTION, SectionHead } from "./Shell";
import { strings } from "@/lib/i18n";
import { track } from "@/lib/track";
import type { Lang } from "@/lib/lang";
import { ALL_TAB, type Category } from "@/lib/categories";
import type { PublishedArticle } from "@/lib/types";

/** Every pill-shaped control on the page. Only the colours change per state. */
const PILL =
  "inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm font-bold";

export interface CategoryGroup {
  category: Category;
  articles: PublishedArticle[];
}

/**
 * Everything below the masthead: the language switch, the category tabs, the
 * hero and the sections.
 *
 * One client component rather than several, because language and section are
 * a single piece of state as far as the reader is concerned — the hero has to
 * follow the language switch just as the cards do.
 */
export function DigestBody({
  articles,
  groups,
  date,
  lang,
}: {
  /**
   * Every article of the day in PUBLISHED ORDER, which is by score — what the
   * 全部 tab shows.
   *
   * Passed in rather than derived by flattening `groups`, which would give the
   * registry's section order with a score ordering inside each one, and rather
   * than re-sorted here: the daily job already ranked these, `rank` records the
   * position it assigned, and a digest archived before those fields existed
   * would come out of a re-sort in an arbitrary order. Same set as `groups`
   * holds; the two differ only in how they are arranged.
   */
  articles: PublishedArticle[];
  groups: CategoryGroup[];
  /** Needed only to build each card's share link — the permalink is
   *  `/d/<date>/<id>`, because the store can only look articles up by day. */
  date: string;
  lang: Lang;
}) {
  const t = strings(lang);

  // 全部 is the landing state: the whole edition read top to bottom is what a
  // daily digest is for, and the tabs are there to skip ahead, not to be the
  // only way to see more than one section.
  const [active, setActive] = useState<string>(ALL_TAB);

  // A day's categories are whatever the model produced that day, so the state
  // can name a section this digest does not have — navigating from one date to
  // another with the component mounted is enough. Falling back to 全部 rather
  // than to the first section, because it is the one tab that is present on
  // every digest and never empty.
  const known = new Set<string>([ALL_TAB, ...groups.map((g) => g.category.id)]);
  const current = known.has(active) ? active : ALL_TAB;
  const visible = groups.filter((g) => g.category.id === current);

  return (
    <>
      {/* Directly above the sections they filter. */}
      <nav className={`mt-8 flex flex-wrap gap-2 ${PAD}`} aria-label={lang === "en" ? "Categories" : "分类"}>
        {/* First, and selected on arrival. It carries no accent because it is
            not a section — ink is the neutral tone, which is also what keeps it
            from reading as one more colour in the row. */}
        <Pill
          label={t.allTab}
          count={articles.length}
          on={current === ALL_TAB}
          onClick={() => {
            setActive(ALL_TAB);
            // Whether 全部 is used AT ALL is the open question here: the README
            // asserts nobody would, and that assertion has never been tested.
            track("category_tab", { tab: ALL_TAB });
          }}
        />
        {/* `inCategory` rather than `articles`, which is the whole day — the two
            counts sitting next to each other is precisely where shadowing the
            prop would go unnoticed. */}
        {groups.map(({ category, articles: inCategory }) => (
          <Pill
            key={category.id}
            label={lang === "en" ? category.nameEn : category.name}
            count={inCategory.length}
            on={current === category.id}
            accent={category.accent}
            onClick={() => {
              setActive(category.id);
              track("category_tab", { tab: category.id });
            }}
          />
        ))}
      </nav>

      {/* Articles arrive sorted by score; every one gets a full card. There is
          no card/row split any more — the publish floor in the daily job
          decides what appears, and what appears is worth the space.

          `gap-3` on the column replaces the old `.card + .card` margin and the
          heading's bottom margin at once. */}
      {current === ALL_TAB ? (
        /* 全部 is ONE ranked list, not the sections stacked up. Sections would
           re-impose the registry's running order on it, which buries the day's
           best piece under whichever category happens to come first; here the
           order is the score order and nothing else. No dot and no second name
           on the heading, for the same reason the folded list has neither — 全部
           is not a category, so it has no colour and no English twin. */
        <section className={`${SECTION} flex flex-col gap-3 ${PAD}`}>
          <SectionHead
            title={t.allTab}
            count={t.sectionCount(articles.length)}
          />
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              date={date}
              lang={lang}
            />
          ))}
        </section>
      ) : (
        visible.map(({ category, articles: inCategory }) => (
          <section
            className={`${SECTION} flex flex-col gap-3 ${PAD}`}
            key={category.id}
          >
            <SectionHead
              title={lang === "en" ? category.nameEn : category.name}
              dot={category.accent}
              count={t.sectionCount(inCategory.length)}
            />
            {inCategory.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                date={date}
                lang={lang}
              />
            ))}
          </section>
        ))
      )}
    </>
  );
}

/**
 * One tab. Extracted because 全部 and a category differ in exactly one thing —
 * whether the selected state has a colour of its own — and writing the button
 * twice for that would put the count, the pressed state and the pill classes in
 * two places.
 *
 * `accent` absent means 全部: selected, it goes ink, which is the page's neutral
 * rather than a ninth section colour. The accent has to be an inline style
 * either way, because it comes from config.json and no utility can name it.
 */
function Pill({
  label,
  count,
  on,
  accent,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  accent?: string;
  onClick: () => void;
}) {
  const tone = on
    ? accent
      ? "text-paper"
      : "border-ink bg-ink text-paper"
    : "bg-paper text-ink-mid";

  return (
    <button
      type="button"
      className={`${PILL} ${tone}`}
      aria-pressed={on}
      style={on && accent ? { background: accent, borderColor: accent } : undefined}
      onClick={onClick}
    >
      {label}
      <Count>{count}</Count>
    </button>
  );
}

function Count({ children }: { children: number }) {
  return <span className="text-xs font-extrabold opacity-65">{children}</span>;
}
