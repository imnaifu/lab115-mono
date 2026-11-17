import type { Lang } from "../shared/feed.ts";

/**
 * The panel's own words. One language drives both the chrome and the content:
 * the feed is either the Chinese or the English edition, and a Chinese frame
 * around English takes (or the reverse) would be two publications at once.
 */
const STRINGS = {
  zh: {
    count: (n: number) => `${n} 篇`,
    switchTitle: "切换语言 · Language",
    loading: "加载中…",
    stale: "没连上网络，显示的是上次获取的内容",
    error: "暂时连不上 daily.lab115.com",
    retry: "重试",
    empty: "还没有内容",
    endNote: "已经到底了",
    endMore: "更多在",
  },
  en: {
    count: (n: number) => (n === 1 ? "1 pick" : `${n} picks`),
    switchTitle: "Language · 切换语言",
    loading: "Loading…",
    stale: "Offline — showing what was last fetched",
    error: "Can't reach daily.lab115.com right now",
    retry: "Retry",
    empty: "Nothing here yet",
    endNote: "You're all caught up",
    endMore: "more at",
  },
} as const;

export type Strings = (typeof STRINGS)[Lang];

export function strings(lang: Lang): Strings {
  return STRINGS[lang];
}

/** `11月13日 周五` / `Fri, Nov 13` — formatted in UTC so the digest date never shifts a day. */
export function formatDate(date: string, lang: Lang): string {
  const at = new Date(`${date}T00:00:00Z`);
  if (lang === "zh") {
    const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short", timeZone: "UTC" }).format(at);
    return `${at.getUTCMonth() + 1}月${at.getUTCDate()}日 ${weekday}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(at);
}
