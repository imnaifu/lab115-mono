# Every word on rednote.lab115.com, one dict per language; build.py turns them
# into pages. Feature claims follow DESC*.md and were checked against src/.
# The privacy policy is the URL given to the Chrome Web Store: when the
# extension's permissions, storage or network behaviour change, update every
# language's "privacy" block (English is the authoritative version).

STORE = "https://chromewebstore.google.com/detail/rednote-exporter/peadpgjojnooldamfigkfbdiahhffjlm"

# Menu order. `img` is the prefix of the preview/og images in public/img and the
# folder name under branding/v2/out the images are cut from (`shots`).
LANGS = ["en", "zh", "zh-tw", "ko", "ja", "vi"]

S = {}

# --------------------------------------------------------------------- English
S["en"] = {
    "path": "/", "hreflang": "en", "og_locale": "en_US", "label": "English", "shots": "en",
    "head_comment": "English home page (/), the site's default language.",
    "title": "RedNote Exporter - Xiaohongshu Image &amp; Video Downloader, Export Notes to CSV",
    "description": "Free Chrome extension: download every image and video from a RedNote (Xiaohongshu) post in one click — watermark-free video when available — and export the home feed, search results or a profile to CSV. No login, and your notes never leave your browser.",
    "og_site_name": "RedNote Exporter",
    "og_title": "RedNote Exporter - Save RedNote images &amp; videos, export notes to CSV",
    "og_description": "Download a RedNote post's images and video in one click, and export note lists to CSV. Free, no login, processed in your browser.",
    "app_name": "RedNote Exporter", "app_alt": "小红书导出工具",
    "app_description": "Download every image and video from a RedNote (Xiaohongshu) post in one click, and export the home feed, search results or a profile's notes to CSV.",
    "brand": "RedNote Exporter", "nav_label": "Page", "lang_label": "Language",
    "nav": [("#features", "Features"), ("#preview", "Preview"), ("#how", "How it works"), ("#faq", "FAQ")],
    "add": "Add to Chrome",
    "hero_title": "RedNote, saved in <mark>one&nbsp;click</mark>",
    "hero_sub": "Download a post's images &amp; video · Export note lists to CSV<br>Free · No sign-up · Notes never leave your browser",
    "hero_how": "See how it works",
    "hero_tags": ["#Watermark-free video", "#Live Photos", "#Search", "#Profiles", "#CSV export"],
    "feat_h": "What it does",
    "feats": [
        ("post", "fill-sky", "Download a whole post", "Tick the images, video and text you want — Live Photos keep their motion clip, and video is the watermark-free original when available."),
        ("folder", "fill-yellow", "One folder per post", "Named after the time and post title, files numbered in order, nothing overwritten."),
        ("list", "fill-mint", "Capture as you scroll", "Home feed, search, a profile or your Collections — every note you pass is collected and de-duplicated."),
        ("csv", "fill-lilac", "Export to CSV", "Opens in Excel, Numbers or Google Sheets with titles, authors and engagement data."),
    ],
    "pv_h": "See it in action", "pv_label": "Screens",
    "pv": [
        ("post", "Single post", "The Download Single Post tab listing a post's video and all of its images, each with a checkbox",
         "Every image &amp; video, saved in <mark>one&nbsp;click</mark>", "Open any RedNote post, tick what you want, and download it all into a single folder.",
         ["Watermark-free original video when available", "Live Photos and the post text (note.txt) too", "Pick only the files you need"]),
        ("folder", "Auto-organized", "A Downloads folder named after the time and post title, holding video-1.mp4 and image-1 to image-9",
         "One post, <mark>one&nbsp;tidy</mark> folder", "Each download goes into a folder named after the time and the post title, with files numbered in order.",
         ["Folder named by time + post title", "Files numbered image-1, image-2…", "Never overwrites existing files"]),
        ("list", "Note list", "The Export Note List tab: 128 notes captured, each with title, author, like, collect and comment counts and a date",
         "Scroll as usual, export <mark>anytime</mark>", "Browse the home feed, search results or a profile — every note you scroll past is captured and de-duplicated.",
         ["Home feed · Search · Profiles · Collections", "Auto de-dup with a live count", "Titles, authors and engagement data"]),
        ("csv", "CSV", "The exported CSV open in a spreadsheet, with Title, Author Name, Publish Time, Like Count and Collect Count columns",
         "A clean spreadsheet, <mark>ready</mark> to analyze", "Opens straight in Excel, Numbers or Google Sheets — handy for content research and competitor tracking.",
         ["Title, author, publish date", "Likes · collects · comments · shares", "Cover, profile and all image links"]),
    ],
    "how_h": "Three steps",
    "steps": [
        ("browser", "fill-sky", "Open RedNote", "The home feed, search results, a profile, your Collections, or any post."),
        ("click", "fill-pink", "Click the icon", "Choose Export Note List or Download Single Post. On a list, keep scrolling to collect more notes."),
        ("saved", "fill-mint", "Export or download", "Click Export CSV for the spreadsheet, or tick images and video and download them. Clear starts over."),
    ],
    "priv_h": "Your notes stay with you",
    "privs": [
        ("lock", "fill-yellow", "No account", "The extension has no sign-up and never reads your RedNote account details."),
        ("cloudoff", "fill-sky", "Nothing you save is uploaded", "Notes, images and videos never pass through our servers. We only receive anonymous usage counts, and you can turn those off."),
        ("shield", "fill-mint", "Public content only", "It only reads notes already visible on the RedNote page you are browsing."),
    ],
    "priv_more": "Read the full privacy policy",
    "faq_h": "Questions",
    "faqs": [
        ("Is it free?", "Yes. There are no paid features and no account to create."),
        ("Are the videos always watermark-free?", "The extension downloads the watermark-free original whenever it is available. For the occasional post where it isn't, it falls back to the regular video stream, which may carry a watermark."),
        ("Why are some CSV columns empty?", "Only search results return the full collect, comment and share counts and the publish time; the home feed and profile pages return the like count only. Columns RedNote didn't return are left empty rather than filled with 0, so a blank cell means “not provided”, not a count of zero."),
        ("Where are the captured notes kept?", "Only in the current tab. Closing the tab or clicking Clear discards them. Exported CSVs and downloaded files go to your own Downloads folder and are never uploaded anywhere."),
        ("Which sites and browsers are supported?", "Both xiaohongshu.com and rednote.com. It is built for Chrome; Chromium-based browsers such as Edge and Brave can usually install it from the Chrome Web Store too."),
    ],
    "close_h": "Give it a try", "close_p": "Once installed, open any RedNote post and click the extension icon.",
    "foot_desc": "A free Chrome extension that saves RedNote images and videos and exports note lists to CSV.",
    "foot_product": ("Product", ["Features", "Preview", "How it works"]),
    "foot_help": ("Help", ["FAQ", "Privacy policy", "help@lab115.com"]),
    "foot_more": ("More", "https://lab115.com", "Made by LAB115"),
    "disclaimer": "RedNote Exporter is not affiliated with, endorsed by or authorized by RedNote (Xiaohongshu). It only handles publicly visible content and is intended for personal and research use.",
    "notfound": "Page not found", "back": "Back to home",
    "privacy_title": "Privacy Policy - RedNote Exporter",
    "privacy_description": "RedNote Exporter keeps your notes, images and videos in your browser. It only sends anonymous usage counts, which you can turn off.",
    "privacy": """<h1>Privacy Policy</h1>
      <p class="updated">For the Chrome extension “RedNote Exporter” · Last updated: November 13, 2026</p>

      <div class="summary">
        <p><strong>In short:</strong> the notes, images and videos you capture or download never leave your browser. The extension sends anonymous usage counts (which features are used, and how often) to our own statistics server so we know what to improve. They never include note content, links or your account, and you can turn them off in the extension’s ⋯ menu.</p>
      </div>

      <h2>What the extension reads</h2>
      <p>The extension runs only on xiaohongshu.com and rednote.com pages, and only reads the note data those pages load themselves:</p>
      <ul>
        <li><strong>Note lists</strong> — notes loaded by the home feed, search results, profile pages and Collections tabs: title, author, publish time, engagement counts (likes, collects, comments, shares), cover and image links.</li>
        <li><strong>A single post</strong> — the image, Live Photo and video links, text, topics, IP location and engagement counts of the post you have open, so they can be downloaded or saved as a text file.</li>
      </ul>
      <p>All of this is content already publicly visible on the page. The extension does not read your RedNote account details, messages, cookies or passwords, and it never sends requests of its own to RedNote — it only reads data the page has already received while you browse.</p>

      <h2>Anonymous usage statistics</h2>
      <p>To learn which features people actually use, the extension reports a few anonymous events to our self-hosted statistics server (Umami, at stats.lab115.com):</p>
      <ul>
        <li><strong>When:</strong> the extension is installed or updated, and when you open its popup, switch tabs, export a note list, download a post, clear the list, open the original post or change the interface language.</li>
        <li><strong>What an event contains:</strong> the kind of page you are on (home feed, search, profile, a post or other) and whether it is xiaohongshu.com or rednote.com; counts such as how many notes were exported, or how many images, videos, Live Photos and text files were downloaded and how many failed to start; whether a video was the watermark-free original; the interface and browser language; the extension version; and a random install ID created when the extension is installed, used to count users and see whether they come back.</li>
        <li><strong>What it never contains:</strong> note IDs, links, titles or text, author names, search words, file names, your RedNote account, cookies, or anything about other websites you visit.</li>
        <li><strong>Network details:</strong> like any web request, a report reaches the server with your IP address and browser user agent. The server uses them to work out the approximate country and the browser and operating system, and does not store the IP address.</li>
        <li><strong>Turning it off:</strong> click ⋯ in the extension’s popup and switch off “Anonymous usage stats”. From then on nothing is sent.</li>
      </ul>
      <p>The statistics stay on our own server, are used only to improve the extension, and are never sold or shared.</p>

      <h2>When you uninstall</h2>
      <p>After the extension is removed, Chrome opens a short page on this website asking why. Its address carries the extension version and, if usage statistics were on, the install ID, so an answer can be matched to the features that install used. Answering is optional.</p>

      <h2>This website</h2>
      <p>rednote.lab115.com counts visits with the same self-hosted Umami: pages viewed, the referring site, approximate country, browser and device type, and clicks on the “Add to Chrome” buttons. It sets no cookies and uses no third-party analytics.</p>

      <h2>Where data is kept</h2>
      <ul>
        <li>Captured notes live only in the memory of the current tab. Closing or reloading the tab, or clicking Clear, discards them.</li>
        <li>When you click Export CSV or Download, your browser saves the files straight to your Downloads folder. Images and video are fetched by your browser directly from RedNote's media servers, never through us.</li>
        <li>The extension keeps three small things locally: the interface language you picked from its language menu, whether usage statistics are on, and the random install ID.</li>
      </ul>

      <h2>What we don't do</h2>
      <ul>
        <li>We never send the notes, images, videos or text you capture or download to our servers or anyone else.</li>
        <li>We do not use third-party analytics, advertising or tracking tools.</li>
        <li>We do not sell, rent or share any data.</li>
        <li>We do not collect anything in the background. The extension only handles a RedNote page while you are browsing it.</li>
      </ul>

      <h2>Permissions</h2>
      <ul>
        <li><code>downloads</code> — saves the images and video you select to your Downloads folder, grouped into one sub-folder named after the time and post title.</li>
        <li><code>storage</code> — remembers the usage-statistics setting and the install ID.</li>
        <li><strong>Access to xiaohongshu.com and rednote.com</strong> (including the edith and so subdomains) — lets the extension run on those pages and read the note data they load. It does not run on any other site.</li>
      </ul>

      <h2>Content you download</h2>
      <p>Content downloaded or exported with this extension remains the property of its original authors. Please use it for personal and research purposes only, and follow RedNote's terms of service and applicable law. RedNote Exporter is not affiliated with, endorsed by or authorized by RedNote (Xiaohongshu).</p>

      <h2>Changes to this policy</h2>
      <p>If the way the extension handles data ever changes, we will update this page and the date above.</p>

      <h2>Contact</h2>
      <p>Questions about privacy? Email <a href="mailto:help@lab115.com">help@lab115.com</a>.</p>""",
}

