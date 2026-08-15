import type { Lang } from "./lang";

/**
 * Every string the interface says, in both languages.
 *
 * Functions rather than templates with placeholders: interpolation, plurals and
 * word order all come free, and TypeScript checks the arguments at each call
 * site. "3 posts" vs "3 篇新文章" is not a substitution — the two languages put
 * the number in a different relationship to the noun.
 *
 * The BRAND is deliberately absent. 每日干货 / Daily Takes is a lockup, not a
 * translation pair; flipping it per language would make the site look like two
 * different publications rather than one bilingual one.
 */
const STRINGS = {
  zh: {
    posts: (n: number) => `${n} 篇新文章`,
    readTime: (n: number) => `读完约 ${n} 分钟`,
    sectionCount: (n: number) => `${n} 篇`,
    minutes: (n: number) => `${n} 分钟`,
    minutesToRead: (n: number) => `${n} 分钟读完原文`,
    days: (n: number) => `${n} 天`,

    readFull: "阅读全文 →",
    share: "分享",
    shareThis: "分享这一篇",
    copyLink: "复制链接",
    copied: "已复制链接",
    saveImage: "保存图片",
    shareHint: "图片里带完整摘要和链接，可以直接发出去。",

    archive: "往期回顾",
    archiveSub: "Archive · 看看前几天读到了什么",
    today: "回到今日",
    todaySub: "Today · 看今天这一期",
    wholeDay: "看这一天的全部",
    wholeDaySub: (date: string, n: number) => `${date} · 共 ${n} 篇`,

    archiveTitle: "归档",
    nothingArchived: "还没有任何归档 · Nothing archived yet.",
    otherUpdates: "其余更新",

    emptyTitle: "今日无更新",
    emptyBody: "过去 24 小时里，订阅的几个源都没有发布新文章。明天同一时间再来。",

    tagline: "每天早上把订阅的博客读一遍，提炼成中英双语的观点摘要。",

    /** "2026年8月14日 · 星期五" */
    date: (y: number, m: number, d: number, weekday: number) =>
      `${y}年${m}月${d}日 · 星期${"日一二三四五六"[weekday]}`,
  },

  en: {
    posts: (n: number) => `${n} new ${n === 1 ? "post" : "posts"}`,
    readTime: (n: number) => `about ${n} min to read`,
    sectionCount: (n: number) => `${n}`,
    minutes: (n: number) => `${n} min`,
    minutesToRead: (n: number) => `${n} min at the source`,
    days: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,

    readFull: "Read the original →",
    share: "Share",
    shareThis: "Share this one",
    copyLink: "Copy link",
    copied: "Link copied",
    saveImage: "Save image",
    shareHint: "The image carries the whole summary and the link.",

    archive: "Past editions",
    archiveSub: "归档 · What ran on the days before",
    today: "Back to today",
    todaySub: "今日 · The current edition",
    wholeDay: "See the whole day",
    wholeDaySub: (date: string, n: number) => `${date} · ${n} in total`,

    archiveTitle: "Archive",
    nothingArchived: "Nothing archived yet · 还没有任何归档",
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
