import type { Lang } from "./lang";

/**
 * Every string the interface says, in both languages.
 *
 * Functions rather than templates with placeholders: interpolation, plurals and
 * word order all come free, and TypeScript checks the arguments at each call
 * site. "3 posts" vs "3 篇新文章" is not a substitution — the two languages put
 * the number in a different relationship to the noun.
 *
 * ONE LANGUAGE AT A TIME, everywhere. This is a site-wide rule, and it is the
 * easiest one to break here, because the tempting move when writing a bilingual
 * digest is to put both halves on screen at once: 每日干货 above Daily Takes,
 * "Archive · 看看前几天读到了什么", a section titled 技术 with Tech beside it. The
 * page then states everything twice and reads like two publications stapled
 * together, and neither reader is served — the half they cannot read is noise
 * occupying the position where the next real line should be.
 *
 * So no value here may contain both scripts. A reader on the Chinese side sees
 * Chinese and nothing else; the English side likewise. Proper nouns are not
 * translations and stay as they are (source names, product names, "DeepSeek").
 * Dates and counts are not either.
 *
 * Three things are exempt, all of them structural rather than editorial: the
 * language switch itself must show both names or it cannot be used; a section's
 * category name comes from config.json, which stores `name`/`nameEn` and hands
 * the page whichever one the language asks for; and the model prompts in
 * summarize.ts are instructions, not interface.
 *
 * The browser title obeys the rule too, which is why the page-level
 * `generateMetadata` calls build their titles from `brand` rather than from a
 * constant — see app/layout.tsx.
 */
const STRINGS = {
  zh: {
    brand: "每日干货",
    /** Follows the brand in a <title>, e.g. "每日干货 — 技术博客每日摘要". */
    titleTag: "技术博客每日摘要",
    notFoundTitle: "未找到",

    allTab: "全部",

    posts: (n: number) => `${n} 篇新文章`,
    readTime: (n: number) => `读完约 ${n} 分钟`,
    sectionCount: (n: number) => `${n} 篇`,
    minutes: (n: number) => `${n} 分钟`,
    minutesToRead: (n: number) => `${n} 分钟读完原文`,
    days: (n: number) => `${n} 天`,
    rating: (n: number) => `评分 ${n} 星，满分 5 星`,

    readFull: "阅读全文 →",
    share: "分享",
    shareThis: "分享这一篇",
    copyLink: "复制链接",
    copied: "已复制链接",
    saveImage: "保存图片",
    shareVia: "分享到…",
    /** A platform name, so it takes the name that platform uses here. */
    weibo: "微博",
    shareHint: "图片里带完整摘要和链接，可以直接发出去。",
    highlightHint: "想强调哪句话？在上面选中它，保存的图片就会把它划出来。",
    highlighted: (n: number) => `已选中 ${n} 个字，图片里会划出来。`,

    archive: "往期回顾",
    archiveSub: "看看前几天读到了什么",
    today: "回到今日",
    todaySub: "看今天这一期",
    wholeDay: "看这一天的全部",
    wholeDaySub: (date: string, n: number) => `${date} · 共 ${n} 篇`,

    archiveTitle: "归档",
    nothingArchived: "还没有任何归档。",
    otherUpdates: "其余更新",

    emptyTitle: "今日无更新",
    emptyBody: "过去 24 小时里，订阅的几个源都没有发布新文章。明天同一时间再来。",

    tagline: "每天早上把订阅的博客读一遍，提炼成中英双语的观点摘要。",

    /** "2026年8月14日 · 星期五" */
    date: (y: number, m: number, d: number, weekday: number) =>
      `${y}年${m}月${d}日 · 星期${"日一二三四五六"[weekday]}`,
  },

  en: {
    brand: "Daily Takes",
    titleTag: "A daily digest of the blogs worth reading",
    notFoundTitle: "Not found",

    allTab: "All",

    posts: (n: number) => `${n} new ${n === 1 ? "post" : "posts"}`,
    readTime: (n: number) => `about ${n} min to read`,
    sectionCount: (n: number) => `${n}`,
    minutes: (n: number) => `${n} min`,
    minutesToRead: (n: number) => `${n} min at the source`,
    days: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,
    rating: (n: number) => `Rated ${n} out of 5`,

    readFull: "Read the original →",
    share: "Share",
    shareThis: "Share this one",
    copyLink: "Copy link",
    copied: "Link copied",
    saveImage: "Save image",
    shareVia: "Share via…",
    weibo: "Weibo",
    shareHint: "The image carries the whole summary and the link.",
    highlightHint:
      "Want to single out a sentence? Select it above and the saved image will mark it.",
    highlighted: (n: number) =>
      `${n} ${n === 1 ? "character" : "characters"} selected — the image will mark them.`,

    archive: "Past editions",
    archiveSub: "What ran on the days before",
    today: "Back to today",
    todaySub: "The current edition",
    wholeDay: "See the whole day",
    wholeDaySub: (date: string, n: number) => `${date} · ${n} in total`,

    archiveTitle: "Archive",
    nothingArchived: "Nothing archived yet.",
    otherUpdates: "Also today",

    emptyTitle: "Nothing today",
    emptyBody: "No new posts from any source in the last 24 hours. Same time tomorrow.",

    tagline:
      "Every morning, the subscribed blogs read and boiled down to bilingual takes.",

    /** "Friday, 14 August 2026" */
    date: (y: number, m: number, d: number, weekday: number) =>
      `${
        [
          "Sunday", "Monday", "Tuesday", "Wednesday",
          "Thursday", "Friday", "Saturday",
        ][weekday]
      }, ${d} ${
        [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December",
        ][m - 1]
      } ${y}`,
  },
} as const satisfies Record<Lang, unknown>;

export type Strings = (typeof STRINGS)["zh"];

/** The whole dictionary for one language. */
export function strings(lang: Lang): Strings {
  return STRINGS[lang] as Strings;
}
