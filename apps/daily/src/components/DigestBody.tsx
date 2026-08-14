"use client";

import { useState } from "react";
import { ArticleCard, HeroCard } from "./ArticleCards";
import type { Lang } from "./Summary";
import { type Category } from "@/lib/categories";
import type { Article } from "@/lib/types";

const ALL = "all";

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
  // reach the page at all, so any section that exists has cards in it and the
  // search has nothing left to find.
  //
  // 「全部」 is not the default because summaries run to hundreds of characters
  // and every article is now a full card; it stays available for anyone who
  // wants the whole thing in a single screenshot.
  const [active, setActive] = useState<string>(
    groups[0]?.category.id ?? ALL,
  );

  const known = new Set(groups.map((g) => g.category.id));
  const current = active === ALL || known.has(active) ? active : ALL;
  const visible =
    current === ALL ? groups : groups.filter((g) => g.category.id === current);

  const total = groups.reduce((sum, g) => sum + g.articles.length, 0);

  return (
    <>
      {/* Language stays ABOVE the hero because it rewrites the hero too; a
          control that sits below the text it changes reads as unrelated to it. */}
      <div className="controls pad">
        <div className="lang" role="group" aria-label="语言">
          {(["zh", "en"] as const).map((code) => (
            <button
              key={code}
              type="button"
              className={`lang__btn${lang === code ? " is-active" : ""}`}
              aria-pressed={lang === code}
              onClick={() => setLang(code)}
            >
              {code === "zh" ? "中文" : "EN"}
            </button>
          ))}
        </div>
      </div>

      {hero ? (
        <section className="section pad">
          <HeroCard article={hero} lang={lang} />
        </section>
      ) : null}

      {/* Category tabs sit BELOW the hero, directly above the sections they
          filter — the hero is not in any category, so tabs above it implied a
          filter that had no effect on the first thing you read. */}
      <nav className="tabs pad" aria-label="分类">
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
        <button
          type="button"
          className={`tab${current === ALL ? " is-active" : ""}`}
          aria-pressed={current === ALL}
          onClick={() => setActive(ALL)}
        >
          全部
          <span className="tab__count">{total}</span>
        </button>
      </nav>

      {/* Articles arrive sorted by score; every one of them gets a full card.
          There is no card/row split any more — the publish floor in the daily
          job decides what appears, and what appears is worth the space. */}
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
            <ArticleCard key={article.id} article={article} lang={lang} />
          ))}
        </section>
      ))}
    </>
  );
}