# ------------------------------------------------------------ Simplified Chinese
S["zh"] = {
    "path": "/zh/", "hreflang": "zh-CN", "og_locale": "zh_CN", "label": "简体中文", "shots": "zh",
    "head_comment": "简体中文主页（/zh/）。",
    "title": "小红书导出工具 - 图片视频一键下载、笔记列表导出 CSV | RedNote Exporter",
    "description": "免费 Chrome 扩展：一键下载小红书笔记的全部图片与视频（视频优先无水印原片），把首页推荐、搜索结果、用户主页的笔记列表导出为 CSV。无需登录，笔记只在你的浏览器里处理。",
    "og_site_name": "小红书导出工具 RedNote Exporter",
    "og_title": "小红书导出工具 - 图片视频一键下载、笔记列表导出 CSV",
    "og_description": "一键下载小红书笔记的图片与视频，笔记列表导出 CSV。免费、无需登录、在浏览器里处理。",
    "app_name": "小红书导出工具 (RedNote Exporter)", "app_alt": "RedNote Exporter",
    "app_description": "一键下载小红书笔记的全部图片与视频，并将首页推荐、搜索结果、用户主页的笔记列表导出为 CSV。",
    "brand": "小红书导出工具", "nav_label": "页面导航", "lang_label": "语言",
    "nav": [("#features", "功能"), ("#preview", "预览"), ("#how", "用法"), ("#faq", "常见问题")],
    "add": "添加到 Chrome",
    "hero_title": "小红书笔记，<mark>一键</mark>带走",
    "hero_sub": "图片视频一键下载 · 笔记列表导出 CSV<br>免费 · 无需登录 · 笔记不离开你的浏览器",
    "hero_how": "看看怎么用",
    "hero_tags": ["#无水印原片", "#实况图", "#搜索结果", "#用户主页", "#导出CSV"],
    "feat_h": "能做什么",
    "feats": [
        ("post", "fill-sky", "一键下载单帖", "勾选想要的图片、视频和正文，实况图连动态一起存，视频优先无水印原片。"),
        ("folder", "fill-yellow", "一帖一个文件夹", "按下载时间和标题建文件夹，文件按顺序编号，不覆盖旧文件。"),
        ("list", "fill-mint", "边刷边采集", "首页推荐、搜索结果、用户主页、收藏页往下滑，看过的笔记自动去重收集。"),
        ("csv", "fill-lilac", "导出 CSV 表格", "Excel、Numbers、Google 表格直接打开，标题、作者、互动数据都在。"),
    ],
    "pv_h": "看看界面", "pv_label": "界面预览",
    "pv": [
        ("post", "下载单帖", "「下载单帖资源」标签页：列出笔记的视频和全部图片，可以逐张勾选",
         "图片和视频，<mark>一键</mark>全部保存", "打开任意一篇笔记，勾选想要的图片和视频，点一下就下载到同一个文件夹。",
         ["视频优先下载无水印原片", "实况图、正文（note.txt）也能存", "只勾选你需要的那几张"]),
        ("folder", "自动整理", "下载文件夹里：一个以时间和笔记标题命名的文件夹，里面是 video-1.mp4 和 image-1 到 image-9",
         "一篇笔记，<mark>一个</mark>文件夹", "文件夹按下载时间和笔记标题命名，视频和图片按顺序编号，不用再一张张重命名。",
         ["下载时间 + 标题，自动建文件夹", "image-1、image-2… 按原顺序编号", "重名自动加序号，不覆盖旧文件"]),
        ("list", "导出列表", "「导出笔记列表」标签页：已采集 128 条，列出每条笔记的标题、作者、点赞收藏评论数和日期",
         "边刷边采集，<mark>随时</mark>导出", "在首页推荐、搜索结果或用户主页正常往下滑，看过的笔记会被自动收集并去重。",
         ["首页推荐 · 搜索结果 · 用户主页 · 收藏", "自动去重，实时显示采集数量", "标题、作者、互动数据一起带上"]),
        ("csv", "CSV 表格", "导出的 CSV 在表格软件里打开：标题、作者、发布时间、点赞数、收藏数等列",
         "导出就是<mark>一张</mark>整齐的表", "Excel、Numbers、Google 表格直接打开，中文不乱码，做选题分析、竞品整理都顺手。",
         ["标题、作者、发布时间", "点赞 · 收藏 · 评论 · 分享", "封面、作者主页、全部图片链接"]),
    ],
    "how_h": "三步上手",
    "steps": [
        ("browser", "fill-sky", "打开小红书", "首页推荐、搜索结果、用户主页、收藏页，或者任意一篇笔记。"),
        ("click", "fill-pink", "点击扩展图标", "切换到「导出笔记列表」或「下载单帖资源」。列表页继续往下滚动，可以累积采集更多笔记。"),
        ("saved", "fill-mint", "导出或下载", "点「导出 CSV」保存表格，或勾选图片视频一键下载；「清空」可以重新开始。"),
    ],
    "priv_h": "笔记只留在本地",
    "privs": [
        ("lock", "fill-yellow", "不用注册", "扩展没有账号体系，也不读取你的小红书账号信息。"),
        ("cloudoff", "fill-sky", "保存的内容不上传", "笔记、图片、视频都不经过我们的服务器。我们只收到匿名的使用次数，而且你可以关掉。"),
        ("shield", "fill-mint", "只处理公开内容", "扩展只读取你正在浏览的小红书页面上已经能看到的笔记。"),
    ],
    "priv_more": "阅读完整的隐私政策",
    "faq_h": "常见问题",
    "faqs": [
        ("免费吗？", "免费，没有付费功能，也不需要注册账号。"),
        ("下载的视频都没有水印吗？", "扩展会优先下载无水印的原片；个别笔记拿不到原片时，会自动改下普通视频流，这种情况下可能带水印。"),
        ("CSV 里为什么有些列是空的？", "只有搜索结果页会返回完整的收藏、评论、分享数和发布时间；首页推荐和用户主页只返回点赞数。没有返回的列会留空，而不是填 0，所以空格表示「没有数据」，不是数量为零。"),
        ("采集到的笔记存在哪里？", "只存在当前标签页里，关闭标签页或点「清空」就没有了。导出的 CSV 和下载的图片视频保存在你电脑的下载文件夹，不会上传到任何服务器。"),
        ("支持哪些网站和浏览器？", "支持 xiaohongshu.com 和 rednote.com 两个域名。浏览器方面支持 Chrome，Edge、Brave 等 Chromium 内核浏览器一般也能从 Chrome 应用商店安装。"),
    ],
    "close_h": "现在就试试", "close_p": "装好后打开任意一篇小红书笔记，点一下扩展图标就能用。",
    "foot_desc": "免费的小红书图片视频下载、笔记列表导出 CSV 扩展。",
    "foot_product": ("产品", ["功能", "界面预览", "怎么用"]),
    "foot_help": ("帮助", ["常见问题", "隐私政策", "反馈 help@lab115.com"]),
    "foot_more": ("更多", "https://lab115.com/zh", "LAB115 出品"),
    "disclaimer": "本扩展与小红书（RED / RedNote）官方无任何关联或授权，仅处理公开可见内容，适用于个人和研究用途。",
    "notfound": "找不到这个页面", "back": "回到首页",
    "privacy_title": "隐私政策 - 小红书导出工具 RedNote Exporter",
    "privacy_description": "小红书导出工具（RedNote Exporter）采集和下载的笔记、图片、视频只在你的浏览器里，只发送可以关闭的匿名使用次数。",
    "privacy": """<h1>隐私政策</h1>
      <p class="updated">适用于 Chrome 扩展「小红书导出工具（RedNote Exporter）」 · 最后更新：2026 年 11 月 13 日</p>

      <div class="summary">
        <p><strong>简单说：</strong>你采集和下载的笔记、图片、视频都只在你的浏览器里，不会离开你的电脑。扩展会把匿名的使用次数（用了哪些功能、用了多少次）发到我们自建的统计服务器，用来决定先改进什么。这些数据不含笔记内容、链接和账号信息，你可以在扩展的 ⋯ 菜单里关掉。</p>
      </div>

      <h2>扩展会读取什么</h2>
      <p>只有当你打开 xiaohongshu.com 或 rednote.com 的页面时，扩展才会运行，并且只读取这些页面本身加载的笔记数据：</p>
      <ul>
        <li><strong>笔记列表</strong>：首页推荐、搜索结果、用户主页、收藏页加载出来的笔记，包括标题、作者、发布时间、互动数（点赞、收藏、评论、分享）、封面和图片链接。</li>
        <li><strong>单篇笔记</strong>：当前打开的笔记的图片、实况图和视频链接，以及正文、话题、IP 属地、互动数等信息，用于下载或保存为文本文件。</li>
      </ul>
      <p>这些都是页面上本来就公开可见的内容。扩展不会读取你的小红书账号信息、私信、Cookie 或密码，也不会自己向小红书发起额外请求，只是读取页面在你浏览时已经收到的数据。</p>

      <h2>匿名使用统计</h2>
      <p>为了了解大家实际在用哪些功能，扩展会向我们自建的统计服务器（Umami，地址 stats.lab115.com）发送少量匿名事件：</p>
      <ul>
        <li><strong>什么时候发：</strong>安装或更新扩展时；打开扩展弹窗、切换标签页、导出笔记列表、下载单帖、清空列表、打开原帖、切换界面语言时。</li>
        <li><strong>包含什么：</strong>当前页面的类型（首页推荐、搜索、用户主页、单篇笔记或其他）以及是 xiaohongshu.com 还是 rednote.com；数量，例如导出了几条笔记，下载了几张图片、几个视频、几张实况图、几个文本文件，有几个没能开始下载；视频是不是无水印原片；界面语言和浏览器语言；扩展版本；以及安装时随机生成的安装 ID，用来统计有多少人在用、有没有人回来继续用。</li>
        <li><strong>绝不包含：</strong>笔记 ID、链接、标题和正文，作者名，搜索词，文件名，你的小红书账号，Cookie，以及你访问其他网站的任何信息。</li>
        <li><strong>网络信息：</strong>和所有网络请求一样，统计服务器会收到你的 IP 地址和浏览器标识。服务器只用它们推断大致的国家和浏览器、操作系统类型，不保存 IP 地址。</li>
        <li><strong>怎么关闭：</strong>在扩展弹窗里点 ⋯，关掉「匿名使用统计」。关闭后不再发送任何数据。</li>
      </ul>
      <p>统计数据只保存在我们自己的服务器上，只用于改进扩展，不出售也不分享。</p>

      <h2>卸载扩展时</h2>
      <p>扩展被卸载后，Chrome 会打开本网站上的一个简短页面，问你卸载的原因。页面地址里带有扩展版本号；如果使用统计是开着的，还带有安装 ID，用来把卸载原因和这个安装用过的功能对上。填不填都可以。</p>

      <h2>本网站</h2>
      <p>rednote.lab115.com 用同一个自建的 Umami 统计访问情况：浏览了哪些页面、从哪个网站过来、大致国家、浏览器和设备类型，以及「添加到 Chrome」按钮的点击。网站不设置 Cookie，也不使用第三方统计工具。</p>

      <h2>数据存在哪里</h2>
      <ul>
        <li>采集到的笔记只保存在当前标签页的内存里。关闭标签页、刷新页面或点「清空」后就会丢弃。</li>
        <li>你点「导出 CSV」或「下载」时，文件直接由浏览器保存到你电脑的下载文件夹。图片和视频由浏览器从小红书的图片、视频服务器直接下载，不经过我们。</li>
        <li>扩展在本地只保存三样东西：你在语言菜单里选择的界面语言、使用统计是否开启，以及随机生成的安装 ID。</li>
      </ul>

      <h2>我们不做的事</h2>
      <ul>
        <li>不把你采集或下载的笔记、图片、视频、正文发送到我们或任何第三方的服务器。</li>
        <li>不使用第三方统计、广告或追踪工具。</li>
        <li>不出售、不出租、不分享任何数据。</li>
        <li>不在后台主动采集。只有你在浏览小红书页面时，扩展才会处理该页面的数据。</li>
      </ul>

      <h2>权限说明</h2>
      <ul>
        <li><code>downloads</code>：把你选中的图片、视频保存到下载文件夹，并按「时间 + 笔记标题」放进同一个子文件夹。</li>
        <li><code>storage</code>：记住使用统计的开关设置和安装 ID。</li>
        <li><strong>访问 xiaohongshu.com 和 rednote.com（含 edith、so 子域名）</strong>：在这些页面上运行，读取页面加载的笔记数据。扩展不会在其他网站上运行。</li>
      </ul>

      <h2>你下载的内容</h2>
      <p>通过本扩展下载或导出的内容版权归原作者所有。请仅用于个人和研究用途，并遵守小红书的用户协议和相关法律。本扩展与小红书（RED / RedNote）官方无任何关联或授权。</p>

      <h2>政策变更</h2>
      <p>如果扩展的数据处理方式发生变化，我们会更新这一页并修改上面的日期。</p>

      <h2>联系我们</h2>
      <p>对隐私有任何疑问，请发邮件到 <a href="mailto:help@lab115.com">help@lab115.com</a>。</p>""",
}

