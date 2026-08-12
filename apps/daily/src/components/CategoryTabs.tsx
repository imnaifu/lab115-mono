"use client";

import { useState } from "react";
import { ArticleCard } from "./ArticleCards";
import type { Category } from "@/lib/categories";
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

      {visible.map(({ category, articles }) => (
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
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </section>
      ))}
    </>
  );
}
