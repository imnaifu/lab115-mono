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
 * digest is to put both halves on screen at once: 每日严选 above Daily Picks,
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
    brand: "每日严选",
    notFoundTitle: "未找到",

    allTab: "全部",

    posts: (n: number) => `${n} 篇新文章`,
    readTime: (n: number) => `读完约 ${n} 分钟`,
    sectionCount: (n: number) => `${n} 篇`,
    days: (n: number) => `${n} 天`,
    /**
     * 首页 masthead 上那一行，说的是这一页在展示什么。
     *
     * 和 `days` 分开是因为两者答的不是同一个问题：`days` 是「站上一共几天」，归档页
     * 用它是对的（归档就是全部）；首页只列最近 FRONT_DAYS 天，却用 `days` 报了总数，
     * 于是第 8 天上线那天，标题写着「8 天」而下面只有 7 行。
     */
    recentDays: (n: number) => `最近 ${n} 天`,

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
     * The floating button's label. IT IS NEVER PRINTED — the button is an
     * arrow, and this is its `aria-label` and its tooltip. A word there would
     * be a second thing hovering over the page in a language the reader has to
     * read past to get at the summary underneath.
     */
    backToTop: "回到顶部",

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

    /**
     * 报头上那个明暗开关的可访问名。按钮本身只有一个图标 —— 半黑半白的圆。
     *
     * 说的是这个控件是什么，不是「点下去会变成什么」。开关只有两态，而当前是哪
     * 一态要到浏览器里才知道；服务端渲染出「切换到深色」这种话，在已经是深色的
     * 读者那里第一屏就是错的。
     */
    themeToggle: "深色浅色切换",

    /* The end-of-page link on a day page, back to the front page. It names what
       is actually there — the newest week, with the archive one step further on —
       rather than promising every date, which is the archive's job. */
    allDays: "看其它日期",
    allDaysSub: "最近一周，以及更早的归档",

    /**
     * The breadcrumb: what the trail calls the front page, and what a screen
     * reader calls the trail itself.
     *
     * 「首页」 rather than 「回到首页」 (`backHome`, further down) or the brand: a crumb
     * names a place, not an action, and the brand is already the lockup directly
     * below it — three 「每日严选」 in one header is what naming it here would cost.
     * The STRUCTURED-DATA trail does name the brand, deliberately: a search result
     * reading `每日严选 › 归档` is naming the site, where this one is naming a link
     * whose destination the reader can see for themselves.
     */
    home: "首页",
    breadcrumb: "面包屑导航",

    /**
     * The front page's link to the archive, under the newest few days.
     *
     * NO LONGER COUNTS THE DAYS. It read 「共 N 天，按页浏览」, which spent the one
     * line under the label on a number and a pagination mechanic — the number is
     * the site's inventory rather than a reason to click, and how the archive
     * paginates is something a reader finds out by arriving. What is left says
     * where the link goes.
     *
     * A plain string rather than a function now: nothing here interpolates.
     */
    more: "更多",
    moreSub: "往前翻，看过去的每一天",

    archiveTitle: "归档",
    /* "第 2 页 / 共 4 页" — stated rather than implied, because the two arrows
       below it cannot say where in the run you are. */
    pageOf: (page: number, total: number) => `第 ${page} 页 · 共 ${total} 页`,
    newer: "更近",
    older: "更早",
    /* 「看这一天的全部」以前是这句，「全部」后面没有名词，悬着。这里的目的地是当天
       那一页，副标题写的是「共 15 篇」—— 说成一个名词短语，两行才是同一个口径。 */
    wholeDay: "当天全部文章",
    wholeDaySub: (date: string, n: number) => `${date} · 共 ${n} 篇`,

    nothingYet: "还没有任何内容。",

    /** 开头那张照片的出处，署名行里夹在作者和许可之间。作者名和许可名都是数据，
        只有这个词是文案，所以只有它在这里。 */
    photoSource: "维基共享资源",

    emptyTitle: "今日无更新",
    emptyBody: "过去 24 小时里，订阅的几个源都没有发布新文章。明天再来看看。",

    /**
     * 订阅表单，以及它之后的两种结果页。
     *
     * 这里曾经有 subscribeSub「每天早上一封，五条精选。」和 subscribeNote「每封信里
     * 都有退订链接，随时可以退。」，两句都删了 —— 卡片只剩标题、输入框、按钮。
     *
     * 连带删掉的还有一条提醒：那句「五条」是写死的数字而不是插值，因为它同时是一个
     * 承诺，改 MAIL_TOP_N 就得跟着改。现在站上没有任何一处文案承诺条数，所以那条
     * 提醒也没有对象了 —— MAIL_TOP_N 只对邮件本身负责。
     */
    subscribe: "订阅邮件",
    subscribeEmail: "你的邮箱",
    subscribeGo: "订阅",
    subscribeSending: "正在发送",
    subscribeSent: (email: string) =>
      `确认信已经发到 ${email}，点开里面的链接就完成了。`,
    subscribeError: "没发出去，过一会儿再试一次。",
    subscribeBadEmail: "这个邮箱看起来不太对。",
    subscribeTooMany: "试得太频繁了，五分钟后再来。",

    confirmedTitle: "订阅成功",
    confirmedBody: "明天早上七点，第一封就会到。",
    /** 过期、被改过、邮件客户端截断，对读者是同一件事：这个链接现在没用了。 */
    confirmInvalidTitle: "链接失效了",
    confirmInvalidBody: "确认链接只在 24 小时内有效。回到首页重新订阅一次就好。",
    backHome: "回到首页",

    /** 收件箱那一行：牌子加日期。篇数不写进去 —— 邮件里是五条，当天可能有二十条，
     *  写哪个数字都会骗人。 */
    mailSubject: (date: string) => `每日严选 · ${date}`,
    /** "8月25日"，只给邮件用。页面上的日期带星期，主题行没那个位置。 */
    mailShortDate: (m: number, d: number) => `${m}月${d}日`,
    mailWhy: "你收到这封信，是因为订阅了 daily.lab115.com。",
    mailUnsubscribe: "退订",

    confirmSubject: "确认订阅每日严选",
    confirmMailLead: "点下面这个链接，订阅就生效了。",
    confirmMailButton: "确认订阅",
    confirmMailExpiry: "链接 24 小时内有效。",
    /** 双向确认的另一半：这封信有可能是别人拿你的邮箱填的表单。 */
    confirmMailIgnore: "如果这不是你本人操作，忽略这封信即可，不会有任何后续。",

    /**
     * THE MASTHEAD'S SUBTITLE, and the description on every page, in the manifest
     * and in the feed's `<subtitle>`.
     *
     * IT USED TO BE THE FOOTER'S LINE — the site's one claim about itself, set in
     * 12px grey under a horizontal rule, below everything a reader had already
     * decided not to keep scrolling for. Moving it to the masthead is what makes
     * the wording below worth arguing about at all: it is now the second thing on
     * the page after the wordmark, and on an article page it is the first thing a
     * reader arriving from a shared link learns about where they have landed.
     *
     * NEITHER COPY NAMES A LANGUAGE. It said 中英双语 back when the claim was
     * false in one direction — one summary, in Chinese, rendered the same on
     * `/zh` and `/en` — and the English copy then said "in Chinese" to be honest
     * about it. `summary.en` exists now (see `summaryFor` in take.ts), so an
     * English reader on `/en` gets English, and a line telling them otherwise is
     * false in the other direction. A tagline that has to keep up with which
     * halves are populated is a tagline that will be wrong again; both copies now
     * describe what the site DOES, and the page the reader is on says the rest.
     *
     * IT NAMED NO MACHINERY AT ALL, which was the harder rule and the one this
     * line kept breaking. Three versions in a row described the PROCESS — when the
     * cron fires (每天早上), what it reads (订阅的博客), what it does to it (读一遍、
     * 提炼、收拢) — none of which is a reason for anyone to open the site. A reader
     * does not want a blog reader; they want to know what is being argued this week
     * in fields they have no time to follow.
     *
     * THE CURRENT LINE BENDS THAT RULE ONCE, and the distinction is which side the
     * mechanism is stated from. 过滤 is a thing the site does, but it is named for
     * what the reader is spared rather than for how the pipeline runs: 信息噪音 is
     * the reason someone opens this page instead of the twenty feeds it reads, and
     * the earlier drafts' 每天早上/订阅的博客/提炼 were the machine describing itself.
     * A rewrite that puts fetching, scoring or summarising back on this line has
     * crossed back over — the test is whether the words name what the READER gets
     * out of the deal.
     *
     * SO IT NAMES THREE THINGS: 过滤信息噪音 (what it takes away), 各领域 (how wide
     * it looks), 犀利见解 (what survives the cut).
     *
     * 各领域 is a claim the content supports — the categories in config.json run
     * 技术/商业/投资/经济/科学/设计/生活/人文, so this is not a tech feed wearing a
     * wider label.
     *
     * 专家 IS GONE, and that one costs something. It was the most falsifiable claim
     * this line ever made — it rested on the source list being signed blogs by
     * people who do the work (a cardiologist, a valuation professor, an
     * epidemiologist, engineers writing about their own systems), which made
     * ADDING A WIRE SERVICE OR AN AGGREGATOR a thing that would turn the tagline
     * false, and that was the hardest argument in the README for keeping them out.
     * 犀利见解 still implies argued, signed writing rather than reporting, so the
     * constraint keeps an anchor here — a weaker one. If the source list is ever
     * argued about again, the README's own reasons now have to carry it.
     *
     * 快速 IS GONE TOO: there is no promise here about the reader's time any more.
     * The slot went to what gets kept out instead.
     *
     * 严选 REPEATS THE WORDMARK sitting directly above it — 每日严选. An earlier
     * version of this line dropped 每天 for exactly that reason, so this is the same
     * objection, accepted rather than answered: 严选 is the verb the brand is named
     * for and the one the sentence is about, and saying it twice is the cost of
     * having the name state the method. If the wordmark ever stops saying 严选,
     * this line gets the slot back.
     *
     * It still names no count, on the same principle as the paragraph above: a
     * number in a tagline is a number that goes stale.
     */
    tagline: "过滤信息噪音，严选各领域的犀利见解",

    /** "2026年8月14日 · 星期五" */
    date: (y: number, m: number, d: number, weekday: number) =>
      `${y}年${m}月${d}日 · 星期${"日一二三四五六"[weekday]}`,
  },

  en: {
    brand: "Daily Picks",
    notFoundTitle: "Not found",

    allTab: "All",

    posts: (n: number) => `${n} new ${n === 1 ? "post" : "posts"}`,
    readTime: (n: number) => `about ${n} min to read`,
    sectionCount: (n: number) => `${n}`,
    days: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,
    recentDays: (n: number) =>
      n === 1 ? "the latest day" : `the last ${n} days`,

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

    /**
     * The floating button's label. IT IS NEVER PRINTED — the button is an
     * arrow, and this is its `aria-label` and its tooltip. A word there would
     * be a second thing hovering over the page in a language the reader has to
     * read past to get at the summary underneath.
     */
    backToTop: "Back to top",

    saveApp: "Save as app",
    saveAppTitle: "Save this page as an app",
    installNow: "Install now",
    installManual: "Or add it by hand:",
    installWhy:
      "It gets an icon of its own, opens full screen with no address bar, and the pages you have already opened stay readable with no network.",
    weibo: "Weibo",

    themeToggle: "Switch between light and dark",

    allDays: "Other editions",
    allDaysSub: "The past week, and the archive beyond it",

    home: "Home",
    breadcrumb: "Breadcrumb",

    more: "More",
    moreSub: "Look back through every past day",

    archiveTitle: "Archive",
    pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
    newer: "Newer",
    older: "Older",
    /** A noun phrase, matching the sub line under it — see the Chinese side. */
    wholeDay: "All posts from that day",
    wholeDaySub: (date: string, n: number) => `${date} · ${n} in total`,

    nothingYet: "Nothing published yet.",

    photoSource: "Wikimedia Commons",


    emptyTitle: "Nothing today",
    emptyBody: "No new posts from any source in the last 24 hours. Try again tomorrow.",

    subscribe: "Subscribe by email",
    subscribeEmail: "Your email",
    subscribeGo: "Subscribe",
    subscribeSending: "Sending",
    subscribeSent: (email: string) =>
      `A confirmation is on its way to ${email}. Open it and follow the link.`,
    subscribeError: "That did not send. Try again in a moment.",
    subscribeBadEmail: "That address does not look right.",
    subscribeTooMany: "Too many tries. Give it five minutes.",

    confirmedTitle: "You are subscribed",
    confirmedBody: "The first one arrives tomorrow morning.",
    confirmInvalidTitle: "This link has expired",
    confirmInvalidBody:
      "A confirmation link is good for 24 hours. Subscribe again from the front page and a fresh one will arrive.",
    backHome: "Back to the front page",

    mailSubject: (date: string) => `Daily Picks · ${date}`,
    /** "25 Aug" — the day-first order the English date string uses elsewhere. */
    mailShortDate: (m: number, d: number) =>
      `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`,
    mailWhy: "You are getting this because you subscribed at daily.lab115.com.",
    mailUnsubscribe: "Unsubscribe",

    confirmSubject: "Confirm your subscription",
    confirmMailLead: "Follow this link and you are on the list.",
    confirmMailButton: "Confirm subscription",
    confirmMailExpiry: "The link is good for 24 hours.",
    confirmMailIgnore:
      "If this was not you, ignore this email and nothing happens.",

    /* Written tighter than a literal rendering of the Chinese, and deliberately:
       this string is drawn across the bottom of the 1200px OG card (see lib/og.tsx),
       and CJK carries more meaning per character — the two lines land at similar
       widths only if the English is composed rather than translated. The same
       constraint is why this one leads with the verb: the half a reader sees
       first has to carry the claim.

       IT HAS TO FIT ON ONE LINE IN THE MASTHEAD, which is a length limit rather
       than a style note. The mark there is 44px tall and the wordmark plus one
       line of subtitle fills that exactly, so a second line makes the text block
       outgrow the mark (see the measurements on the `<h1>` in Shell.tsx). THE
       BUDGET IS 264px AT 12px — what a 360px phone leaves after the mark and the
       gutters. The previous line ("Read the latest takes from experts in every
       field, fast.") was written to sit exactly on that floor; this one is
       shorter and has slack, which is room for a future rewrite rather than a
       reason to spend it. Below a 340px viewport it wraps, and that is a trade
       taken deliberately: no phone shipping today is that narrow, and shortening
       the line for the ones that were would cost the claim on every phone that
       is not.

       THE TRAILING PERIOD IS ABSENT ON PURPOSE, matching the Chinese, which
       drops its 句号 — six placements and most of them are an isolated line
       (the OG card, the poster lockup) where a final stop reads as debris. The
       period inside the line is a different thing: it is what makes 「Cut the
       noise」 a sentence rather than a fragment, and it stays. */
    tagline: "Cut the noise. The sharpest takes from every field",

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