# ----------------------------------------------------------- Traditional Chinese
S["zh-tw"] = {
    "path": "/zh-tw/", "hreflang": "zh-TW", "og_locale": "zh_TW", "label": "繁體中文", "shots": "zh_TW",
    "head_comment": "繁體中文主頁（/zh-tw/）。",
    "title": "小紅書下載器 - 圖片影片一鍵下載、筆記列表匯出 CSV | RedNote Exporter",
    "description": "免費 Chrome 擴充功能：一鍵下載小紅書筆記的全部圖片與影片（影片優先無浮水印原檔），把首頁推薦、搜尋結果、使用者主頁的筆記列表匯出為 CSV。不需登入，筆記只在你的瀏覽器裡處理。",
    "og_site_name": "小紅書匯出工具 RedNote Exporter",
    "og_title": "小紅書下載器 - 圖片影片一鍵下載、筆記列表匯出 CSV",
    "og_description": "一鍵下載小紅書筆記的圖片與影片，筆記列表匯出 CSV。免費、不需登入、在瀏覽器裡處理。",
    "app_name": "小紅書匯出工具 (RedNote Exporter)", "app_alt": "RedNote Exporter",
    "app_description": "一鍵下載小紅書筆記的全部圖片與影片，並將首頁推薦、搜尋結果、使用者主頁的筆記列表匯出為 CSV。",
    "brand": "小紅書匯出工具", "nav_label": "頁面導覽", "lang_label": "語言",
    "nav": [("#features", "功能"), ("#preview", "預覽"), ("#how", "用法"), ("#faq", "常見問題")],
    "add": "加到 Chrome",
    "hero_title": "小紅書筆記，<mark>一鍵</mark>帶走",
    "hero_sub": "圖片影片一鍵下載 · 筆記列表匯出 CSV<br>免費 · 不需登入 · 筆記不離開你的瀏覽器",
    "hero_how": "看看怎麼用",
    "hero_tags": ["#無浮水印原檔", "#實況照片", "#搜尋結果", "#使用者主頁", "#匯出CSV"],
    "feat_h": "能做什麼",
    "feats": [
        ("post", "fill-sky", "一鍵下載單篇", "勾選想要的圖片、影片和內文，實況照片連動態一起存，影片優先無浮水印原檔。"),
        ("folder", "fill-yellow", "一篇一個資料夾", "依下載時間和標題建立資料夾，檔案依序編號，不覆蓋舊檔案。"),
        ("list", "fill-mint", "邊滑邊收集", "首頁推薦、搜尋結果、使用者主頁、收藏頁往下滑，看過的筆記自動去重收集。"),
        ("csv", "fill-lilac", "匯出 CSV 表格", "Excel、Numbers、Google 試算表直接開啟，標題、作者、互動數據都在。"),
    ],
    "pv_h": "看看介面", "pv_label": "介面預覽",
    "pv": [
        ("post", "下載單篇", "「下載單篇資源」分頁：列出筆記的影片和全部圖片，可以逐張勾選",
         "圖片和影片，<mark>一鍵</mark>全部儲存", "打開任意一篇筆記，勾選想要的圖片和影片，點一下就下載到同一個資料夾。",
         ["影片優先下載無浮水印原檔", "實況照片、內文（note.txt）也能存", "只勾選你需要的那幾張"]),
        ("folder", "自動整理", "下載資料夾裡：一個以時間和筆記標題命名的資料夾，裡面是 video-1.mp4 和 image-1 到 image-9",
         "一篇筆記，<mark>一個</mark>資料夾", "資料夾依下載時間和筆記標題命名，影片和圖片依序編號，不用再一張張重新命名。",
         ["下載時間 + 標題，自動建立資料夾", "image-1、image-2… 依原順序編號", "同名自動加序號，不覆蓋舊檔案"]),
        ("list", "匯出列表", "「匯出筆記列表」分頁：已收集 128 則，列出每則筆記的標題、作者、按讚收藏留言數和日期",
         "邊滑邊收集，<mark>隨時</mark>匯出", "在首頁推薦、搜尋結果或使用者主頁正常往下滑，看過的筆記會自動收集並去除重複。",
         ["首頁推薦 · 搜尋結果 · 使用者主頁 · 收藏", "自動去重，即時顯示收集數量", "標題、作者、互動數據一起帶上"]),
        ("csv", "CSV 表格", "匯出的 CSV 在試算表軟體裡開啟：標題、作者、發布時間、按讚數、收藏數等欄位",
         "匯出就是<mark>一張</mark>整齊的表", "Excel、Numbers、Google 試算表直接開啟，中文不亂碼，做選題分析、競品整理都順手。",
         ["標題、作者、發布時間", "按讚 · 收藏 · 留言 · 分享", "封面、作者主頁、全部圖片連結"]),
    ],
    "how_h": "三步上手",
    "steps": [
        ("browser", "fill-sky", "打開小紅書", "首頁推薦、搜尋結果、使用者主頁、收藏頁，或任意一篇筆記。"),
        ("click", "fill-pink", "點擊擴充功能圖示", "切換到「匯出筆記列表」或「下載單篇資源」。列表頁繼續往下捲動，可以累積收集更多筆記。"),
        ("saved", "fill-mint", "匯出或下載", "點「匯出 CSV」儲存表格，或勾選圖片影片一鍵下載；「清空」可以重新開始。"),
    ],
    "priv_h": "筆記只留在本機",
    "privs": [
        ("lock", "fill-yellow", "不用註冊", "擴充功能沒有帳號系統，也不讀取你的小紅書帳號資訊。"),
        ("cloudoff", "fill-sky", "儲存的內容不上傳", "筆記、圖片、影片都不經過我們的伺服器。我們只收到匿名的使用次數，而且你可以關掉。"),
        ("shield", "fill-mint", "只處理公開內容", "擴充功能只讀取你正在瀏覽的小紅書頁面上已經看得到的筆記。"),
    ],
    "priv_more": "閱讀完整的隱私權政策",
    "faq_h": "常見問題",
    "faqs": [
        ("免費嗎？", "免費，沒有付費功能，也不需要註冊帳號。"),
        ("下載的影片都沒有浮水印嗎？", "擴充功能會優先下載無浮水印的原檔；少數筆記拿不到原檔時，會自動改下一般影片串流，這種情況下可能帶浮水印。"),
        ("CSV 裡為什麼有些欄位是空的？", "只有搜尋結果頁會回傳完整的收藏、留言、分享數和發布時間；首頁推薦和使用者主頁只回傳按讚數。沒有回傳的欄位會留空，而不是填 0，所以空格表示「沒有資料」，不是數量為零。"),
        ("收集到的筆記存在哪裡？", "只存在目前的分頁裡，關閉分頁或點「清空」就沒有了。匯出的 CSV 和下載的圖片影片儲存在你電腦的下載資料夾，不會上傳到任何伺服器。"),
        ("支援哪些網站和瀏覽器？", "支援 xiaohongshu.com 和 rednote.com 兩個網域。瀏覽器方面支援 Chrome，Edge、Brave 等 Chromium 核心瀏覽器一般也能從 Chrome 線上應用程式商店安裝。"),
    ],
    "close_h": "現在就試試", "close_p": "裝好後打開任意一篇小紅書筆記，點一下擴充功能圖示就能用。",
    "foot_desc": "免費的小紅書圖片影片下載、筆記列表匯出 CSV 擴充功能。",
    "foot_product": ("產品", ["功能", "介面預覽", "怎麼用"]),
    "foot_help": ("說明", ["常見問題", "隱私權政策", "意見回饋 help@lab115.com"]),
    "foot_more": ("更多", "https://lab115.com/zh", "LAB115 出品"),
    "disclaimer": "本擴充功能與小紅書（RED / RedNote）官方無任何關聯或授權，僅處理公開可見內容，適用於個人與研究用途。",
    "notfound": "找不到這個頁面", "back": "回到首頁",
    "privacy_title": "隱私權政策 - 小紅書匯出工具 RedNote Exporter",
    "privacy_description": "小紅書匯出工具（RedNote Exporter）收集和下載的筆記、圖片、影片只在你的瀏覽器裡，只傳送可以關閉的匿名使用次數。",
    "privacy": """<h1>隱私權政策</h1>
      <p class="updated">適用於 Chrome 擴充功能「小紅書匯出工具（RedNote Exporter）」 · 最後更新：2026 年 11 月 13 日</p>
      <p class="updated">本頁為翻譯版本，內容如有出入，以<a href="/privacy/" hreflang="en" lang="en">英文版</a>為準。</p>

      <div class="summary">
        <p><strong>簡單說：</strong>你收集和下載的筆記、圖片、影片都只在你的瀏覽器裡，不會離開你的電腦。擴充功能會把匿名的使用次數（用了哪些功能、用了多少次）傳到我們自建的統計伺服器，用來決定先改進什麼。這些資料不含筆記內容、連結和帳號資訊，你可以在擴充功能的 ⋯ 選單裡關掉。</p>
      </div>

      <h2>擴充功能會讀取什麼</h2>
      <p>只有當你打開 xiaohongshu.com 或 rednote.com 的頁面時，擴充功能才會執行，並且只讀取這些頁面本身載入的筆記資料：</p>
      <ul>
        <li><strong>筆記列表</strong>：首頁推薦、搜尋結果、使用者主頁、收藏頁載入的筆記，包括標題、作者、發布時間、互動數（按讚、收藏、留言、分享）、封面和圖片連結。</li>
        <li><strong>單篇筆記</strong>：目前開啟的筆記的圖片、實況照片和影片連結，以及內文、話題、IP 屬地、互動數等資訊，用於下載或儲存為文字檔。</li>
      </ul>
      <p>這些都是頁面上本來就公開可見的內容。擴充功能不會讀取你的小紅書帳號資訊、私訊、Cookie 或密碼，也不會自己向小紅書發出額外請求，只是讀取頁面在你瀏覽時已經收到的資料。</p>

      <h2>匿名使用統計</h2>
      <p>為了了解大家實際在用哪些功能，擴充功能會向我們自建的統計伺服器（Umami，位址 stats.lab115.com）傳送少量匿名事件：</p>
      <ul>
        <li><strong>什麼時候傳：</strong>安裝或更新擴充功能時；開啟擴充功能視窗、切換分頁、匯出筆記列表、下載單篇筆記、清空列表、開啟原文、切換介面語言時。</li>
        <li><strong>包含什麼：</strong>目前頁面的類型（首頁推薦、搜尋、使用者主頁、單篇筆記或其他）以及是 xiaohongshu.com 還是 rednote.com；數量，例如匯出了幾則筆記，下載了幾張圖片、幾部影片、幾張實況照片、幾個文字檔，有幾個沒能開始下載；影片是不是無浮水印原檔；介面語言和瀏覽器語言；擴充功能版本；以及安裝時隨機產生的安裝 ID，用來統計有多少人在用、有沒有人回來繼續用。</li>
        <li><strong>絕不包含：</strong>筆記 ID、連結、標題和內文，作者名稱，搜尋關鍵字，檔名，你的小紅書帳號，Cookie，以及你造訪其他網站的任何資訊。</li>
        <li><strong>網路資訊：</strong>和所有網路請求一樣，統計伺服器會收到你的 IP 位址和瀏覽器識別資訊。伺服器只用它們推斷大致的國家和瀏覽器、作業系統類型，不儲存 IP 位址。</li>
        <li><strong>如何關閉：</strong>在擴充功能視窗裡點 ⋯，關掉「匿名使用統計」。關閉後不再傳送任何資料。</li>
      </ul>
      <p>統計資料只保存在我們自己的伺服器上，只用於改進擴充功能，不出售也不分享。</p>

      <h2>移除擴充功能時</h2>
      <p>擴充功能被移除後，Chrome 會開啟本網站上的一個簡短頁面，詢問移除的原因。頁面網址帶有擴充功能版本；如果使用統計是開著的，還帶有安裝 ID，用來把原因和這個安裝用過的功能對應起來。填不填都可以。</p>

      <h2>本網站</h2>
      <p>rednote.lab115.com 用同一個自建的 Umami 統計造訪情況：瀏覽了哪些頁面、從哪個網站過來、大致國家、瀏覽器和裝置類型，以及「加到 Chrome」按鈕的點擊。網站不設定 Cookie，也不使用第三方統計工具。</p>

      <h2>資料存在哪裡</h2>
      <ul>
        <li>收集到的筆記只儲存在目前分頁的記憶體裡。關閉分頁、重新整理頁面或點「清空」後就會捨棄。</li>
        <li>你點「匯出 CSV」或「下載」時，檔案直接由瀏覽器儲存到你電腦的下載資料夾。圖片和影片由瀏覽器從小紅書的圖片、影片伺服器直接下載，不經過我們。</li>
        <li>擴充功能在本機只保存三樣東西：你在語言選單裡選擇的介面語言、使用統計是否開啟，以及隨機產生的安裝 ID。</li>
      </ul>

      <h2>我們不做的事</h2>
      <ul>
        <li>不把你收集或下載的筆記、圖片、影片、內文傳送到我們或任何第三方的伺服器。</li>
        <li>不使用第三方統計、廣告或追蹤工具。</li>
        <li>不出售、不出租、不分享任何資料。</li>
        <li>不在背景主動收集。只有你在瀏覽小紅書頁面時，擴充功能才會處理該頁面的資料。</li>
      </ul>

      <h2>權限說明</h2>
      <ul>
        <li><code>downloads</code>：把你選取的圖片、影片儲存到下載資料夾，並依「時間 + 筆記標題」放進同一個子資料夾。</li>
        <li><code>storage</code>：記住使用統計的開關設定和安裝 ID。</li>
        <li><strong>存取 xiaohongshu.com 和 rednote.com（含 edith、so 子網域）</strong>：在這些頁面上執行，讀取頁面載入的筆記資料。擴充功能不會在其他網站上執行。</li>
      </ul>

      <h2>你下載的內容</h2>
      <p>透過本擴充功能下載或匯出的內容，著作權歸原作者所有。請僅用於個人與研究用途，並遵守小紅書的使用條款和相關法律。本擴充功能與小紅書（RED / RedNote）官方無任何關聯或授權。</p>

      <h2>政策變更</h2>
      <p>如果擴充功能的資料處理方式有所變更，我們會更新這一頁並修改上面的日期。</p>

      <h2>聯絡我們</h2>
      <p>對隱私有任何疑問，請寄信到 <a href="mailto:help@lab115.com">help@lab115.com</a>。</p>""",
}

