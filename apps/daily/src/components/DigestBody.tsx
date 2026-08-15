"use client";

import { useState } from "react";
import { ArticleCard } from "./ArticleCards";
import { PAD, SECTION, SectionHead } from "./Shell";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import { type Category } from "@/lib/categories";
import type { Article } from "@/lib/types";

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
  groups,
  date,
  lang,
}: {
  groups: CategoryGroup[];
  /** Needed only to build each card's share link — the permalink is
   *  `/d/<date>/<id>`, because the store can only look articles up by day. */
  date: string;
  lang: Lang;
}) {
  const [active, setActive] = useState<string>(groups[0]?.category.id ?? "");

  // A day's categories are whatever the model produced that day, so the state
  // can name a section this digest does not have — navigating from one date to
  // another with the component mounted is enough. Falling back to the first
  // section keeps something on screen; there is no 「全部」 to fall back to any
  // more.
  const known = new Set(groups.map((g) => g.category.id));
  const current = known.has(active) ? active : (groups[0]?.category.id ?? "");
  const visible = groups.filter((g) => g.category.id === current);

  return (
    <>
      {/* Directly above the sections they filter. */}
      <nav className={`mt-8 flex flex-wrap gap-2 ${PAD}`} aria-label={lang === "en" ? "Categories" : "分类"}>
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
              {lang === "en" ? category.nameEn : category.name}
              <Count>{articles.length}</Count>
            </button>
          );
        })}
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
            title={lang === "en" ? category.nameEn : category.name}
            sub={lang === "en" ? category.name : category.nameEn}
            dot={category.accent}
            count={strings(lang).sectionCount(articles.length)}
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
      ))}
    </>
  );
}

function Count({ children }: { children: number }) {
  return <span className="text-xs font-extrabold opacity-65">{children}</span>;
}
