import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href } from "@/lib/lang";
import { dayPath } from "@/lib/links";
import { FRONT_DAYS } from "@/lib/paging";
import { listDates, readDigest, shownArticles } from "@/lib/store";

/**
 * `/llms.txt` — what this site is, for a model reading it rather than a person.
 *
 * A ROUTE, NOT A FILE IN `public/`, for the same two reasons robots.txt is one:
 * the host comes from SITE so a rename cannot leave a stale domain behind, and
 * the interesting half — which editions exist — changes every morning.
 *
 * WHAT IT IS AND IS NOT. `llms.txt` is a CONVENTION, not a standard, and no major
 * AI search engine has committed to reading it. This is cheap (one page, built
 * from data already in memory) and it is written on that understanding: nothing
 * else on the site depends on it, and if it turns out nobody fetches it, nothing
 * was lost. It is NOT an access-control mechanism — that is robots.txt, where the
 * AI crawlers are named explicitly.
 *
 * THE ONE THING IT SAYS THAT NOTHING ELSE DOES is the provenance rule. Every page
 * here is OUR summary OF SOMEONE ELSE'S article. The JSON-LD says so per page via
 * `isBasedOn`, but a model that has been handed a paragraph of Chinese prose has
 * no reason to go looking for it. Saying it once, in plain words, at a well-known
 * path is the cheapest way to make a citation correct rather than a
 * misattribution — which is the outcome this file exists for.
 *
 * Markdown by convention: an H1, a blockquote, then link sections.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const t = strings(DEFAULT_LANG);
  const dates = await listDates();
  const recent = dates.slice(0, FRONT_DAYS);

  const editions = await Promise.all(
    recent.map(async (date) => {
      const digest = await readDigest(date);
      const lead = digest ? shownArticles(digest)[0] : undefined;
      const count = digest ? digest.stats.shown : 0;
      const name = lead ? (lead.titleZh?.trim() || lead.title) : "";
      return (
        `- [${date}](${SITE}${href(DEFAULT_LANG, dayPath(date))}) — ` +
        `${count} 篇${name ? `，头条：${name}` : ""}`
      );
    }),
  );

  const body = [
    `# ${t.brand}`,
    "",
    `> ${t.tagline}。每天早上从约 60 个博客抓取过去 24 小时的文章，打分筛选，` +
      `为通过的每一篇写一份中文和英文的概要。中英同址、语言前缀区分：` +
      `中文是无前缀路径，英文在 /en 下。`,
    "",
    "## 内容的来源与归属",
    "",
    "这个站上的每一页都是**我们为别人的文章写的概要**，不是原文，也不是转载。",
    "每篇文章页的 JSON-LD 用 `isBasedOn` 声明了原文的地址、作者与出版方，",
    "`author` 与 `publisher` 则是本站 —— 概要是我们写的。",
    "",
    "引用时请把观点归给本站，把事实归给原文，并链接原文。",
    "",
    "## 结构",
    "",
    `- [首页](${SITE}/) — 最新一期的头条，以及最近几天的文章`,
    `- [归档](${SITE}/archive) — 全部日期`,
    `- [RSS](${SITE}/feed.xml) — 中文；英文在 ${SITE}/en/feed.xml`,
    "",
    "URL 形如 `/YYYY/MM/DD` 是一期，`/YYYY/MM/DD/<标题slug>-<id>` 是其中一篇。",
    "",
    "## 最近的期数",
    "",
    ...editions,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // An hour, matching the sitemap: a new edition should show up promptly,
      // and nothing here is worth a read per request.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