# ---------------------------------------------------------------------- Korean
S["ko"] = {
    "path": "/ko/", "hreflang": "ko", "og_locale": "ko_KR", "label": "한국어", "shots": "ko",
    "head_comment": "Korean home page (/ko/).",
    "title": "샤오홍슈 다운로더 - 레드노트 이미지·동영상 저장, 노트 목록 CSV 내보내기 | RedNote Exporter",
    "description": "무료 Chrome 확장 프로그램: 샤오홍슈(RedNote) 게시물의 이미지와 동영상을 한 번에 다운로드하고(동영상은 워터마크 없는 원본 우선), 홈 피드·검색 결과·프로필의 노트 목록을 CSV로 내보냅니다. 로그인 불필요, 노트는 브라우저 밖으로 나가지 않습니다.",
    "og_site_name": "RedNote Exporter",
    "og_title": "샤오홍슈 다운로더 - 이미지·동영상 저장, 노트 목록 CSV 내보내기",
    "og_description": "샤오홍슈 게시물의 이미지와 동영상을 한 번에 저장하고 노트 목록을 CSV로 내보내세요. 무료, 로그인 불필요, 브라우저 안에서 처리.",
    "app_name": "RedNote Exporter", "app_alt": "샤오홍슈 다운로더",
    "app_description": "샤오홍슈(RedNote) 게시물의 이미지와 동영상을 한 번에 다운로드하고, 홈 피드·검색 결과·프로필의 노트 목록을 CSV로 내보냅니다.",
    "brand": "RedNote Exporter", "nav_label": "페이지", "lang_label": "언어",
    "nav": [("#features", "기능"), ("#preview", "미리보기"), ("#how", "사용법"), ("#faq", "FAQ")],
    "add": "Chrome에 추가",
    "hero_title": "샤오홍슈 노트, <mark>한 번에</mark> 저장",
    "hero_sub": "게시물 이미지·동영상 다운로드 · 노트 목록 CSV 내보내기<br>무료 · 가입 불필요 · 노트는 브라우저 밖으로 나가지 않음",
    "hero_how": "사용법 보기",
    "hero_tags": ["#워터마크없는원본", "#라이브포토", "#검색결과", "#프로필", "#CSV내보내기"],
    "feat_h": "주요 기능",
    "feats": [
        ("post", "fill-sky", "게시물 통째로 다운로드", "원하는 이미지, 동영상, 본문을 선택하세요. 라이브 포토는 움직이는 영상까지, 동영상은 워터마크 없는 원본을 우선 받습니다."),
        ("folder", "fill-yellow", "게시물마다 폴더 하나", "다운로드 시간과 제목으로 폴더를 만들고, 파일은 순서대로 번호를 붙이며 덮어쓰지 않습니다."),
        ("list", "fill-mint", "스크롤하며 수집", "홈 피드, 검색 결과, 프로필, 저장 탭을 내리기만 하면 본 노트가 중복 없이 모입니다."),
        ("csv", "fill-lilac", "CSV로 내보내기", "Excel, Numbers, Google 스프레드시트에서 바로 열리며 제목·작성자·반응 데이터가 담깁니다."),
    ],
    "pv_h": "화면 미리보기", "pv_label": "화면",
    "pv": [
        ("post", "게시물 다운로드", "「게시물 다운로드」 탭: 게시물의 동영상과 모든 이미지가 체크박스와 함께 표시됨",
         "이미지와 동영상, <mark>한 번에</mark> 모두 저장", "게시물을 열고 원하는 이미지와 동영상을 선택하면 한 폴더에 바로 다운로드됩니다.",
         ["워터마크 없는 원본 동영상 우선", "라이브 포토와 본문(note.txt)도 저장", "필요한 파일만 골라서 저장"]),
        ("folder", "자동 정리", "다운로드 폴더: 시간과 게시물 제목으로 이름 붙은 폴더 안에 video-1.mp4와 image-1~image-9",
         "게시물 하나에 <mark>폴더 하나</mark>", "폴더 이름은 다운로드 시간과 게시물 제목으로 정해지고, 파일에는 순서대로 번호가 붙습니다.",
         ["다운로드 시간 + 제목으로 폴더 생성", "image-1, image-2… 원래 순서대로", "같은 이름은 번호를 붙여 덮어쓰지 않음"]),
        ("list", "노트 목록", "「노트 목록 내보내기」 탭: 128개 수집, 각 노트의 제목·작성자·좋아요·저장·댓글 수와 날짜",
         "스크롤만 하면 수집, <mark>언제든</mark> 내보내기", "홈 피드, 검색 결과, 프로필을 평소처럼 스크롤하면 본 노트가 자동으로 수집되고 중복은 제거됩니다.",
         ["홈 피드 · 검색 결과 · 프로필 · 저장", "자동 중복 제거, 실시간 개수 표시", "제목, 작성자, 반응 데이터까지"]),
        ("csv", "CSV 표", "스프레드시트에서 연 CSV: Title, Author Name, Publish Time, Like Count, Collect Count 열",
         "내보내면 바로 <mark>깔끔한</mark> 표", "Excel, Numbers, Google 스프레드시트에서 바로 열립니다. 콘텐츠 분석과 경쟁사 정리에 유용합니다.",
         ["제목, 작성자, 게시 시간", "좋아요 · 저장 · 댓글 · 공유", "커버, 프로필, 모든 이미지 링크"]),
    ],
    "how_h": "세 단계면 끝",
    "steps": [
        ("browser", "fill-sky", "샤오홍슈 열기", "홈 피드, 검색 결과, 프로필, 저장 탭 또는 아무 게시물."),
        ("click", "fill-pink", "확장 프로그램 아이콘 클릭", "「노트 목록 내보내기」 또는 「게시물 다운로드」를 선택하세요. 목록에서는 계속 스크롤하면 더 많이 수집됩니다."),
        ("saved", "fill-mint", "내보내기 또는 다운로드", "「CSV 내보내기」로 표를 저장하거나, 이미지와 동영상을 골라 다운로드하세요. 「지우기」로 다시 시작합니다."),
    ],
    "priv_h": "노트는 내 컴퓨터에만",
    "privs": [
        ("lock", "fill-yellow", "계정 불필요", "가입 절차가 없고 샤오홍슈 계정 정보도 읽지 않습니다."),
        ("cloudoff", "fill-sky", "저장한 내용은 업로드되지 않음", "노트, 이미지, 동영상은 저희 서버를 거치지 않습니다. 저희가 받는 것은 끌 수 있는 익명 사용 횟수뿐입니다."),
        ("shield", "fill-mint", "공개 콘텐츠만", "지금 보고 있는 샤오홍슈 페이지에 이미 보이는 노트만 읽습니다."),
    ],
    "priv_more": "개인정보처리방침 전문 보기",
    "faq_h": "자주 묻는 질문",
    "faqs": [
        ("무료인가요?", "네. 유료 기능도 없고 계정을 만들 필요도 없습니다."),
        ("동영상은 항상 워터마크가 없나요?", "워터마크 없는 원본을 받을 수 있으면 항상 원본을 우선 받습니다. 원본이 없는 일부 게시물은 일반 동영상 스트림으로 자동 전환되며, 이 경우 워터마크가 있을 수 있습니다."),
        ("CSV에 비어 있는 열이 있는 이유는?", "저장·댓글·공유 수와 게시 시간은 검색 결과에서만 전체가 제공되고, 홈 피드와 프로필은 좋아요 수만 제공합니다. 샤오홍슈가 주지 않은 값은 0으로 채우지 않고 비워 두므로, 빈칸은 0이 아니라 '제공되지 않음'을 뜻합니다."),
        ("수집한 노트는 어디에 저장되나요?", "현재 탭에만 있습니다. 탭을 닫거나 「지우기」를 누르면 사라집니다. 내보낸 CSV와 다운로드한 파일은 내 컴퓨터의 다운로드 폴더에 저장되며 어디에도 업로드되지 않습니다."),
        ("어떤 사이트와 브라우저를 지원하나요?", "xiaohongshu.com과 rednote.com을 모두 지원합니다. Chrome용으로 만들었으며, Edge나 Brave 같은 Chromium 기반 브라우저도 대개 Chrome 웹 스토어에서 설치할 수 있습니다."),
    ],
    "close_h": "지금 써 보세요", "close_p": "설치한 뒤 샤오홍슈 게시물을 열고 확장 프로그램 아이콘을 클릭하세요.",
    "foot_desc": "샤오홍슈 이미지와 동영상을 저장하고 노트 목록을 CSV로 내보내는 무료 Chrome 확장 프로그램.",
    "foot_product": ("제품", ["기능", "미리보기", "사용법"]),
    "foot_help": ("도움말", ["자주 묻는 질문", "개인정보처리방침", "help@lab115.com"]),
    "foot_more": ("더 보기", "https://lab115.com", "Made by LAB115"),
    "disclaimer": "RedNote Exporter는 샤오홍슈(RedNote)와 제휴하거나 승인·허가를 받지 않았습니다. 공개된 콘텐츠만 처리하며 개인 및 연구 목적으로 만들어졌습니다.",
    "notfound": "페이지를 찾을 수 없습니다", "back": "홈으로",
    "privacy_title": "개인정보처리방침 - RedNote Exporter",
    "privacy_description": "RedNote Exporter는 노트, 이미지, 동영상을 브라우저 안에만 두며, 끌 수 있는 익명 사용 횟수만 보냅니다.",
    "privacy": """<h1>개인정보처리방침</h1>
      <p class="updated">Chrome 확장 프로그램 「RedNote Exporter」 · 최종 업데이트: 2026년 11월 13일</p>
      <p class="updated">이 페이지는 번역본입니다. 내용이 다를 경우 <a href="/privacy/" hreflang="en" lang="en">영어 원문</a>이 우선합니다.</p>

      <div class="summary">
        <p><strong>요약:</strong> 수집하거나 다운로드한 노트, 이미지, 동영상은 브라우저 밖으로 나가지 않습니다. 무엇을 먼저 개선할지 알기 위해, 확장 프로그램은 익명 사용 횟수(어떤 기능을 얼마나 자주 쓰는지)를 저희가 직접 운영하는 통계 서버로 보냅니다. 여기에는 노트 내용, 링크, 계정 정보가 포함되지 않으며, 확장 프로그램의 ⋯ 메뉴에서 끌 수 있습니다.</p>
      </div>

      <h2>확장 프로그램이 읽는 정보</h2>
      <p>확장 프로그램은 xiaohongshu.com과 rednote.com 페이지에서만 실행되며, 해당 페이지가 스스로 불러온 노트 데이터만 읽습니다.</p>
      <ul>
        <li><strong>노트 목록</strong> — 홈 피드, 검색 결과, 프로필 페이지와 저장 탭이 불러온 노트: 제목, 작성자, 게시 시간, 반응 수(좋아요, 저장, 댓글, 공유), 커버와 이미지 링크.</li>
        <li><strong>단일 게시물</strong> — 다운로드하거나 텍스트 파일로 저장하기 위해, 현재 열려 있는 게시물의 이미지·라이브 포토·동영상 링크와 본문, 주제, IP 위치, 반응 수.</li>
      </ul>
      <p>이 모든 정보는 페이지에 이미 공개적으로 보이는 콘텐츠입니다. 확장 프로그램은 샤오홍슈 계정 정보, 메시지, 쿠키, 비밀번호를 읽지 않으며, 샤오홍슈에 별도의 요청을 보내지 않습니다. 사용자가 탐색하는 동안 페이지가 이미 받은 데이터만 읽습니다.</p>

      <h2>익명 사용 통계</h2>
      <p>사용자들이 실제로 어떤 기능을 쓰는지 알기 위해, 확장 프로그램은 저희가 직접 운영하는 통계 서버(Umami, stats.lab115.com)로 몇 가지 익명 이벤트를 보냅니다.</p>
      <ul>
        <li><strong>보내는 시점:</strong> 확장 프로그램을 설치하거나 업데이트할 때, 그리고 팝업을 열거나, 탭을 바꾸거나, 노트 목록을 내보내거나, 게시물을 다운로드하거나, 목록을 비우거나, 원본 게시물을 열거나, 인터페이스 언어를 바꿀 때.</li>
        <li><strong>포함되는 정보:</strong> 현재 페이지의 종류(홈 피드, 검색, 프로필, 게시물, 기타)와 xiaohongshu.com인지 rednote.com인지; 내보낸 노트 수, 다운로드한 이미지·동영상·라이브 포토·텍스트 파일 수와 다운로드를 시작하지 못한 수 같은 개수; 동영상이 워터마크 없는 원본이었는지; 인터페이스 언어와 브라우저 언어; 확장 프로그램 버전; 그리고 설치할 때 무작위로 만들어지는 설치 ID(사용자 수와 재방문 여부를 세는 데 사용).</li>
        <li><strong>절대 포함하지 않는 정보:</strong> 노트 ID, 링크, 제목, 본문, 작성자 이름, 검색어, 파일 이름, 샤오홍슈 계정, 쿠키, 그리고 다른 웹사이트 방문에 관한 어떤 정보도.</li>
        <li><strong>네트워크 정보:</strong> 모든 웹 요청과 마찬가지로 통계 서버는 IP 주소와 브라우저 정보(User-Agent)를 받습니다. 서버는 이를 대략적인 국가와 브라우저·운영체제 종류를 파악하는 데만 쓰고, IP 주소는 저장하지 않습니다.</li>
        <li><strong>끄는 방법:</strong> 확장 프로그램 팝업에서 ⋯를 누르고 「익명 사용 통계」를 끄세요. 그 이후로는 아무것도 보내지 않습니다.</li>
      </ul>
      <p>통계는 저희 서버에만 보관되며, 확장 프로그램을 개선하는 데만 쓰이고, 판매하거나 공유하지 않습니다.</p>

      <h2>제거할 때</h2>
      <p>확장 프로그램을 제거하면 Chrome이 이 웹사이트의 짧은 페이지를 열어 제거 이유를 묻습니다. 페이지 주소에는 확장 프로그램 버전이, 사용 통계가 켜져 있었다면 설치 ID도 함께 담겨 있어 답변을 그 설치에서 쓴 기능과 연결할 수 있습니다. 답변은 선택 사항입니다.</p>

      <h2>이 웹사이트</h2>
      <p>rednote.lab115.com은 같은 자체 운영 Umami로 방문을 집계합니다: 본 페이지, 유입 사이트, 대략적인 국가, 브라우저와 기기 종류, 「Chrome에 추가」 버튼 클릭. 쿠키를 쓰지 않으며 제3자 분석 도구도 쓰지 않습니다.</p>

      <h2>데이터 보관 위치</h2>
      <ul>
        <li>수집한 노트는 현재 탭의 메모리에만 있습니다. 탭을 닫거나 새로고침하거나 「지우기」를 누르면 삭제됩니다.</li>
        <li>「CSV 내보내기」나 「다운로드」를 누르면 브라우저가 파일을 다운로드 폴더에 바로 저장합니다. 이미지와 동영상은 브라우저가 샤오홍슈 미디어 서버에서 직접 받으며, 저희를 거치지 않습니다.</li>
        <li>확장 프로그램이 로컬에 저장하는 것은 세 가지뿐입니다: 언어 메뉴에서 고른 인터페이스 언어, 사용 통계를 켰는지 여부, 무작위 설치 ID.</li>
      </ul>

      <h2>하지 않는 일</h2>
      <ul>
        <li>수집하거나 다운로드한 노트, 이미지, 동영상, 본문을 저희 서버나 제3자에게 보내지 않습니다.</li>
        <li>제3자 분석, 광고, 추적 도구를 사용하지 않습니다.</li>
        <li>어떤 데이터도 판매, 대여, 공유하지 않습니다.</li>
        <li>백그라운드에서 아무것도 수집하지 않습니다. 사용자가 샤오홍슈 페이지를 보는 동안에만 그 페이지를 처리합니다.</li>
      </ul>

      <h2>권한</h2>
      <ul>
        <li><code>downloads</code> — 선택한 이미지와 동영상을 다운로드 폴더에 저장하며, 시간과 게시물 제목으로 이름 붙인 하위 폴더 하나에 모읍니다.</li>
        <li><code>storage</code> — 사용 통계 설정과 설치 ID를 기억합니다.</li>
        <li><strong>xiaohongshu.com 및 rednote.com 접근</strong>(edith, so 하위 도메인 포함) — 해당 페이지에서 실행되어 페이지가 불러온 노트 데이터를 읽습니다. 다른 사이트에서는 실행되지 않습니다.</li>
      </ul>

      <h2>다운로드한 콘텐츠</h2>
      <p>이 확장 프로그램으로 다운로드하거나 내보낸 콘텐츠의 권리는 원작자에게 있습니다. 개인 및 연구 목적으로만 사용하고 샤오홍슈 이용약관과 관련 법률을 지켜 주세요. RedNote Exporter는 샤오홍슈(RedNote)와 제휴하거나 승인·허가를 받지 않았습니다.</p>

      <h2>방침 변경</h2>
      <p>확장 프로그램의 데이터 처리 방식이 바뀌면 이 페이지와 위의 날짜를 업데이트합니다.</p>

      <h2>문의</h2>
      <p>개인정보에 관한 문의는 <a href="mailto:help@lab115.com">help@lab115.com</a>으로 이메일을 보내 주세요.</p>""",
}

