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
    notFoundTitle: "未找到",

    allTab: "全部",

    posts: (n: number) => `${n} 篇新文章`,
    readTime: (n: number) => `读完约 ${n} 分钟`,
    sectionCount: (n: number) => `${n} 篇`,
    days: (n: number) => `${n} 天`,

    readFull: "阅读全文 →",
    share: "分享",
    /** The share button while it waits for the posters — see ShareButton. */
    preparing: "正在生成图片",
    copyLink: "复制链接",
    copied: "已复制链接",
    saveImage: "保存图片",
    /** Every image at once, when a share has more than one. */
    saveAll: "保存所有图片",
    /** Only shown on a touch screen, where a long press is the gesture. */
    pressToSave: "长按任一张图可以存到相册",
    /** The sheet's own heading, so it repeats the button that opened it. */
    shareTo: "分享到",
    close: "关闭",
    moreApps: "更多",

    /**
     * The masthead's install control, and the sheet it opens.
     *
     * 「App」 IS THE CHINESE WORD, not the English one leaking in — nobody says
     * 「应用程序」 about a home-screen icon, and 「存成应用」 reads like a file
     * dialog. Same exemption as a product name: the one-language rule at the top
     * of this file is about not saying the same thing twice in two scripts, and
     * this says it once.
     *
     * The steps themselves are NOT here — they are the platform branch table in
     * lib/install.ts, next to the detection that chooses between them. See the
     * note there for why splitting the two would be worse.
     */
    saveApp: "存成 App",
    saveAppTitle: "把这个页面存成 App",
    /** The one-tap install, on the browsers that offer one. */
    installNow: "现在安装",
    /** Above the steps, and ONLY when the button above them exists. */
    installManual: "或者手动添加：",
    installWhy:
      "装好之后是桌面上一个独立图标，打开就是全屏、没有地址栏，看过的页面离线也还能读。",
    /** A platform name, so it takes the name that platform uses here. */
    weibo: "微博",

    archive: "往期回顾",
    archiveSub: "看看前几天读到了什么",
    today: "回到今日",
    todaySub: "看今天这一期",
    wholeDay: "看这一天的全部",
    wholeDaySub: (date: string, n: number) => `${date} · 共 ${n} 篇`,

    archiveTitle: "归档",
    nothingArchived: "还没有任何归档。",
    otherUpdates: "其余更新",

    /* The front page's two section headings. It lists today's headlines and then
       the days before them, and those are the only two things on it. */
    todayHeading: "今日",
    recentHeading: "最近",

    emptyTitle: "今日无更新",
    emptyBody: "过去 24 小时里，订阅的几个源都没有发布新文章。明天同一时间再来。",

    /**
     * The footer's line, and the description on every page, in the manifest and
     * in the feed's `<subtitle>`.
     *
     * NEITHER COPY NAMES A LANGUAGE. It said 中英双语 back when the claim was
     * false in one direction — one summary, in Chinese, rendered the same on
     * `/zh` and `/en` — and the English copy then said "in Chinese" to be honest
     * about it. `summary.en` exists now (see `summaryFor` in take.ts), so an
     * English reader on `/en` gets English, and a line telling them otherwise is
     * false in the other direction. A tagline that has to keep up with which
     * halves are populated is a tagline that will be wrong again; both copies now
     * describe what the site DOES, and the page the reader is on says the rest.
     */
    tagline: "每天早上把订阅的博客读一遍，提炼成观点摘要。",

    /** "2026年8月14日 · 星期五" */
    date: (y: number, m: number, d: number, weekday: number) =>
      `${y}年${m}月${d}日 · 星期${"日一二三四五六"[weekday]}`,
  },

  en: {
    brand: "Daily Takes",
    notFoundTitle: "Not found",

    allTab: "All",

    posts: (n: number) => `${n} new ${n === 1 ? "post" : "posts"}`,
    readTime: (n: number) => `about ${n} min to read`,
    sectionCount: (n: number) => `${n}`,
    days: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,

    readFull: "Read the original →",
    share: "Share",
    preparing: "Preparing images",
    copyLink: "Copy link",
    copied: "Link copied",
    saveImage: "Save image",
    saveAll: "Save all images",
    pressToSave: "Press and hold either image to save it to your photos",
    shareTo: "Share to",
    close: "Close",
    moreApps: "More",

    saveApp: "Save as app",
    saveAppTitle: "Save this page as an app",
    installNow: "Install now",
    installManual: "Or add it by hand:",
    installWhy:
      "It gets an icon of its own, opens full screen with no address bar, and the pages you have already opened stay readable with no network.",
    weibo: "Weibo",

    archive: "Past editions",
    archiveSub: "What ran on the days before",
    today: "Back to today",
    todaySub: "The current edition",
    wholeDay: "See the whole day",
    wholeDaySub: (date: string, n: number) => `${date} · ${n} in total`,

    archiveTitle: "Archive",
    nothingArchived: "Nothing archived yet.",
    otherUpdates: "Also today",

    todayHeading: "Today",
    recentHeading: "Recently",

    emptyTitle: "Nothing today",
    emptyBody: "No new posts from any source in the last 24 hours. Same time tomorrow.",

    tagline:
      "Every morning, the subscribed blogs read and boiled down to takes.",

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
