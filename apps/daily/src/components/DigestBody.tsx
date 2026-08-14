"use client";

import { useState } from "react";
import { ArticleCard, HeroCard } from "./ArticleCards";
import { PAD, SECTION, SectionHead } from "./Shell";
import type { Lang } from "./Summary";
import { type Category } from "@/lib/categories";
import type { Article } from "@/lib/types";

const ALL = "all";

/** Every pill-shaped control on the page. Only the colours change per state. */
const PILL =
  "inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm font-bold";

export interface CategoryGroup {
  category: Category;
  articles: Article[];
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
  hero,
  groups,
}: {
  hero: Article | null;
  groups: CategoryGroup[];
}) {
  const [lang, setLang] = useState<Lang>("zh");

  // The first section, full stop. This used to hunt for the first section with
  // a CARD, because a section could hold nothing but sub-threshold rows and
  // open the page on a bare list of links. Sub-threshold articles no longer
  // reach the page at all, so any section that exists has cards in it.
  //
  // 「全部」 is not the default because summaries run to hundreds of characters
  // and every article is a full card; it stays available for anyone who wants
  // the whole thing in a single screenshot.
  const [active, setActive] = useState<string>(groups[0]?.category.id ?? ALL);

  const known = new Set(groups.map((g) => g.category.id));
  const current = active === ALL || known.has(active) ? active : ALL;
  const visible =
    current === ALL ? groups : groups.filter((g) => g.category.id === current);

  const total = groups.reduce((sum, g) => sum + g.articles.length, 0);

  return (
    <>
      {/* Language stays ABOVE the hero because it rewrites the hero too; a
          control that sits below the text it changes reads as unrelated to it.
          It is a segmented pair rather than another pill in the tab row, so a
          mode never looks interchangeable with a filter. */}
      <div className={`mt-8 flex justify-end ${PAD}`}>
        <div
          className="flex overflow-hidden rounded-full border border-line bg-paper"
          role="group"
          aria-label="语言"
        >
          {(["zh", "en"] as const).map((code) => (
            <button
              key={code}
              type="button"
              className={`cursor-pointer px-3 py-2 text-xs font-bold ${
                lang === code ? "bg-ink text-paper" : "text-ink-soft"
              }`}
              aria-pressed={lang === code}
              onClick={() => setLang(code)}
            >
              {code === "zh" ? "中文" : "EN"}
            </button>
          ))}
        </div>
      </div>

      {hero ? (
        <section className={`${SECTION} ${PAD}`}>
          <HeroCard article={hero} lang={lang} />
        </section>
      ) : null}

      {/* Category tabs sit BELOW the hero, directly above the sections they
          filter — the hero is not in any category, so tabs above it implied a
          filter that had no effect on the first thing you read. */}
      <nav className={`mt-8 flex flex-wrap gap-2 ${PAD}`} aria-label="分类">
        {groups.map(({ category, articles }) => {
          const on = current === category.id;
          return (
            <button
              key={category.id}
              type="button"
              className={`${PILL} ${on ? "text-paper" : "bg-paper text-ink-mid"}`}
              aria-pressed={on}
              style={
                on
                  ? { background: category.accent, borderColor: category.accent }
                  : undefined
              }
              onClick={() => setActive(category.id)}
            >
              {category.name}
              <Count>{articles.length}</Count>
            </button>
          );
        })}
        {/* 「全部」 has no category accent to colour it, so its active state is
            the ink background rather than an inline style. */}
        <button
          type="button"
          className={`${PILL} ${
            current === ALL
              ? "border-ink bg-ink text-paper"
              : "bg-paper text-ink-mid"
          }`}
          aria-pressed={current === ALL}
          onClick={() => setActive(ALL)}
        >
          全部
          <Count>{total}</Count>
        </button>
      </nav>

      {/* Articles arrive sorted by score; every one gets a full card. There is
          no card/row split any more — the publish floor in the daily job
          decides what appears, and what appears is worth the space.

          `gap-3` on the column replaces the old `.card + .card` margin and the
          heading's bottom margin at once. */}
      {visible.map(({ category, articles }) => (
        <section
          className={`${SECTION} flex flex-col gap-3 ${PAD}`}
          key={category.id}
        >
          <SectionHead
            title={category.name}
            sub={category.nameEn}
            dot={category.accent}
            count={`${articles.length} 篇`}
          />
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} lang={lang} />
          ))}
        </section>
      ))}
    </>
  );
}

function Count({ children }: { children: number }) {
  return <span className="text-xs font-extrabold opacity-65">{children}</span>;
}