# -------------------------------------------------------------------- Japanese
S["ja"] = {
    "path": "/ja/", "hreflang": "ja", "og_locale": "ja_JP", "label": "日本語", "shots": "ja",
    "head_comment": "Japanese home page (/ja/).",
    "title": "小紅書ダウンローダー - RED の画像・動画を一括保存、ノート一覧を CSV 出力 | RedNote Exporter",
    "description": "無料の Chrome 拡張機能：小紅書（RED / RedNote）の投稿の画像と動画をワンクリックで保存（動画は透かしなしの元ファイルを優先）。ホームフィード・検索結果・プロフィールのノート一覧を CSV に出力できます。ログイン不要、ノートがブラウザの外に出ることはありません。",
    "og_site_name": "RedNote Exporter",
    "og_title": "小紅書ダウンローダー - 画像・動画を一括保存、ノート一覧を CSV 出力",
    "og_description": "小紅書の投稿の画像と動画をワンクリックで保存し、ノート一覧を CSV に出力。無料、ログイン不要、ブラウザ内で処理。",
    "app_name": "RedNote Exporter", "app_alt": "小紅書ダウンローダー",
    "app_description": "小紅書（RED / RedNote）の投稿の画像と動画をワンクリックで保存し、ホームフィード・検索結果・プロフィールのノート一覧を CSV に出力します。",
    "brand": "RedNote Exporter", "nav_label": "ページ", "lang_label": "言語",
    "nav": [("#features", "機能"), ("#preview", "画面"), ("#how", "使い方"), ("#faq", "よくある質問")],
    "add": "Chrome に追加",
    "hero_title": "小紅書のノートを、<mark>ワンクリック</mark>で保存",
    "hero_sub": "投稿の画像・動画をダウンロード · ノート一覧を CSV 出力<br>無料 · 登録不要 · ノートはブラウザの外に出ません",
    "hero_how": "使い方を見る",
    "hero_tags": ["#透かしなし動画", "#ライブフォト", "#検索結果", "#プロフィール", "#CSV出力"],
    "feat_h": "できること",
    "feats": [
        ("post", "fill-sky", "投稿をまるごと保存", "欲しい画像・動画・本文にチェックするだけ。ライブフォトは動く映像ごと、動画は透かしなしの元ファイルを優先します。"),
        ("folder", "fill-yellow", "1 投稿に 1 フォルダ", "時刻とタイトルでフォルダを作り、ファイルは順番に番号付け。上書きはしません。"),
        ("list", "fill-mint", "スクロールしながら収集", "ホーム、検索、プロフィール、コレクションを下へスクロールするだけで、見たノートを重複なく集めます。"),
        ("csv", "fill-lilac", "CSV に出力", "Excel、Numbers、Google スプレッドシートでそのまま開け、タイトル・投稿者・反応数が入っています。"),
    ],
    "pv_h": "画面を見る", "pv_label": "画面",
    "pv": [
        ("post", "投稿を保存", "「投稿をダウンロード」タブ：投稿の動画とすべての画像がチェックボックス付きで並ぶ",
         "画像も動画も、<mark>ワンクリック</mark>で保存", "投稿を開いて、欲しい画像と動画にチェックを入れるだけ。1 つのフォルダにまとめてダウンロードします。",
         ["透かしなしの元動画を優先", "ライブフォトと本文（note.txt）も保存", "必要なファイルだけ選べる"]),
        ("folder", "自動で整理", "ダウンロードフォルダ：時刻と投稿タイトルの名前のフォルダに video-1.mp4 と image-1〜image-9",
         "1 投稿に、<mark>1 フォルダ</mark>", "フォルダ名はダウンロード時刻と投稿タイトル。ファイルには順番どおりに番号が付きます。",
         ["時刻 + タイトルでフォルダを自動作成", "image-1、image-2… 元の順番で番号付け", "同名ファイルは番号を付けて上書きしない"]),
        ("list", "ノート一覧", "「ノート一覧を出力」タブ：128 件を収集、各ノートのタイトル・投稿者・いいね・保存・コメント数と日付",
         "スクロールで収集、<mark>いつでも</mark>出力", "ホーム、検索結果、プロフィールを普段どおりスクロールすると、見たノートが自動で収集され、重複も除かれます。",
         ["ホーム · 検索結果 · プロフィール · コレクション", "重複を自動で除去、件数をリアルタイム表示", "タイトル、投稿者、反応数もまとめて"]),
        ("csv", "CSV 表", "スプレッドシートで開いた CSV：Title、Author Name、Publish Time、Like Count、Collect Count の列",
         "出力すれば<mark>きれいな</mark>表に", "Excel、Numbers、Google スプレッドシートでそのまま開けます。企画の分析や競合リサーチに便利です。",
         ["タイトル、投稿者、投稿日時", "いいね · 保存 · コメント · シェア", "カバー、プロフィール、全画像のリンク"]),
    ],
    "how_h": "3 ステップ",
    "steps": [
        ("browser", "fill-sky", "小紅書を開く", "ホーム、検索結果、プロフィール、コレクション、または任意の投稿。"),
        ("click", "fill-pink", "拡張機能のアイコンをクリック", "「ノート一覧を出力」か「投稿をダウンロード」を選びます。一覧ページではスクロールを続けるとさらに集まります。"),
        ("saved", "fill-mint", "出力・ダウンロード", "「CSV を出力」で表を保存、または画像と動画を選んでダウンロード。「クリア」でやり直せます。"),
    ],
    "priv_h": "ノートは手元だけに",
    "privs": [
        ("lock", "fill-yellow", "アカウント不要", "登録は不要で、小紅書のアカウント情報も読み取りません。"),
        ("cloudoff", "fill-sky", "保存した内容はアップロードしない", "ノート、画像、動画が私たちのサーバーを通ることはありません。受け取るのはオフにできる匿名の利用回数だけです。"),
        ("shield", "fill-mint", "公開コンテンツのみ", "閲覧中の小紅書ページにすでに表示されているノートだけを読み取ります。"),
    ],
    "priv_more": "プライバシーポリシー全文を読む",
    "faq_h": "よくある質問",
    "faqs": [
        ("無料ですか？", "はい。有料機能はなく、アカウント登録も不要です。"),
        ("動画はいつも透かしなしですか？", "透かしなしの元ファイルが取得できる場合は必ずそれを優先します。取得できない一部の投稿では通常の動画ストリームに切り替わり、その場合は透かしが入ることがあります。"),
        ("CSV に空の列があるのはなぜ？", "保存・コメント・シェア数と投稿日時がすべてそろうのは検索結果だけで、ホームフィードとプロフィールはいいね数のみです。小紅書から返されなかった値は 0 で埋めずに空欄にしているので、空欄は「データなし」を意味し、0 件ではありません。"),
        ("収集したノートはどこに保存されますか？", "現在のタブの中だけです。タブを閉じるか「クリア」を押すと消えます。出力した CSV やダウンロードしたファイルはパソコンのダウンロードフォルダに保存され、どこにもアップロードされません。"),
        ("対応サイトとブラウザは？", "xiaohongshu.com と rednote.com の両方に対応しています。Chrome 向けですが、Edge や Brave などの Chromium 系ブラウザでも、たいてい Chrome ウェブストアからインストールできます。"),
    ],
    "close_h": "さっそく試す", "close_p": "インストールしたら、小紅書の投稿を開いて拡張機能のアイコンをクリックするだけ。",
    "foot_desc": "小紅書の画像と動画を保存し、ノート一覧を CSV に出力する無料の Chrome 拡張機能。",
    "foot_product": ("製品", ["機能", "画面", "使い方"]),
    "foot_help": ("ヘルプ", ["よくある質問", "プライバシーポリシー", "help@lab115.com"]),
    "foot_more": ("その他", "https://lab115.com", "Made by LAB115"),
    "disclaimer": "RedNote Exporter は小紅書（RED / RedNote）と提携しておらず、承認や許可も受けていません。公開されているコンテンツのみを扱い、個人利用および研究目的を想定しています。",
    "notfound": "ページが見つかりません", "back": "ホームへ戻る",
    "privacy_title": "プライバシーポリシー - RedNote Exporter",
    "privacy_description": "RedNote Exporter はノート、画像、動画をブラウザ内にとどめ、オフにできる匿名の利用回数だけを送信します。",
    "privacy": """<h1>プライバシーポリシー</h1>
      <p class="updated">Chrome 拡張機能「RedNote Exporter」 · 最終更新：2026 年 11 月 13 日</p>
      <p class="updated">このページは翻訳版です。内容に相違がある場合は<a href="/privacy/" hreflang="en" lang="en">英語版</a>が優先します。</p>

      <div class="summary">
        <p><strong>要点：</strong>収集・ダウンロードしたノート、画像、動画がブラウザの外に出ることはありません。何を優先して改善するかを知るため、拡張機能は匿名の利用回数（どの機能がどれくらい使われたか）を私たちが自前で運用する統計サーバーに送ります。ノートの内容・リンク・アカウント情報は含まれず、拡張機能の ⋯ メニューからオフにできます。</p>
      </div>

      <h2>拡張機能が読み取るもの</h2>
      <p>拡張機能は xiaohongshu.com と rednote.com のページでのみ動作し、それらのページ自身が読み込んだノートデータだけを読み取ります。</p>
      <ul>
        <li><strong>ノート一覧</strong> — ホームフィード、検索結果、プロフィールページ、コレクションが読み込んだノート：タイトル、投稿者、投稿日時、反応数（いいね、保存、コメント、シェア）、カバーと画像のリンク。</li>
        <li><strong>単一の投稿</strong> — ダウンロードやテキストファイル保存のため、開いている投稿の画像・ライブフォト・動画のリンクと、本文、トピック、IP 所在地、反応数。</li>
      </ul>
      <p>これらはすべて、ページ上ですでに公開されている内容です。拡張機能は小紅書のアカウント情報、メッセージ、Cookie、パスワードを読み取らず、小紅書へ独自にリクエストを送ることもありません。閲覧中にページがすでに受け取ったデータを読むだけです。</p>

      <h2>匿名の利用統計</h2>
      <p>実際にどの機能が使われているかを知るため、拡張機能は私たちが自前で運用する統計サーバー（Umami、stats.lab115.com）にいくつかの匿名イベントを送ります。</p>
      <ul>
        <li><strong>送るタイミング：</strong>拡張機能のインストール時と更新時、そしてポップアップを開いたとき、タブを切り替えたとき、ノート一覧を出力したとき、投稿をダウンロードしたとき、一覧をクリアしたとき、元の投稿を開いたとき、表示言語を変えたとき。</li>
        <li><strong>含まれるもの：</strong>今いるページの種類（ホームフィード、検索、プロフィール、投稿、その他）と、xiaohongshu.com か rednote.com か。出力したノートの件数、ダウンロードした画像・動画・Live Photos・テキストファイルの数と開始できなかった数などの件数。動画が透かしなしの元ファイルだったか。表示言語とブラウザの言語。拡張機能のバージョン。インストール時にランダムに作られるインストール ID（利用者数と再利用の有無を数えるため）。</li>
        <li><strong>決して含まないもの：</strong>ノートの ID、リンク、タイトルや本文、投稿者名、検索語、ファイル名、小紅書のアカウント、Cookie、ほかのウェブサイトの閲覧に関する情報。</li>
        <li><strong>通信に伴う情報：</strong>あらゆるウェブリクエストと同じく、統計サーバーには IP アドレスとブラウザの識別情報（User-Agent）が届きます。サーバーはこれらをおおよその国、ブラウザと OS の種類の判定にだけ使い、IP アドレスは保存しません。</li>
        <li><strong>オフにする方法：</strong>拡張機能のポップアップで ⋯ を押し、「匿名の利用統計」をオフにしてください。以後は何も送信されません。</li>
      </ul>
      <p>統計は私たちのサーバーにだけ保存され、拡張機能の改善にのみ使い、販売や共有はしません。</p>

      <h2>アンインストールしたとき</h2>
      <p>拡張機能を削除すると、Chrome がこのサイトの短いページを開き、削除の理由をお聞きします。ページのアドレスには拡張機能のバージョンと、利用統計がオンだった場合はインストール ID が含まれ、回答をそのインストールで使われた機能と結び付けられます。回答は任意です。</p>

      <h2>このウェブサイト</h2>
      <p>rednote.lab115.com は同じ自前の Umami でアクセスを集計しています：閲覧されたページ、参照元サイト、おおよその国、ブラウザと端末の種類、「Chrome に追加」ボタンのクリック。Cookie は使わず、第三者の分析ツールも使いません。</p>

      <h2>データの保存場所</h2>
      <ul>
        <li>収集したノートは現在のタブのメモリ内にのみ存在します。タブを閉じる、再読み込みする、または「クリア」を押すと破棄されます。</li>
        <li>「CSV を出力」や「ダウンロード」を押すと、ブラウザがファイルを直接ダウンロードフォルダに保存します。画像と動画はブラウザが小紅書のメディアサーバーから直接取得し、私たちを経由することはありません。</li>
        <li>拡張機能がローカルに保存するのは 3 つだけです：言語メニューで選んだ表示言語、利用統計のオン・オフ、ランダムなインストール ID。</li>
      </ul>

      <h2>行わないこと</h2>
      <ul>
        <li>収集・ダウンロードしたノート、画像、動画、本文を私たちのサーバーや第三者に送信しません。</li>
        <li>第三者の分析、広告、トラッキングのツールを使用しません。</li>
        <li>データを販売、貸与、共有しません。</li>
        <li>バックグラウンドで何かを収集することはありません。拡張機能が小紅書のページを扱うのは、そのページを閲覧している間だけです。</li>
      </ul>

      <h2>権限</h2>
      <ul>
        <li><code>downloads</code> — 選択した画像と動画をダウンロードフォルダに保存し、時刻と投稿タイトルの名前を付けたサブフォルダにまとめます。</li>
        <li><code>storage</code> — 利用統計の設定とインストール ID を記憶します。</li>
        <li><strong>xiaohongshu.com と rednote.com へのアクセス</strong>（edith と so のサブドメインを含む）— それらのページで動作し、ページが読み込んだノートデータを読み取ります。ほかのサイトでは動作しません。</li>
      </ul>

      <h2>ダウンロードしたコンテンツ</h2>
      <p>この拡張機能でダウンロードまたは出力したコンテンツの権利は、元の作者に帰属します。個人利用および研究目的でのみ使用し、小紅書の利用規約と関連法令を守ってください。RedNote Exporter は小紅書（RED / RedNote）と提携しておらず、承認や許可も受けていません。</p>

      <h2>ポリシーの変更</h2>
      <p>拡張機能のデータの扱いが変わる場合は、このページと上記の日付を更新します。</p>

      <h2>お問い合わせ</h2>
      <p>プライバシーに関するご質問は <a href="mailto:help@lab115.com">help@lab115.com</a> までメールでお寄せください。</p>""",
}

