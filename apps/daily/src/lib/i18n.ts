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


    posts: (n: number) => `${n} 篇新文章`,
    /**
     * 日页的标题。「今天的 12 篇」—— 名词短语，不是日期。
     *
     * 日期从标题降成了它上面那行 kicker。一期日报的**名字**是它的日期，这条以前
     * 成立，而现在这一页上方还有首页、话题、归档三个入口，读者是带着「今天有什么」
     * 来的 —— 先回答有多少，再说是哪天。日期没丢，它在 kicker 里，而且带星期。
     *
     * 篇数是插值的，不是写死的。见 `subscribePitch` 那笔旧账。
     */
    dayHeading: (n: number) => `今天的 ${n} 篇`,
    /** 标题下面那一句。它和站点 tagline 不是一回事：tagline 说这个站是什么，这句
     *  说这一页是怎么来的 —— 从哪儿挑的、按什么标准。 */
    dayLead: "从全球优质媒体，精选最值得关注的内容",

    /**
     * 首页那块大图上的标语。
     *
     * 篇数插值的是 `MAIL_TOP_N` —— 也就是**邮件每天发几篇**，不是当天发布了几篇。
     * 这两个数不一样（邮件 5，当天十几），而这句话是站在首页说「订阅这件事能给你
     * 什么」，所以用前者。日页标题 `dayHeading` 用的是后者，那里回答的是另一个问题。
     * 见 `subscribePitch` 里那笔「五条写死」的旧账 —— 这两处都不写死。
     */
    homeHeading: (n: number) => `每天 ${n} 篇，理解更大的世界`,
    /** 大图上那两颗按钮。左边进当天，右边开订阅面板。 */
    homeSeeToday: "查看今日精选",
    homeSubscribe: "订阅更新",
    /** 大图下面那一段的小标题和它右边的去处。 */
    todayPicks: "今日精选",
    seeAll: "查看全部",
    /** 首页只放五条，这是通往当天其余篇目的那一颗。 */
    seeAllToday: (n: number) => `查看今日全部 ${n} 篇`,
    readTime: (n: number) => `读完约 ${n} 分钟`,
    sectionCount: (n: number) => `${n} 篇`,
    days: (n: number) => `${n} 天`,

    /**
     * 「原文」, NOT 「全文」. This link leaves the site for somebody else's article,
     * and 全文 does not say whose — a reader who has just been shown a TL;DR reads
     * it as "the rest of what I am reading", which is the take, which is the OTHER
     * button. The English half has said "Read the original" all along; the Chinese
     * was the odd one out.
     *
     * 「看」 RATHER THAN 「阅读」, and it is the pair that decides this, not the word
     * on its own: this sits beside `readSummary` and the two are read together, so
     * they share a verb and differ only where they actually differ — 原文 against
     * 总结. Two characters each also keeps the secondary button from outweighing
     * the primary one it sits next to.
     */
    readFull: "看原文 →",
    /**
     * The way in to one article's full take, from a list that shows only the
     * headline and the claim.
     *
     * 「总结」 AGAINST 「原文」 — see `readFull` above. Two links a few pixels apart,
     * one leading deeper into this site and one leading off it, have to say which
     * is which in the words themselves, and these two differ in the only place
     * that matters: whose text is on the other end.
     */
    readSummary: "看总结 →",
    /** The front page's one action: on into the day this teaser is from. */
    keepReading: "继续阅读全文 »",
    /**
     * The heading over the run of recent pieces on the front page.
     *
     * PIECES, NOT DAYS. It listed dates until the front page became a teaser for
     * one article — and a column of dates under a headline is a table of contents
     * for a book the reader has not opened. Naming the pieces is what makes the
     * list worth reading: every row is something they can decide about.
     */
    latestPosts: "最新文章",
    /** The way out of that list, into the archive. */
    morePosts: "更多文章……",
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

    /**
     * 报头上那个语言开关的可访问名。按钮只有一个图标 —— 翻译符号 —— 所以这句
     * 话是屏幕阅读器和 hover 提示唯一拿得到的说明。
     *
     * 说的是它通向哪里，不是它现在是什么。开关只剩一个方向了（见 Shell.tsx 里
     * 的 LangSwitch），一个只有一个去处的控件，报出去处最有用。
     *
     * 目标语言用它自己的文字写 ——「切换到 English」而不是「切换到英文版」。一
     * 个不认识中文的读者也认得 English 这个词，而「英文版」三个字对他恰恰是最
     * 需要这个按钮时看不懂的那部分。
     */
    langSwitch: "切换到 English",

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
     * 文章页左上角那个 `← 返回`。
     *
     * 「返回」而不是「返回 2026-09-18」或者「当天全部」：它紧贴在一行
     * 「话题 · 来源 · 日期」的上面，而那一行里的日期本身就是同一个链接 —— 两处说
     * 同一个目的地，说一次就够，另一处说方向。
     *
     * 它替掉了可见的面包屑（首页 › 日期 › 标题）。结构化的那一半没动 —— 文章页
     * JSON-LD 里的 `BreadcrumbList` 照旧，而那是 Google 真正画在搜索结果里的那
     * 一半。
     */
    backToDay: "返回",

    /** 文章页底部那两个方向，只在当天之内走。见文章页的 `previous`/`next`。 */
    prevArticle: "上一篇",
    nextArticle: "下一篇",

    /** 正文之后那张整宽卡片的标题。它下面印的是原文的**本名**（英文标题），所以
     *  这句话只需要说清这是一个出站动作，别的交给标题自己。 */
    readOriginal: "阅读原文",

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

    archiveTitle: "归档",
    /** 归档页自己的标题和那一句。`archiveTitle` 是它在导航和面包屑里的名字，短；
     *  这两句是页面上的，说清它是什么、怎么用。 */
    archiveHeading: "文章归档",
    archiveLead: "按时间浏览所有文章",
    /** 月份网格里的格子，和它下面那个月的小标题。 */
    monthShort: (m: number) => `${m}月`,
    monthTitle: (y: number, m: number) => `${y} 年 ${m} 月`,
    /** 归档行里的日期。「9 月 21 日」—— 年份在上面那个小标题里说过了。 */
    monthDay: (m: number, d: number) => `${m} 月 ${d} 日`,
    /* "第 2 页 / 共 4 页" — stated rather than implied, because the two arrows
       below it cannot say where in the run you are. */
    pageOf: (page: number, total: number) => `第 ${page} 页 · 共 ${total} 页`,
    newer: "更近",
    older: "更早",
    /* 「看这一天的全部」以前是这句，「全部」后面没有名词，悬着。这里的目的地是当天
       那一页，副标题写的是「共 15 篇」—— 说成一个名词短语，两行才是同一个口径。 */
    wholeDay: "当天全部文章",
    wholeDaySub: (date: string, n: number) => `${date} · 共 ${n} 篇`,

    /**
     * 订阅源那一页。
     *
     * `sourcesLead` 是整站唯一一段「我们自己写的、不是摘别人」的说明文字，所以它
     * 存在的理由不只是排版：来源页是给搜索引擎和 AI 看的落地页，而落地页需要一句
     * 只有这个站能说的话。这句说的是收录规则本身 —— 两条方向相反的门槛，README
     * 里那两条 —— 因为「凭什么是这 64 个」正是一个读者点进来会问的问题。
     */
    sourcesTitle: "订阅源",
    sourcesLead:
      "这里是全部订阅源。收进来的标准有两条，方向相反：发得太密的不要 —— feed 只留" +
      "十条而一天更新几十篇，一天抓一次会漏掉九成；发得太疏的也不要，一个月一篇以下" +
      "就不再跟。中间那一段，就是下面这些。",
    sourceCount: (n: number) => `${n} 个来源`,
    /* 「收录过 N 篇」而不是「N 篇文章」：这些不是它写的文章数，是我们摘过的篇数，
       两个数字差得远，说错了就是在替别人报一个假的产量。 */
    sourcePicked: (n: number) => `收录过 ${n} 篇`,
    /** 篇数不够、还没有自己那一页的源。见 sources.ts 的 SOURCE_MIN_ARTICLES。 */
    sourceQuiet: (n: number) => (n === 0 ? "还没有收录" : `收录过 ${n} 篇`),
    sourceTakes: "摘过的文章",
    sourceSite: "访问原站 →",
    sourceBeat: "常写",
    allSources: "看订阅源",
    allSourcesSub: "每天被读一遍的那些博客",

    nothingYet: "还没有任何内容。",

    /**
     * 话题页。见 lib/topics.ts —— 这个站上唯一一组**不随日期过期**的地址。
     *
     * 标题里带「每日精选」而品牌叫「每日严选」，两个词只差一个字，这是知道的：
     * 「精选」说的是这一页里的东西是挑出来的，「严选」是这个站的名字。搜索结果里
     * 两个词一前一后出现，读者看到的是「技术每日精选 · 每日严选」，前半是内容，
     * 后半是出处 —— 这正是来源页 `${source.name} · ${t.brand}` 的同一种排法，而且
     * 主语在前，因为读者搜的是话题，不是这个站的名字。
     *
     * 描述句是**照话题生成**的，不是每个话题手写一遍：手写八句必然有几句是凑的，
     * 而凑出来的描述句正是「为 SEO 造页面」的样子。一句模板 + 话题名，说的是这一页
     * 真正提供的三样东西：中文摘要、核心观点、原文链接。
     */
    /**
     * 话题总入口 `/topic`。
     *
     * 「探索话题」而不是「全部话题」：这一页每一行都带一句这个栏目是什么、以及最近
     * 两篇，它是给第一次来的人看的地图，不是一张目录。「全部」承诺的是完整性，
     * 而这里连没过门槛的话题都不列。
     *
     * 文档标题里把**实际在线的话题名字念一遍**，不是写一句「浏览我们的话题分类」。
     * 这个 URL 在搜索结果里要跟全互联网所有「话题页」抢，唯一让人愿意点的是后面到底
     * 有哪些领域；而且它是从真实过线的话题生成的，站长大了也不会写成假话。
     */
    topicHubTitle: "话题分类",
    /**
     * 话题总览页标题下面那一句。
     *
     * 它和 `topicHubLead` 不是一回事，而这是全站唯一一处「页面上写的」和
     * `<meta name="description">` 不同的地方。原因是两句话对着不同的人说：页面上
     * 这一句是给已经在站里、正在找方向的读者，可以短、可以有腔调；description 是
     * 给一条还没点进来的搜索结果，它必须说清这一页到底有什么。后者是前者的超集，
     * 没有一句在骗人。
     */
    topicHubSub: "从不同角度，发现更大的世界",
    /** 顶栏那两个导航项。「今天」= `/`，「话题」= `/topic`。见 SiteHeader。 */
    navToday: "今天",
    navTopics: "话题",
    navArchive: "归档",
    navAbout: "关于",
    /** 手机上那个抽屉的开关，和它自己的可访问名。 */
    menuOpen: "菜单",
    menuClose: "关闭菜单",

    /**
     * 关于页。
     *
     * 全站第二段「我们自己写的、不是摘别人」的文字（第一段是 `sourcesLead`，而
     * 那一节现在是关着的）。所以它存在的理由不只是补全导航：一个每天发布二十份
     * 他人文章摘要的站，必须有一页说清**这些摘要是谁写的、按什么标准挑的**，否则
     * 从搜索进来的读者看到的就是一个没有主语的聚合器。
     *
     * 邮箱是明文写的，不做任何混淆。混淆能挡住的爬虫早就不存在了，而它挡得住的
     * 是想联系的人 —— 那正好是这一页唯一想要的结果。
     */
    aboutTitle: "关于每日严选",
    aboutLead: "更好的信息，更大的世界",
    aboutBody: [
      "每日严选是 Lab115 的一个内部项目。每天早上从全球几十个优质信息源里抓取过去 24 小时的文章，逐篇打分，为过线的每一篇写一份中文和英文的概要。",
      "它想解决的不是「信息太少」，而是「信息太多而值得读的太少」。所以这个站做的第一件事是**扔掉**：绝大多数抓进来的文章不会出现在页面上。",
      "每一页都是**我们为别人的文章写的概要**，不是原文，也不是转载。每篇文章页都链回原文，并在结构化数据里声明原文的作者与出版方。",
    ],
    /** 关于页那三根柱子。每根一个词加一句解释。 */
    aboutPillars: [
      ["精选优质内容", "来自国际主流媒体与独立作者"],
      ["保持客观中立", "不生产观点，只做筛选和转述"],
      ["关注长期价值", "不追热点，也不做标题党"],
    ],
    aboutContact: "联系我们",
    topicHubDocTitle: (names: readonly string[]) =>
      `探索话题：${names.join("、")}等每日精选`,
    topicHubLead:
      "这个站每天从全球优质信息源里挑出值得一读的文章，按领域收在下面这几个话题里。" +
      "每个话题都是一条会一直长下去的流，点进去是我们在那个领域摘过的全部文章。",
    /** 话题卡片里那两条最近的文章上面的小标签。 */
    topicRecent: "最近更新",
    /** 首页那一行 chips 的标题，以及末尾通往 `/topic` 的那一颗。 */
    topicExplore: "探索话题",
    topicMore: "更多",

    topicHeading: (name: string) => `${name}每日精选`,
    topicDocTitle: (name: string) => `${name}每日精选：观点、摘要与原文`,
    topicLead: (name: string) =>
      `每天从全球优质信息源中筛选${name}领域值得一读的文章，` +
      `提供中文摘要、核心观点和原文链接。`,
    /* 「收录过 N 篇」，和来源页同一个口径，理由也同一个：这不是这个话题下全世界
       发了多少篇，是我们摘过多少篇。 */
    topicPicked: (n: number) => `收录过 ${n} 篇`,
    /** 话题页底部那一行兄弟话题。 */
    topicOthers: "其它话题",
    /** 话题页上那两个排序。「最热」按打分排 —— 那是这个站自己给每篇打的分，不是
     *  阅读量，站上没有任何按篇计数的东西。 */
    topicSortLatest: "最新",
    topicSortHot: "最热",
    /** 话题页报头里的篇数。和卡片上的 `topicPicked` 说的是同一个数，措辞不同：那里
     *  要和来源页对齐口径（收录过 N 篇），这里是这一页自己的规模。 */
    topicArticles: (n: number) => `${n} 篇文章`,
    /** 文章页报头里那个话题链接前面的词。见文章页的 meta 行。 */
    topicLabel: "话题",

    /**
     * 文章正文下面那一块。
     *
     * 「你可能还想读」而不是「相关文章」：后者是一个栏目名，前者是一句话，说的是
     * 这几篇为什么在这儿。见 lib/related.ts —— 挑选规则是可解释的，文案也就该按
     * 「给你的建议」来写，而不是按「系统生成的板块」。
     */
    related: "你可能还想读",

    /**
     * 「为什么值得关注」—— 概要**末尾**那一块的小标题，全站唯一一个还留着的字段标签。
     *
     * 其余的都删了。`TL;DR`（中文一度定成「划重点」）从五个位置消失了：文章页的
     * 导语、日页卡片、首页 teaser、海报、feed。理由是 label 在那些位置什么也没
     * 说 —— 读者不需要知道这个字段叫什么，而「TL;DR / 摘要 / 一句话看懂」这类词
     * 占掉的正是导语第一行的位置。thesis 现在直接做标题下面的 dek，靠字号和颜色
     * 说明自己是什么，这是出版物的做法；挂个标签是 AI 产品的做法。
     *
     * 这一个**必须留**，而且是同一条理由的另一面：它下面那句话不是文章的复述，是
     * 我们的判断。读者需要被告知这一点，否则它读起来就是第三遍摘要。label 在这里
     * 是有信息的，在导语上没有。
     */
    whyItMatters: "为什么值得关注",

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
    /**
     * 订阅这件事的**价值主张**，换掉表单里那一句站点 tagline。
     *
     * 篇数是插值进来的，不是写死的 —— 上面那段注释记了一笔旧账：这里曾经有一句
     * 「每天早上一封，五条精选」，而「五条」是写死的，改 `MAIL_TOP_N` 就得记得回来
     * 改文案。于是整句被删掉，站上从此不承诺任何条数。现在承诺回来了，但数字由
     * `MAIL_TOP_N` 自己给（见 `SubscribeDialog` 的调用处），所以那笔旧账不会重演。
     *
     * 为什么值得把 tagline 换掉：tagline 说的是这个**站**是什么，而这里要回答的是
     * 「我为什么要把邮箱给你」。同一句话干不了两件事 —— 表单里放站点简介，等于在
     * 转化的那一步什么都没多说。
     */
    subscribePitch: (n: number) => `每天 ${n} 篇真正值得读的文章`,
    subscribePitchSub:
      "从全球优质信息源中筛选，几分钟了解当天最值得关注的观点。",
    /**
     * 按钮上的字。「订阅」说的是读者要做的动作，这句说的是读者会**得到**什么 ——
     * 一个免费邮件列表的提交按钮，说后者转化更高，而且它把「每天」这个频率又说了
     * 一遍，正好是读者在按下去之前最后一个犹豫的点。
     *
     * `subscribeGo`（「订阅」）没有删：顶栏那颗药丸按钮只有 44px 的余量，放不下
     * 这五个字，而且那里是**入口**不是**提交**——入口说动作，提交说结果。
     */
    subscribeCta: "每天发给我",
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


    posts: (n: number) => `${n} new ${n === 1 ? "post" : "posts"}`,
    /* See the Chinese side: a noun phrase rather than the date, with the date
       demoted to the kicker above it. */
    dayHeading: (n: number) => `Today's ${n}`,
    dayLead: "Picked from the best of the world's press",

    /* The count is MAIL_TOP_N — what the mail sends, not what the day holds.
       See the Chinese note for why the two numbers are different questions. */
    homeHeading: (n: number) => `${n} pieces a day, a bigger picture`,
    homeSeeToday: "Today's picks",
    homeSubscribe: "Subscribe",
    todayPicks: "Today's picks",
    seeAll: "See all",
    seeAllToday: (n: number) => `All ${n} from today`,
    readTime: (n: number) => `about ${n} min to read`,
    sectionCount: (n: number) => `${n}`,
    days: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,
    readFull: "Read the original →",
    readSummary: "Read the summary →",
    keepReading: "Keep reading »",
    latestPosts: "Latest posts",
    morePosts: "More posts…",
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

    /* The other direction of the same control — see the note on the Chinese
       side. 中文 rather than "Chinese", for the same reason. */
    langSwitch: "Switch to 中文",

    allDays: "Other editions",
    allDaysSub: "The past week, and the archive beyond it",

    home: "Home",
    breadcrumb: "Breadcrumb",

    /* See the Chinese side — the destination is named by the date beside it, so
       this word only has to say which direction. */
    backToDay: "Back",
    prevArticle: "Previous",
    nextArticle: "Next",
    readOriginal: "Read the original",

    more: "More",

    archiveTitle: "Archive",
    archiveHeading: "Archive",
    archiveLead: "Every edition, by month",
    monthShort: (m: number) =>
      ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1],
    monthTitle: (y: number, m: number) =>
      `${["January","February","March","April","May","June","July","August","September","October","November","December"][m - 1]} ${y}`,
    monthDay: (m: number, d: number) =>
      `${d} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1]}`,
    pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
    newer: "Newer",
    older: "Older",
    /** A noun phrase, matching the sub line under it — see the Chinese side. */
    wholeDay: "All posts from that day",
    wholeDaySub: (date: string, n: number) => `${date} · ${n} in total`,

    /** See the Chinese side for why `sourcesLead` is written rather than
     *  borrowed — it is the one paragraph on this site that is ours. */
    sourcesTitle: "Sources",
    sourcesLead:
      "Every blog this site subscribes to. Two rules decide what gets in, and " +
      "they pull in opposite directions: nothing that publishes too fast — a " +
      "ten-item feed against forty posts a day means one daily fetch misses " +
      "most of them — and nothing that publishes less than once a month. What " +
      "is left is the list below.",
    sourceCount: (n: number) => `${n} ${n === 1 ? "source" : "sources"}`,
    /** Takes we have written, NOT the blog's own output. See the Chinese note. */
    sourcePicked: (n: number) => `${n} picked`,
    sourceQuiet: (n: number) => (n === 0 ? "none picked yet" : `${n} picked`),
    sourceTakes: "What we picked",
    sourceSite: "Visit the site →",
    sourceBeat: "Usually",
    allSources: "The sources",
    allSourcesSub: "The blogs that get read every morning",

    nothingYet: "Nothing published yet.",

    /* See the Chinese side for why the subject leads and why the lead sentence
       is generated from the topic rather than written eight times. */
    /* See the Chinese side. "Explore" rather than "All": the page leaves out
       every topic below the threshold, so it does not promise completeness. */
    topicHubTitle: "Topics",
    topicHubSub: "The same world, from a few different angles",
    navToday: "Today",
    navTopics: "Topics",
    navArchive: "Archive",
    navAbout: "About",
    menuOpen: "Menu",
    menuClose: "Close menu",

    /* See the Chinese side — this is the second piece of prose on this site that
       is ours rather than borrowed, and a site that publishes twenty summaries of
       other people's writing a day owes a page saying who wrote them. */
    aboutTitle: "About Daily Picks",
    aboutLead: "Better information, a bigger picture",
    aboutBody: [
      "Daily Picks is an internal project at Lab115. Every morning it fetches the last 24 hours from several dozen high-quality sources, scores each piece, and writes a Chinese and an English summary of everything that clears the bar.",
      "The problem it is built for is not that there is too little to read. It is that there is far too much and very little of it is worth the time. So the first thing this site does is **throw work away**: most of what gets fetched never reaches a page.",
      "Every page here is **our summary of somebody else's article** — not the original, and not a reprint. Each one links back to the source and names its author and publisher in the page's structured data.",
    ],
    aboutPillars: [
      ["Picked, not aggregated", "From the international press and independent writers"],
      ["Summarised, not editorialised", "We select and restate; the opinions are the authors'"],
      ["Built to keep", "No chasing the news cycle, no headlines that oversell"],
    ],
    aboutContact: "Get in touch",
    topicHubDocTitle: (names: readonly string[]) =>
      `Explore topics: ${names.join(", ")} and more, picked daily`,
    topicHubLead:
      "Every day this site picks the writing worth reading from high-quality " +
      "sources and files it under the topics below. Each one is a stream that " +
      "keeps growing — open it for everything we have picked in that field.",
    topicRecent: "Latest",
    topicExplore: "Explore topics",
    topicMore: "More",

    topicHeading: (name: string) => `${name}, picked daily`,
    topicDocTitle: (name: string) =>
      `${name}, picked daily: summaries, takes and sources`,
    topicLead: (name: string) =>
      `Every day, the ${name} writing worth reading — picked from high-quality ` +
      `sources, with a concise summary, the claim it makes, and a link to the ` +
      `original.`,
    topicPicked: (n: number) => `${n} picked`,
    topicOthers: "Other topics",
    topicSortLatest: "Latest",
    topicSortHot: "Top",
    topicArticles: (n: number) => `${n} ${n === 1 ? "piece" : "pieces"}`,
    topicLabel: "Topic",

    related: "You might also read",

    whyItMatters: "Why it matters",

    photoSource: "Wikimedia Commons",


    emptyTitle: "Nothing today",
    emptyBody: "No new posts from any source in the last 24 hours. Try again tomorrow.",

    subscribe: "Subscribe by email",
    subscribeEmail: "Your email",
    subscribeGo: "Subscribe",
    /* The count is interpolated, not written in — see the Chinese note for the
       old bug that rule exists to prevent. */
    subscribePitch: (n: number) => `${n} articles worth reading every day`,
    subscribePitchSub:
      "Curated from high-quality sources, with concise summaries and key takeaways.",
    subscribeCta: "Send me the daily picks",
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
