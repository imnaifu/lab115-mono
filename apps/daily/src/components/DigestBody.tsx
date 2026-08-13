"use client";

import { useState } from "react";
import { ArticleCard, ArticleRow, HeroCard } from "./ArticleCards";
import type { Lang } from "./Summary";
import { MIN_SCORE, type Category } from "@/lib/categories";
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

  // Land on the first section that actually has a CARD, not merely the first
  // section with articles. On a day when every AI item is a version
  // announcement, all of them score under the card floor, and defaulting to
  // that section opens the page on a bare list of links.
  //
  // 「全部」 is not the default because summaries now run to hundreds of
  // characters; it stays available for anyone who wants the whole thing in a
  // single screenshot.
  const firstWithCard =
    groups.find((g) => g.articles.some((a) => a.score >= MIN_SCORE)) ??
    groups[0];
  const [active, setActive] = useState<string>(
    firstWithCard?.category.id ?? ALL,
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

      {visible.map(({ category, articles }) => {
        // Articles arrive sorted by score. The top of each section gets cards;
        // everything after keeps its place as a one-line row rather than being
        // dropped. A low score forfeits the card but not the listing.
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
              <ArticleCard key={article.id} article={article} lang={lang} />
            ))}

            {rows.length > 0 ? (
              <div className="rows">
                {rows.map((article) => (
                  <ArticleRow key={article.id} article={article} lang={lang} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