# ------------------------------------------------------------------ Vietnamese
S["vi"] = {
    "path": "/vi/", "hreflang": "vi", "og_locale": "vi_VN", "label": "Tiếng Việt", "shots": "vi",
    "head_comment": "Vietnamese home page (/vi/).",
    "title": "Tải ảnh &amp; video Xiaohongshu (Tiểu Hồng Thư), xuất CSV | RedNote Exporter",
    "description": "Tiện ích Chrome miễn phí: tải mọi ảnh và video của một bài Xiaohongshu (RedNote) chỉ với một cú nhấp — ưu tiên video gốc không logo — và xuất danh sách ghi chú ở trang chủ, kết quả tìm kiếm hoặc trang cá nhân ra CSV. Không cần đăng nhập, ghi chú không rời khỏi trình duyệt.",
    "og_site_name": "RedNote Exporter",
    "og_title": "Tải ảnh &amp; video Xiaohongshu, xuất danh sách ghi chú ra CSV",
    "og_description": "Tải ảnh và video của bài Xiaohongshu chỉ một cú nhấp, xuất danh sách ghi chú ra CSV. Miễn phí, không cần đăng nhập, xử lý trong trình duyệt.",
    "app_name": "RedNote Exporter", "app_alt": "Tải ảnh & video Xiaohongshu",
    "app_description": "Tải mọi ảnh và video của một bài Xiaohongshu (RedNote) chỉ với một cú nhấp, và xuất danh sách ghi chú ở trang chủ, kết quả tìm kiếm hoặc trang cá nhân ra CSV.",
    "brand": "RedNote Exporter", "nav_label": "Trang", "lang_label": "Ngôn ngữ",
    "nav": [("#features", "Tính năng"), ("#preview", "Giao diện"), ("#how", "Cách dùng"), ("#faq", "Hỏi đáp")],
    "add": "Thêm vào Chrome",
    "hero_title": "Lưu Xiaohongshu chỉ với <mark>một&nbsp;cú&nbsp;nhấp</mark>",
    "hero_sub": "Tải ảnh &amp; video của bài viết · Xuất danh sách ghi chú ra CSV<br>Miễn phí · Không cần đăng ký · Ghi chú không rời khỏi trình duyệt",
    "hero_how": "Xem cách dùng",
    "hero_tags": ["#Video không logo", "#Ảnh Live", "#Tìm kiếm", "#Trang cá nhân", "#Xuất CSV"],
    "feat_h": "Tính năng",
    "feats": [
        ("post", "fill-sky", "Tải trọn một bài", "Chọn ảnh, video và nội dung bạn muốn — ảnh Live giữ cả đoạn chuyển động, video ưu tiên bản gốc không logo."),
        ("folder", "fill-yellow", "Mỗi bài một thư mục", "Đặt tên theo thời gian và tiêu đề, tệp đánh số theo thứ tự, không ghi đè."),
        ("list", "fill-mint", "Thu thập khi cuộn", "Trang chủ, tìm kiếm, trang cá nhân hay mục đã lưu — mọi ghi chú bạn lướt qua đều được gom lại, không trùng."),
        ("csv", "fill-lilac", "Xuất ra CSV", "Mở trong Excel, Numbers hoặc Google Sheets, có tiêu đề, tác giả và số tương tác."),
    ],
    "pv_h": "Xem giao diện", "pv_label": "Màn hình",
    "pv": [
        ("post", "Tải bài viết", "Thẻ Tải bài viết liệt kê video và tất cả ảnh của bài, mỗi mục có ô chọn",
         "Mọi ảnh &amp; video, lưu chỉ <mark>một&nbsp;cú&nbsp;nhấp</mark>", "Mở bất kỳ bài Xiaohongshu nào, chọn những gì bạn muốn và tải tất cả vào một thư mục.",
         ["Ưu tiên video gốc không logo", "Lưu cả ảnh Live và nội dung (note.txt)", "Chỉ chọn những tệp bạn cần"]),
        ("folder", "Tự sắp xếp", "Thư mục Downloads: một thư mục đặt tên theo thời gian và tiêu đề bài, chứa video-1.mp4 và image-1 đến image-9",
         "Một bài viết, <mark>một&nbsp;thư&nbsp;mục</mark>", "Mỗi lần tải vào một thư mục đặt tên theo thời gian và tiêu đề bài, tệp được đánh số theo thứ tự.",
         ["Thư mục theo thời gian + tiêu đề", "Tệp đánh số image-1, image-2…", "Không bao giờ ghi đè tệp cũ"]),
        ("list", "Danh sách", "Thẻ Xuất danh sách ghi chú: đã thu thập 128 ghi chú, mỗi mục có tiêu đề, tác giả, số thích, lưu, bình luận và ngày",
         "Cuộn là thu thập, xuất <mark>bất cứ lúc nào</mark>", "Lướt trang chủ, kết quả tìm kiếm hoặc trang cá nhân — mọi ghi chú bạn lướt qua đều được thu thập và loại trùng.",
         ["Trang chủ · Tìm kiếm · Cá nhân · Đã lưu", "Tự loại trùng, đếm theo thời gian thực", "Tiêu đề, tác giả và số tương tác"]),
        ("csv", "CSV", "Tệp CSV đã xuất mở trong bảng tính, với các cột Title, Author Name, Publish Time, Like Count, Collect Count",
         "Bảng tính gọn gàng, <mark>sẵn sàng</mark> phân tích", "Mở ngay trong Excel, Numbers hoặc Google Sheets — tiện cho nghiên cứu nội dung và theo dõi đối thủ.",
         ["Tiêu đề, tác giả, ngày đăng", "Thích · lưu · bình luận · chia sẻ", "Ảnh bìa, trang tác giả, mọi liên kết ảnh"]),
    ],
    "how_h": "Ba bước",
    "steps": [
        ("browser", "fill-sky", "Mở Xiaohongshu", "Trang chủ, kết quả tìm kiếm, trang cá nhân, mục đã lưu hoặc một bài viết bất kỳ."),
        ("click", "fill-pink", "Nhấp vào biểu tượng", "Chọn Xuất danh sách ghi chú hoặc Tải bài viết. Ở trang danh sách, cứ cuộn tiếp để thu thập thêm."),
        ("saved", "fill-mint", "Xuất hoặc tải xuống", "Nhấp Xuất CSV để lưu bảng tính, hoặc chọn ảnh và video rồi tải xuống. Xóa để bắt đầu lại."),
    ],
    "priv_h": "Ghi chú ở lại với bạn",
    "privs": [
        ("lock", "fill-yellow", "Không cần tài khoản", "Tiện ích không cần đăng ký và không bao giờ đọc thông tin tài khoản Xiaohongshu của bạn."),
        ("cloudoff", "fill-sky", "Nội dung đã lưu không bị tải lên", "Ghi chú, ảnh và video không đi qua máy chủ của chúng tôi. Chúng tôi chỉ nhận số lần sử dụng ẩn danh, và bạn có thể tắt."),
        ("shield", "fill-mint", "Chỉ nội dung công khai", "Tiện ích chỉ đọc những ghi chú đã hiển thị trên trang Xiaohongshu bạn đang xem."),
    ],
    "priv_more": "Đọc toàn bộ chính sách quyền riêng tư",
    "faq_h": "Câu hỏi thường gặp",
    "faqs": [
        ("Có miễn phí không?", "Có. Không có tính năng trả phí và không cần tạo tài khoản."),
        ("Video lúc nào cũng không có logo?", "Tiện ích luôn tải video gốc không logo khi có thể. Với một số ít bài không lấy được bản gốc, tiện ích chuyển sang luồng video thông thường, khi đó video có thể có logo."),
        ("Vì sao một số cột trong CSV bị trống?", "Chỉ kết quả tìm kiếm trả về đầy đủ số lưu, bình luận, chia sẻ và thời gian đăng; trang chủ và trang cá nhân chỉ trả về số thích. Những cột Xiaohongshu không trả về được để trống chứ không điền 0, nên ô trống nghĩa là “không có dữ liệu”, không phải bằng không."),
        ("Ghi chú thu thập được lưu ở đâu?", "Chỉ trong thẻ hiện tại. Đóng thẻ hoặc nhấp Xóa là chúng mất. Tệp CSV đã xuất và tệp đã tải nằm trong thư mục Tải xuống của bạn và không bao giờ được tải lên đâu cả."),
        ("Hỗ trợ trang web và trình duyệt nào?", "Cả xiaohongshu.com và rednote.com. Tiện ích được làm cho Chrome; các trình duyệt nhân Chromium như Edge và Brave thường cũng cài được từ Cửa hàng Chrome trực tuyến."),
    ],
    "close_h": "Dùng thử ngay", "close_p": "Cài xong, mở một bài Xiaohongshu bất kỳ và nhấp vào biểu tượng tiện ích.",
    "foot_desc": "Tiện ích Chrome miễn phí để lưu ảnh và video Xiaohongshu và xuất danh sách ghi chú ra CSV.",
    "foot_product": ("Sản phẩm", ["Tính năng", "Giao diện", "Cách dùng"]),
    "foot_help": ("Trợ giúp", ["Hỏi đáp", "Quyền riêng tư", "help@lab115.com"]),
    "foot_more": ("Thêm", "https://lab115.com", "Made by LAB115"),
    "disclaimer": "RedNote Exporter không liên kết với, không được xác nhận hay cho phép bởi Xiaohongshu (RedNote). Tiện ích chỉ xử lý nội dung công khai và dành cho mục đích cá nhân, nghiên cứu.",
    "notfound": "Không tìm thấy trang", "back": "Về trang chủ",
    "privacy_title": "Chính sách quyền riêng tư - RedNote Exporter",
    "privacy_description": "RedNote Exporter giữ ghi chú, ảnh và video trong trình duyệt của bạn. Nó chỉ gửi số lần sử dụng ẩn danh, và bạn có thể tắt.",
    "privacy": """<h1>Chính sách quyền riêng tư</h1>
      <p class="updated">Dành cho tiện ích Chrome “RedNote Exporter” · Cập nhật lần cuối: 13 tháng 11, 2026</p>
      <p class="updated">Đây là bản dịch. Nếu có khác biệt, <a href="/privacy/" hreflang="en" lang="en">bản tiếng Anh</a> là bản có hiệu lực.</p>

      <div class="summary">
        <p><strong>Tóm lại:</strong> ghi chú, ảnh và video bạn thu thập hay tải xuống không bao giờ rời khỏi trình duyệt. Tiện ích gửi số lần sử dụng ẩn danh (tính năng nào được dùng và dùng bao nhiêu lần) đến máy chủ thống kê do chúng tôi tự vận hành, để biết cần cải thiện gì trước. Dữ liệu này không chứa nội dung ghi chú, liên kết hay tài khoản, và bạn có thể tắt nó trong menu ⋯ của tiện ích.</p>
      </div>

      <h2>Tiện ích đọc những gì</h2>
      <p>Tiện ích chỉ chạy trên các trang xiaohongshu.com và rednote.com, và chỉ đọc dữ liệu ghi chú mà chính các trang đó tải về:</p>
      <ul>
        <li><strong>Danh sách ghi chú</strong> — ghi chú do trang chủ, kết quả tìm kiếm, trang cá nhân và mục đã lưu tải: tiêu đề, tác giả, thời gian đăng, số tương tác (thích, lưu, bình luận, chia sẻ), ảnh bìa và liên kết ảnh.</li>
        <li><strong>Một bài viết</strong> — liên kết ảnh, ảnh Live và video, cùng nội dung, chủ đề, vị trí IP và số tương tác của bài bạn đang mở, để tải xuống hoặc lưu thành tệp văn bản.</li>
      </ul>
      <p>Tất cả đều là nội dung vốn đã hiển thị công khai trên trang. Tiện ích không đọc thông tin tài khoản Xiaohongshu, tin nhắn, cookie hay mật khẩu của bạn, và không bao giờ tự gửi yêu cầu đến Xiaohongshu — nó chỉ đọc dữ liệu mà trang đã nhận được trong lúc bạn duyệt.</p>

      <h2>Thống kê sử dụng ẩn danh</h2>
      <p>Để biết mọi người thực sự dùng những tính năng nào, tiện ích gửi một vài sự kiện ẩn danh đến máy chủ thống kê do chúng tôi tự vận hành (Umami, tại stats.lab115.com):</p>
      <ul>
        <li><strong>Khi nào:</strong> khi cài đặt hoặc cập nhật tiện ích, và khi bạn mở cửa sổ tiện ích, chuyển tab, xuất danh sách ghi chú, tải một bài viết, xóa danh sách, mở bài gốc hoặc đổi ngôn ngữ giao diện.</li>
        <li><strong>Một sự kiện gồm:</strong> loại trang bạn đang xem (trang chủ, tìm kiếm, trang cá nhân, một bài viết hoặc khác) và đó là xiaohongshu.com hay rednote.com; các con số như đã xuất bao nhiêu ghi chú, đã tải bao nhiêu ảnh, video, Live Photo và tệp văn bản và bao nhiêu tệp không bắt đầu tải được; video có phải bản gốc không logo hay không; ngôn ngữ giao diện và ngôn ngữ trình duyệt; phiên bản tiện ích; và một mã cài đặt ngẫu nhiên tạo ra khi cài, dùng để đếm số người dùng và xem họ có quay lại không.</li>
        <li><strong>Không bao giờ gồm:</strong> mã ghi chú, liên kết, tiêu đề hay nội dung, tên tác giả, từ khóa tìm kiếm, tên tệp, tài khoản Xiaohongshu của bạn, cookie, hay bất cứ điều gì về các trang web khác bạn truy cập.</li>
        <li><strong>Thông tin mạng:</strong> như mọi yêu cầu web, máy chủ thống kê nhận được địa chỉ IP và thông tin trình duyệt (user agent) của bạn. Máy chủ chỉ dùng chúng để suy ra quốc gia gần đúng, loại trình duyệt và hệ điều hành, và không lưu địa chỉ IP.</li>
        <li><strong>Cách tắt:</strong> nhấn ⋯ trong cửa sổ tiện ích và tắt “Thống kê sử dụng ẩn danh”. Từ đó trở đi không có gì được gửi.</li>
      </ul>
      <p>Dữ liệu thống kê chỉ nằm trên máy chủ của chúng tôi, chỉ dùng để cải thiện tiện ích, và không bao giờ được bán hay chia sẻ.</p>

      <h2>Khi bạn gỡ cài đặt</h2>
      <p>Sau khi tiện ích bị gỡ, Chrome mở một trang ngắn trên website này để hỏi lý do. Địa chỉ trang có phiên bản tiện ích và, nếu thống kê sử dụng đang bật, mã cài đặt, để câu trả lời có thể gắn với những tính năng mà lượt cài đặt đó đã dùng. Bạn không bắt buộc phải trả lời.</p>

      <h2>Website này</h2>
      <p>rednote.lab115.com đếm lượt truy cập bằng cùng hệ thống Umami tự vận hành: các trang được xem, trang giới thiệu, quốc gia gần đúng, loại trình duyệt và thiết bị, và số lần nhấn nút “Thêm vào Chrome”. Website không đặt cookie và không dùng công cụ phân tích của bên thứ ba.</p>

      <h2>Dữ liệu được lưu ở đâu</h2>
      <ul>
        <li>Ghi chú thu thập được chỉ nằm trong bộ nhớ của thẻ hiện tại. Đóng hoặc tải lại thẻ, hoặc nhấp Xóa, sẽ loại bỏ chúng.</li>
        <li>Khi bạn nhấp Xuất CSV hoặc Tải xuống, trình duyệt lưu tệp thẳng vào thư mục Tải xuống. Ảnh và video do trình duyệt tải trực tiếp từ máy chủ đa phương tiện của Xiaohongshu, không bao giờ đi qua chúng tôi.</li>
        <li>Tiện ích chỉ lưu ba thứ nhỏ trên máy: ngôn ngữ giao diện bạn chọn trong menu ngôn ngữ, thống kê sử dụng có đang bật không, và mã cài đặt ngẫu nhiên.</li>
      </ul>

      <h2>Những điều chúng tôi không làm</h2>
      <ul>
        <li>Không gửi ghi chú, ảnh, video hay văn bản bạn thu thập hoặc tải xuống đến máy chủ của chúng tôi hay bất kỳ ai.</li>
        <li>Không dùng công cụ phân tích, quảng cáo hay theo dõi của bên thứ ba.</li>
        <li>Không bán, cho thuê hay chia sẻ bất kỳ dữ liệu nào.</li>
        <li>Không thu thập gì trong nền. Tiện ích chỉ xử lý một trang Xiaohongshu khi bạn đang xem trang đó.</li>
      </ul>

      <h2>Quyền truy cập</h2>
      <ul>
        <li><code>downloads</code> — lưu ảnh và video bạn chọn vào thư mục Tải xuống, gom vào một thư mục con đặt tên theo thời gian và tiêu đề bài.</li>
        <li><code>storage</code> — ghi nhớ cài đặt thống kê sử dụng và mã cài đặt.</li>
        <li><strong>Truy cập xiaohongshu.com và rednote.com</strong> (bao gồm tên miền phụ edith và so) — cho phép tiện ích chạy trên các trang đó và đọc dữ liệu ghi chú chúng tải về. Tiện ích không chạy trên trang web nào khác.</li>
      </ul>

      <h2>Nội dung bạn tải xuống</h2>
      <p>Nội dung tải xuống hoặc xuất bằng tiện ích này vẫn thuộc quyền của tác giả gốc. Vui lòng chỉ dùng cho mục đích cá nhân và nghiên cứu, đồng thời tuân thủ điều khoản dịch vụ của Xiaohongshu và pháp luật hiện hành. RedNote Exporter không liên kết với, không được xác nhận hay cho phép bởi Xiaohongshu (RedNote).</p>

      <h2>Thay đổi chính sách</h2>
      <p>Nếu cách tiện ích xử lý dữ liệu thay đổi, chúng tôi sẽ cập nhật trang này và ngày ở trên.</p>

      <h2>Liên hệ</h2>
      <p>Có câu hỏi về quyền riêng tư? Gửi email đến <a href="mailto:help@lab115.com">help@lab115.com</a>.</p>""",
}

