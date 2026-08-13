"use client";

import { useState } from "react";
import { ArticleCard, ArticleRow } from "./ArticleCards";
import { MIN_SCORE, type Category } from "@/lib/categories";
import type { Article } from "@/lib/types";

const ALL = "all";

export interface CategoryGroup {
  category: Category;
  articles: Article[];
}

/**
 * Category tabs, defaulting to 「全部」.
 *
 * Tabs hide things, and this page exists to be screenshotted — a filtered view
 * would capture one section and silently drop the rest. So the default shows
 * every section stacked, exactly as before, and the tabs act as a filter on
 * top of it. Screenshot the page as it loads and nothing is missing.
 *
 * Only the group headings and card lists live in here; the hero stays outside,
 * because it leads the whole digest rather than any one section.
 */
export function CategoryTabs({ groups }: { groups: CategoryGroup[] }) {
  const [active, setActive] = useState<string>(ALL);

  // A tab whose category emptied out (or an `active` left over from a previous
  // day) must not produce a blank page.
  const known = new Set(groups.map((g) => g.category.id));
  const current = active !== ALL && known.has(active) ? active : ALL;
  const visible =
    current === ALL ? groups : groups.filter((g) => g.category.id === current);

  const total = groups.reduce((sum, g) => sum + g.articles.length, 0);

  return (
    <>
      <nav className="tabs pad" aria-label="分类">
        <button
          type="button"
          className={`tab${current === ALL ? " is-active" : ""}`}
          aria-pressed={current === ALL}
          onClick={() => setActive(ALL)}
        >
          全部
          <span className="tab__count">{total}</span>
        </button>

        {groups.map(({ category, articles }) => (
          <button
            key={category.id}
            type="button"
            className={`tab${current === category.id ? " is-active" : ""}`}
            aria-pressed={current === category.id}
            style={
              current === category.id
                ? { background: category.accent, borderColor: category.accent }
                : undefined
            }
            onClick={() => setActive(category.id)}
          >
            {category.name}
            <span className="tab__count">{articles.length}</span>
          </button>
        ))}
      </nav>

      {visible.map(({ category, articles }) => {
        // Articles arrive already sorted by score. The top of each section gets
        // cards; everything after keeps its place as a one-line row rather than
        // being dropped. A low score forfeits the card but not the listing —
        // otherwise a thin section would hand a card to filler.
        const cards = articles.filter(
          (a, i) => i < category.cardCount && a.score >= MIN_SCORE,
        );
        const rows = articles.filter((a) => !cards.includes(a));

        return (
          <section className="section pad" key={category.id}>
            <div className="section__head">
              <h2 className="section__title">
                <span
                  className="section__dot"
                  style={{ background: category.accent }}
                />
                {category.name}
                <small className="section__sub">{category.nameEn}</small>
              </h2>
              <span className="section__count">{articles.length} 篇</span>
            </div>

            {cards.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}

            {rows.length > 0 ? (
              <div className="rows">
                {rows.map((article) => (
                  <ArticleRow key={article.id} article={article} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