# --------------------------------------------------------------- uninstall page
# /<lang>/bye/: Chrome opens it after the extension is removed (background.ts,
# setUninstallPage). `reasons` are (key, label); the key is what the stats get,
# so keep keys the same across languages and add new ones at the end.
BYE = {
    "en": {
        "title": "RedNote Exporter removed", "h1": "Sorry to see you go",
        "lead": "What made you remove it? One tap helps us fix it.",
        "reasons": [("not_working", "Downloads or exports didn’t work"), ("missing_feature", "It lacks a feature I need"),
                    ("hard_to_use", "Hard to use or confusing"), ("privacy", "Worried about privacy"),
                    ("one_time", "I only needed it once"), ("found_other", "Switched to another tool"), ("other", "Something else")],
        "more": "Anything else we should know? (optional)", "send": "Send",
        "thanks": "Thanks — we read every answer.", "back": "Changed your mind?", "reinstall": "Add it back to Chrome",
    },
    "zh": {
        "title": "已卸载小红书导出工具", "h1": "很遗憾你要走了",
        "lead": "是什么原因让你卸载了它？点一下就能帮我们改进。",
        "reasons": [("not_working", "下载或导出用不了"), ("missing_feature", "缺少我需要的功能"),
                    ("hard_to_use", "不好用，看不懂"), ("privacy", "担心隐私"),
                    ("one_time", "只是临时用一下"), ("found_other", "换了别的工具"), ("other", "其他原因")],
        "more": "还有什么想告诉我们的？（选填）", "send": "提交",
        "thanks": "谢谢，每条反馈我们都会看。", "back": "改变主意了？", "reinstall": "重新添加到 Chrome",
    },
    "zh-tw": {
        "title": "已移除小紅書匯出工具", "h1": "很遺憾你要離開了",
        "lead": "是什麼原因讓你移除了它？點一下就能幫我們改進。",
        "reasons": [("not_working", "下載或匯出無法使用"), ("missing_feature", "缺少我需要的功能"),
                    ("hard_to_use", "不好用，看不懂"), ("privacy", "擔心隱私"),
                    ("one_time", "只是臨時用一下"), ("found_other", "換了別的工具"), ("other", "其他原因")],
        "more": "還有什麼想告訴我們的？（選填）", "send": "送出",
        "thanks": "謝謝，每則回饋我們都會看。", "back": "改變主意了？", "reinstall": "重新加到 Chrome",
    },
    "ko": {
        "title": "RedNote Exporter 제거됨", "h1": "떠나신다니 아쉽습니다",
        "lead": "제거하신 이유가 무엇인가요? 한 번만 눌러 주시면 개선에 큰 도움이 됩니다.",
        "reasons": [("not_working", "다운로드나 내보내기가 안 됨"), ("missing_feature", "필요한 기능이 없음"),
                    ("hard_to_use", "쓰기 어렵거나 헷갈림"), ("privacy", "개인정보가 걱정됨"),
                    ("one_time", "한 번만 필요했음"), ("found_other", "다른 도구로 바꿈"), ("other", "기타")],
        "more": "더 알려 주실 내용이 있나요? (선택)", "send": "보내기",
        "thanks": "감사합니다. 모든 답변을 읽고 있습니다.", "back": "마음이 바뀌셨나요?", "reinstall": "Chrome에 다시 추가",
    },
    "ja": {
        "title": "RedNote Exporter を削除しました", "h1": "ご利用ありがとうございました",
        "lead": "削除した理由を教えてください。ワンタップで改善に役立ちます。",
        "reasons": [("not_working", "ダウンロードや出力がうまくいかない"), ("missing_feature", "欲しい機能がない"),
                    ("hard_to_use", "使いにくい・わかりにくい"), ("privacy", "プライバシーが心配"),
                    ("one_time", "一度だけ使いたかった"), ("found_other", "別のツールに乗り換えた"), ("other", "その他")],
        "more": "ほかに伝えたいことはありますか？（任意）", "send": "送信",
        "thanks": "ありがとうございます。いただいた回答はすべて読んでいます。", "back": "気が変わりましたか？", "reinstall": "Chrome にもう一度追加",
    },
    "vi": {
        "title": "Đã gỡ RedNote Exporter", "h1": "Tiếc là bạn rời đi",
        "lead": "Vì sao bạn gỡ tiện ích? Chỉ một lần nhấn cũng giúp chúng tôi cải thiện.",
        "reasons": [("not_working", "Tải xuống hoặc xuất không hoạt động"), ("missing_feature", "Thiếu tính năng tôi cần"),
                    ("hard_to_use", "Khó dùng hoặc khó hiểu"), ("privacy", "Lo ngại về quyền riêng tư"),
                    ("one_time", "Tôi chỉ cần dùng một lần"), ("found_other", "Đã chuyển sang công cụ khác"), ("other", "Lý do khác")],
        "more": "Bạn còn muốn nói gì thêm không? (không bắt buộc)", "send": "Gửi",
        "thanks": "Cảm ơn bạn, chúng tôi đọc mọi câu trả lời.", "back": "Bạn đổi ý?", "reinstall": "Thêm lại vào Chrome",
    },
}
