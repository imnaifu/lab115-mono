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
    "description": "Free Chrome extension: download every image and video from a RedNote (Xiaohongshu) post in one click — watermark-free video when available — and export the home feed, search results or a profile to CSV. No login, everything stays in your browser.",
    "og_site_name": "RedNote Exporter",
    "og_title": "RedNote Exporter - Save RedNote images &amp; videos, export notes to CSV",
    "og_description": "Download a RedNote post's images and video in one click, and export note lists to CSV. Free, no login, 100% local.",
    "app_name": "RedNote Exporter", "app_alt": "小红书导出工具",
    "app_description": "Download every image and video from a RedNote (Xiaohongshu) post in one click, and export the home feed, search results or a profile's notes to CSV.",
    "brand": "RedNote Exporter", "nav_label": "Page", "lang_label": "Language",
    "nav": [("#features", "Features"), ("#preview", "Preview"), ("#how", "How it works"), ("#faq", "FAQ")],
    "add": "Add to Chrome",
    "hero_title": "RedNote, saved in <mark>one&nbsp;click</mark>",
    "hero_sub": "Download a post's images &amp; video · Export note lists to CSV<br>Free · No sign-up · Runs entirely in your browser",
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
    "priv_h": "Your data stays with you",
    "privs": [
        ("lock", "fill-yellow", "No account", "The extension has no sign-up and never reads your RedNote account details."),
        ("cloudoff", "fill-sky", "No external servers", "Capturing, exporting and downloading all happen in your browser. Nothing is sent to us or anyone else."),
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
    "privacy_description": "RedNote Exporter collects, stores and transmits no personal data. Everything happens inside your browser.",
    "privacy": """<h1>Privacy Policy</h1>
      <p class="updated">For the Chrome extension “RedNote Exporter” · Last updated: November 7, 2026</p>

      <div class="summary">
        <p><strong>In short:</strong> this extension collects, stores and transmits no personal data. It has no server, no accounts, and no analytics or tracking code. Everything happens inside your own browser.</p>
      </div>

      <h2>What the extension reads</h2>
      <p>The extension runs only on xiaohongshu.com and rednote.com pages, and only reads the note data those pages load themselves:</p>
      <ul>
        <li><strong>Note lists</strong> — notes loaded by the home feed, search results, profile pages and Collections tabs: title, author, publish time, engagement counts (likes, collects, comments, shares), cover and image links.</li>
        <li><strong>A single post</strong> — the image, Live Photo and video links, text, topics, IP location and engagement counts of the post you have open, so they can be downloaded or saved as a text file.</li>
      </ul>
      <p>All of this is content already publicly visible on the page. The extension does not read your RedNote account details, messages, cookies or passwords, and it never sends requests of its own to RedNote — it only reads data the page has already received while you browse.</p>

      <h2>Where data is kept</h2>
      <ul>
        <li>Captured notes live only in the memory of the current tab. Closing or reloading the tab, or clicking Clear, discards them.</li>
        <li>When you click Export CSV or Download, your browser saves the files straight to your Downloads folder. Images and video are fetched by your browser directly from RedNote's media servers, never through us.</li>
        <li>The only thing the extension remembers locally is one setting: the interface language you picked from its language menu.</li>
      </ul>

      <h2>What we don't do</h2>
      <ul>
        <li>We do not send any data to our servers or to any third party.</li>
        <li>We do not use analytics, advertising or tracking tools.</li>
        <li>We do not sell, rent or share any data.</li>
        <li>We do not collect anything in the background. The extension only handles a RedNote page while you are browsing it.</li>
      </ul>

      <h2>Permissions</h2>
      <ul>
        <li><code>downloads</code> — saves the images and video you select to your Downloads folder, grouped into one sub-folder named after the time and post title.</li>
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
    "description": "免费 Chrome 扩展：一键下载小红书笔记的全部图片与视频（视频优先无水印原片），把首页推荐、搜索结果、用户主页的笔记列表导出为 CSV。无需登录，数据只在本地处理。",
    "og_site_name": "小红书导出工具 RedNote Exporter",
    "og_title": "小红书导出工具 - 图片视频一键下载、笔记列表导出 CSV",
    "og_description": "一键下载小红书笔记的图片与视频，笔记列表导出 CSV。免费、无需登录、本地处理。",
    "app_name": "小红书导出工具 (RedNote Exporter)", "app_alt": "RedNote Exporter",
    "app_description": "一键下载小红书笔记的全部图片与视频，并将首页推荐、搜索结果、用户主页的笔记列表导出为 CSV。",
    "brand": "小红书导出工具", "nav_label": "页面导航", "lang_label": "语言",
    "nav": [("#features", "功能"), ("#preview", "预览"), ("#how", "用法"), ("#faq", "常见问题")],
    "add": "添加到 Chrome",
    "hero_title": "小红书笔记，<mark>一键</mark>带走",
    "hero_sub": "图片视频一键下载 · 笔记列表导出 CSV<br>免费 · 无需登录 · 全程在你的浏览器里完成",
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
    "priv_h": "数据只留在本地",
    "privs": [
        ("lock", "fill-yellow", "不用注册", "扩展没有账号体系，也不读取你的小红书账号信息。"),
        ("cloudoff", "fill-sky", "不连外部服务器", "采集、导出、下载都在浏览器里完成，没有任何数据发给我们或第三方。"),
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
    "privacy_description": "小红书导出工具（RedNote Exporter）不收集、不存储、不传输任何个人数据，所有处理都在你的浏览器里完成。",
    "privacy": """<h1>隐私政策</h1>
      <p class="updated">适用于 Chrome 扩展「小红书导出工具（RedNote Exporter）」 · 最后更新：2026 年 11 月 7 日</p>

      <div class="summary">
        <p><strong>简单说：</strong>本扩展不收集、不存储、不传输任何个人数据。它没有服务器，没有账号体系，也没有统计或追踪代码。所有处理都在你自己的浏览器里完成。</p>
      </div>

      <h2>扩展会读取什么</h2>
      <p>只有当你打开 xiaohongshu.com 或 rednote.com 的页面时，扩展才会运行，并且只读取这些页面本身加载的笔记数据：</p>
      <ul>
        <li><strong>笔记列表</strong>：首页推荐、搜索结果、用户主页、收藏页加载出来的笔记，包括标题、作者、发布时间、互动数（点赞、收藏、评论、分享）、封面和图片链接。</li>
        <li><strong>单篇笔记</strong>：当前打开的笔记的图片、实况图和视频链接，以及正文、话题、IP 属地、互动数等信息，用于下载或保存为文本文件。</li>
      </ul>
      <p>这些都是页面上本来就公开可见的内容。扩展不会读取你的小红书账号信息、私信、Cookie 或密码，也不会自己向小红书发起额外请求，只是读取页面在你浏览时已经收到的数据。</p>

      <h2>数据存在哪里</h2>
      <ul>
        <li>采集到的笔记只保存在当前标签页的内存里。关闭标签页、刷新页面或点「清空」后就会丢弃。</li>
        <li>你点「导出 CSV」或「下载」时，文件直接由浏览器保存到你电脑的下载文件夹。图片和视频由浏览器从小红书的图片、视频服务器直接下载，不经过我们。</li>
        <li>扩展只在本地记住一项设置：你在语言菜单里选择的界面语言。</li>
      </ul>

      <h2>我们不做的事</h2>
      <ul>
        <li>不把任何数据发送到我们或任何第三方的服务器。</li>
        <li>不使用统计、广告或追踪工具。</li>
        <li>不出售、不出租、不分享任何数据。</li>
        <li>不在后台主动采集。只有你在浏览小红书页面时，扩展才会处理该页面的数据。</li>
      </ul>

      <h2>权限说明</h2>
      <ul>
        <li><code>downloads</code>：把你选中的图片、视频保存到下载文件夹，并按「时间 + 笔记标题」放进同一个子文件夹。</li>
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
    "description": "免費 Chrome 擴充功能：一鍵下載小紅書筆記的全部圖片與影片（影片優先無浮水印原檔），把首頁推薦、搜尋結果、使用者主頁的筆記列表匯出為 CSV。不需登入，資料只在本機處理。",
    "og_site_name": "小紅書匯出工具 RedNote Exporter",
    "og_title": "小紅書下載器 - 圖片影片一鍵下載、筆記列表匯出 CSV",
    "og_description": "一鍵下載小紅書筆記的圖片與影片，筆記列表匯出 CSV。免費、不需登入、本機處理。",
    "app_name": "小紅書匯出工具 (RedNote Exporter)", "app_alt": "RedNote Exporter",
    "app_description": "一鍵下載小紅書筆記的全部圖片與影片，並將首頁推薦、搜尋結果、使用者主頁的筆記列表匯出為 CSV。",
    "brand": "小紅書匯出工具", "nav_label": "頁面導覽", "lang_label": "語言",
    "nav": [("#features", "功能"), ("#preview", "預覽"), ("#how", "用法"), ("#faq", "常見問題")],
    "add": "加到 Chrome",
    "hero_title": "小紅書筆記，<mark>一鍵</mark>帶走",
    "hero_sub": "圖片影片一鍵下載 · 筆記列表匯出 CSV<br>免費 · 不需登入 · 全程在你的瀏覽器裡完成",
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
    "priv_h": "資料只留在本機",
    "privs": [
        ("lock", "fill-yellow", "不用註冊", "擴充功能沒有帳號系統，也不讀取你的小紅書帳號資訊。"),
        ("cloudoff", "fill-sky", "不連外部伺服器", "收集、匯出、下載都在瀏覽器裡完成，沒有任何資料傳給我們或第三方。"),
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
    "privacy_description": "小紅書匯出工具（RedNote Exporter）不收集、不儲存、不傳送任何個人資料，所有處理都在你的瀏覽器裡完成。",
    "privacy": """<h1>隱私權政策</h1>
      <p class="updated">適用於 Chrome 擴充功能「小紅書匯出工具（RedNote Exporter）」 · 最後更新：2026 年 11 月 7 日</p>
      <p class="updated">本頁為翻譯版本，內容如有出入，以<a href="/privacy/" hreflang="en" lang="en">英文版</a>為準。</p>

      <div class="summary">
        <p><strong>簡單說：</strong>本擴充功能不收集、不儲存、不傳送任何個人資料。它沒有伺服器，沒有帳號系統，也沒有統計或追蹤程式碼。所有處理都在你自己的瀏覽器裡完成。</p>
      </div>

      <h2>擴充功能會讀取什麼</h2>
      <p>只有當你打開 xiaohongshu.com 或 rednote.com 的頁面時，擴充功能才會執行，並且只讀取這些頁面本身載入的筆記資料：</p>
      <ul>
        <li><strong>筆記列表</strong>：首頁推薦、搜尋結果、使用者主頁、收藏頁載入的筆記，包括標題、作者、發布時間、互動數（按讚、收藏、留言、分享）、封面和圖片連結。</li>
        <li><strong>單篇筆記</strong>：目前開啟的筆記的圖片、實況照片和影片連結，以及內文、話題、IP 屬地、互動數等資訊，用於下載或儲存為文字檔。</li>
      </ul>
      <p>這些都是頁面上本來就公開可見的內容。擴充功能不會讀取你的小紅書帳號資訊、私訊、Cookie 或密碼，也不會自己向小紅書發出額外請求，只是讀取頁面在你瀏覽時已經收到的資料。</p>

      <h2>資料存在哪裡</h2>
      <ul>
        <li>收集到的筆記只儲存在目前分頁的記憶體裡。關閉分頁、重新整理頁面或點「清空」後就會捨棄。</li>
        <li>你點「匯出 CSV」或「下載」時，檔案直接由瀏覽器儲存到你電腦的下載資料夾。圖片和影片由瀏覽器從小紅書的圖片、影片伺服器直接下載，不經過我們。</li>
        <li>擴充功能只在本機記住一項設定：你在語言選單裡選擇的介面語言。</li>
      </ul>

      <h2>我們不做的事</h2>
      <ul>
        <li>不把任何資料傳送到我們或任何第三方的伺服器。</li>
        <li>不使用統計、廣告或追蹤工具。</li>
        <li>不出售、不出租、不分享任何資料。</li>
        <li>不在背景主動收集。只有你在瀏覽小紅書頁面時，擴充功能才會處理該頁面的資料。</li>
      </ul>

      <h2>權限說明</h2>
      <ul>
        <li><code>downloads</code>：把你選取的圖片、影片儲存到下載資料夾，並依「時間 + 筆記標題」放進同一個子資料夾。</li>
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
    "description": "무료 Chrome 확장 프로그램: 샤오홍슈(RedNote) 게시물의 이미지와 동영상을 한 번에 다운로드하고(동영상은 워터마크 없는 원본 우선), 홈 피드·검색 결과·프로필의 노트 목록을 CSV로 내보냅니다. 로그인 불필요, 모든 처리는 브라우저 안에서.",
    "og_site_name": "RedNote Exporter",
    "og_title": "샤오홍슈 다운로더 - 이미지·동영상 저장, 노트 목록 CSV 내보내기",
    "og_description": "샤오홍슈 게시물의 이미지와 동영상을 한 번에 저장하고 노트 목록을 CSV로 내보내세요. 무료, 로그인 불필요, 100% 로컬 처리.",
    "app_name": "RedNote Exporter", "app_alt": "샤오홍슈 다운로더",
    "app_description": "샤오홍슈(RedNote) 게시물의 이미지와 동영상을 한 번에 다운로드하고, 홈 피드·검색 결과·프로필의 노트 목록을 CSV로 내보냅니다.",
    "brand": "RedNote Exporter", "nav_label": "페이지", "lang_label": "언어",
    "nav": [("#features", "기능"), ("#preview", "미리보기"), ("#how", "사용법"), ("#faq", "FAQ")],
    "add": "Chrome에 추가",
    "hero_title": "샤오홍슈 노트, <mark>한 번에</mark> 저장",
    "hero_sub": "게시물 이미지·동영상 다운로드 · 노트 목록 CSV 내보내기<br>무료 · 가입 불필요 · 모든 처리는 브라우저 안에서",
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
    "priv_h": "데이터는 내 컴퓨터에만",
    "privs": [
        ("lock", "fill-yellow", "계정 불필요", "가입 절차가 없고 샤오홍슈 계정 정보도 읽지 않습니다."),
        ("cloudoff", "fill-sky", "외부 서버 없음", "수집, 내보내기, 다운로드가 모두 브라우저 안에서 이뤄지며 어떤 데이터도 외부로 보내지 않습니다."),
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
    "privacy_description": "RedNote Exporter는 개인 데이터를 수집·저장·전송하지 않습니다. 모든 처리는 브라우저 안에서 이루어집니다.",
    "privacy": """<h1>개인정보처리방침</h1>
      <p class="updated">Chrome 확장 프로그램 「RedNote Exporter」 · 최종 업데이트: 2026년 11월 7일</p>
      <p class="updated">이 페이지는 번역본입니다. 내용이 다를 경우 <a href="/privacy/" hreflang="en" lang="en">영어 원문</a>이 우선합니다.</p>

      <div class="summary">
        <p><strong>요약:</strong> 이 확장 프로그램은 개인 데이터를 수집, 저장, 전송하지 않습니다. 서버도, 계정도, 분석이나 추적 코드도 없습니다. 모든 처리는 사용자의 브라우저 안에서 이루어집니다.</p>
      </div>

      <h2>확장 프로그램이 읽는 정보</h2>
      <p>확장 프로그램은 xiaohongshu.com과 rednote.com 페이지에서만 실행되며, 해당 페이지가 스스로 불러온 노트 데이터만 읽습니다.</p>
      <ul>
        <li><strong>노트 목록</strong> — 홈 피드, 검색 결과, 프로필 페이지와 저장 탭이 불러온 노트: 제목, 작성자, 게시 시간, 반응 수(좋아요, 저장, 댓글, 공유), 커버와 이미지 링크.</li>
        <li><strong>단일 게시물</strong> — 다운로드하거나 텍스트 파일로 저장하기 위해, 현재 열려 있는 게시물의 이미지·라이브 포토·동영상 링크와 본문, 주제, IP 위치, 반응 수.</li>
      </ul>
      <p>이 모든 정보는 페이지에 이미 공개적으로 보이는 콘텐츠입니다. 확장 프로그램은 샤오홍슈 계정 정보, 메시지, 쿠키, 비밀번호를 읽지 않으며, 샤오홍슈에 별도의 요청을 보내지 않습니다. 사용자가 탐색하는 동안 페이지가 이미 받은 데이터만 읽습니다.</p>

      <h2>데이터 보관 위치</h2>
      <ul>
        <li>수집한 노트는 현재 탭의 메모리에만 있습니다. 탭을 닫거나 새로고침하거나 「지우기」를 누르면 삭제됩니다.</li>
        <li>「CSV 내보내기」나 「다운로드」를 누르면 브라우저가 파일을 다운로드 폴더에 바로 저장합니다. 이미지와 동영상은 브라우저가 샤오홍슈 미디어 서버에서 직접 받으며, 저희를 거치지 않습니다.</li>
        <li>확장 프로그램이 로컬에 기억하는 것은 언어 메뉴에서 고른 인터페이스 언어 설정 하나뿐입니다.</li>
      </ul>

      <h2>하지 않는 일</h2>
      <ul>
        <li>어떤 데이터도 저희 서버나 제3자에게 보내지 않습니다.</li>
        <li>분석, 광고, 추적 도구를 사용하지 않습니다.</li>
        <li>어떤 데이터도 판매, 대여, 공유하지 않습니다.</li>
        <li>백그라운드에서 아무것도 수집하지 않습니다. 사용자가 샤오홍슈 페이지를 보는 동안에만 그 페이지를 처리합니다.</li>
      </ul>

      <h2>권한</h2>
      <ul>
        <li><code>downloads</code> — 선택한 이미지와 동영상을 다운로드 폴더에 저장하며, 시간과 게시물 제목으로 이름 붙인 하위 폴더 하나에 모읍니다.</li>
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
    "description": "無料の Chrome 拡張機能：小紅書（RED / RedNote）の投稿の画像と動画をワンクリックで保存（動画は透かしなしの元ファイルを優先）。ホームフィード・検索結果・プロフィールのノート一覧を CSV に出力できます。ログイン不要、処理はすべてブラウザ内で完結。",
    "og_site_name": "RedNote Exporter",
    "og_title": "小紅書ダウンローダー - 画像・動画を一括保存、ノート一覧を CSV 出力",
    "og_description": "小紅書の投稿の画像と動画をワンクリックで保存し、ノート一覧を CSV に出力。無料、ログイン不要、100% ローカル処理。",
    "app_name": "RedNote Exporter", "app_alt": "小紅書ダウンローダー",
    "app_description": "小紅書（RED / RedNote）の投稿の画像と動画をワンクリックで保存し、ホームフィード・検索結果・プロフィールのノート一覧を CSV に出力します。",
    "brand": "RedNote Exporter", "nav_label": "ページ", "lang_label": "言語",
    "nav": [("#features", "機能"), ("#preview", "画面"), ("#how", "使い方"), ("#faq", "よくある質問")],
    "add": "Chrome に追加",
    "hero_title": "小紅書のノートを、<mark>ワンクリック</mark>で保存",
    "hero_sub": "投稿の画像・動画をダウンロード · ノート一覧を CSV 出力<br>無料 · 登録不要 · すべてブラウザ内で完結",
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
    "priv_h": "データは手元だけに",
    "privs": [
        ("lock", "fill-yellow", "アカウント不要", "登録は不要で、小紅書のアカウント情報も読み取りません。"),
        ("cloudoff", "fill-sky", "外部サーバーなし", "収集・出力・ダウンロードはすべてブラウザ内で行われ、データを外部に送ることはありません。"),
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
    "privacy_description": "RedNote Exporter は個人データを収集・保存・送信しません。処理はすべてブラウザ内で行われます。",
    "privacy": """<h1>プライバシーポリシー</h1>
      <p class="updated">Chrome 拡張機能「RedNote Exporter」 · 最終更新：2026 年 11 月 7 日</p>
      <p class="updated">このページは翻訳版です。内容に相違がある場合は<a href="/privacy/" hreflang="en" lang="en">英語版</a>が優先します。</p>

      <div class="summary">
        <p><strong>要約：</strong>この拡張機能は個人データを収集、保存、送信しません。サーバーもアカウントも、分析やトラッキングのコードもありません。すべての処理はお使いのブラウザ内で行われます。</p>
      </div>

      <h2>拡張機能が読み取るもの</h2>
      <p>拡張機能は xiaohongshu.com と rednote.com のページでのみ動作し、それらのページ自身が読み込んだノートデータだけを読み取ります。</p>
      <ul>
        <li><strong>ノート一覧</strong> — ホームフィード、検索結果、プロフィールページ、コレクションが読み込んだノート：タイトル、投稿者、投稿日時、反応数（いいね、保存、コメント、シェア）、カバーと画像のリンク。</li>
        <li><strong>単一の投稿</strong> — ダウンロードやテキストファイル保存のため、開いている投稿の画像・ライブフォト・動画のリンクと、本文、トピック、IP 所在地、反応数。</li>
      </ul>
      <p>これらはすべて、ページ上ですでに公開されている内容です。拡張機能は小紅書のアカウント情報、メッセージ、Cookie、パスワードを読み取らず、小紅書へ独自にリクエストを送ることもありません。閲覧中にページがすでに受け取ったデータを読むだけです。</p>

      <h2>データの保存場所</h2>
      <ul>
        <li>収集したノートは現在のタブのメモリ内にのみ存在します。タブを閉じる、再読み込みする、または「クリア」を押すと破棄されます。</li>
        <li>「CSV を出力」や「ダウンロード」を押すと、ブラウザがファイルを直接ダウンロードフォルダに保存します。画像と動画はブラウザが小紅書のメディアサーバーから直接取得し、私たちを経由することはありません。</li>
        <li>拡張機能がローカルに記憶するのは、言語メニューで選んだ表示言語の設定ひとつだけです。</li>
      </ul>

      <h2>行わないこと</h2>
      <ul>
        <li>データを私たちのサーバーや第三者に送信しません。</li>
        <li>分析、広告、トラッキングのツールを使用しません。</li>
        <li>データを販売、貸与、共有しません。</li>
        <li>バックグラウンドで何かを収集することはありません。拡張機能が小紅書のページを扱うのは、そのページを閲覧している間だけです。</li>
      </ul>

      <h2>権限</h2>
      <ul>
        <li><code>downloads</code> — 選択した画像と動画をダウンロードフォルダに保存し、時刻と投稿タイトルの名前を付けたサブフォルダにまとめます。</li>
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
    "description": "Tiện ích Chrome miễn phí: tải mọi ảnh và video của một bài Xiaohongshu (RedNote) chỉ với một cú nhấp — ưu tiên video gốc không logo — và xuất danh sách ghi chú ở trang chủ, kết quả tìm kiếm hoặc trang cá nhân ra CSV. Không cần đăng nhập, mọi thứ ở lại trong trình duyệt.",
    "og_site_name": "RedNote Exporter",
    "og_title": "Tải ảnh &amp; video Xiaohongshu, xuất danh sách ghi chú ra CSV",
    "og_description": "Tải ảnh và video của bài Xiaohongshu chỉ một cú nhấp, xuất danh sách ghi chú ra CSV. Miễn phí, không cần đăng nhập, xử lý 100% cục bộ.",
    "app_name": "RedNote Exporter", "app_alt": "Tải ảnh & video Xiaohongshu",
    "app_description": "Tải mọi ảnh và video của một bài Xiaohongshu (RedNote) chỉ với một cú nhấp, và xuất danh sách ghi chú ở trang chủ, kết quả tìm kiếm hoặc trang cá nhân ra CSV.",
    "brand": "RedNote Exporter", "nav_label": "Trang", "lang_label": "Ngôn ngữ",
    "nav": [("#features", "Tính năng"), ("#preview", "Giao diện"), ("#how", "Cách dùng"), ("#faq", "Hỏi đáp")],
    "add": "Thêm vào Chrome",
    "hero_title": "Lưu Xiaohongshu chỉ với <mark>một&nbsp;cú&nbsp;nhấp</mark>",
    "hero_sub": "Tải ảnh &amp; video của bài viết · Xuất danh sách ghi chú ra CSV<br>Miễn phí · Không cần đăng ký · Chạy hoàn toàn trong trình duyệt",
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
    "priv_h": "Dữ liệu ở lại với bạn",
    "privs": [
        ("lock", "fill-yellow", "Không cần tài khoản", "Tiện ích không cần đăng ký và không bao giờ đọc thông tin tài khoản Xiaohongshu của bạn."),
        ("cloudoff", "fill-sky", "Không máy chủ ngoài", "Thu thập, xuất và tải xuống đều diễn ra trong trình duyệt. Không gì được gửi cho chúng tôi hay bất kỳ ai."),
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
    "privacy_description": "RedNote Exporter không thu thập, lưu trữ hay truyền bất kỳ dữ liệu cá nhân nào. Mọi xử lý đều diễn ra trong trình duyệt của bạn.",
    "privacy": """<h1>Chính sách quyền riêng tư</h1>
      <p class="updated">Dành cho tiện ích Chrome “RedNote Exporter” · Cập nhật lần cuối: 7 tháng 11, 2026</p>
      <p class="updated">Đây là bản dịch. Nếu có khác biệt, <a href="/privacy/" hreflang="en" lang="en">bản tiếng Anh</a> là bản có hiệu lực.</p>

      <div class="summary">
        <p><strong>Tóm tắt:</strong> tiện ích này không thu thập, lưu trữ hay truyền bất kỳ dữ liệu cá nhân nào. Không có máy chủ, không có tài khoản, không có mã phân tích hay theo dõi. Mọi thứ diễn ra trong trình duyệt của chính bạn.</p>
      </div>

      <h2>Tiện ích đọc những gì</h2>
      <p>Tiện ích chỉ chạy trên các trang xiaohongshu.com và rednote.com, và chỉ đọc dữ liệu ghi chú mà chính các trang đó tải về:</p>
      <ul>
        <li><strong>Danh sách ghi chú</strong> — ghi chú do trang chủ, kết quả tìm kiếm, trang cá nhân và mục đã lưu tải: tiêu đề, tác giả, thời gian đăng, số tương tác (thích, lưu, bình luận, chia sẻ), ảnh bìa và liên kết ảnh.</li>
        <li><strong>Một bài viết</strong> — liên kết ảnh, ảnh Live và video, cùng nội dung, chủ đề, vị trí IP và số tương tác của bài bạn đang mở, để tải xuống hoặc lưu thành tệp văn bản.</li>
      </ul>
      <p>Tất cả đều là nội dung vốn đã hiển thị công khai trên trang. Tiện ích không đọc thông tin tài khoản Xiaohongshu, tin nhắn, cookie hay mật khẩu của bạn, và không bao giờ tự gửi yêu cầu đến Xiaohongshu — nó chỉ đọc dữ liệu mà trang đã nhận được trong lúc bạn duyệt.</p>

      <h2>Dữ liệu được lưu ở đâu</h2>
      <ul>
        <li>Ghi chú thu thập được chỉ nằm trong bộ nhớ của thẻ hiện tại. Đóng hoặc tải lại thẻ, hoặc nhấp Xóa, sẽ loại bỏ chúng.</li>
        <li>Khi bạn nhấp Xuất CSV hoặc Tải xuống, trình duyệt lưu tệp thẳng vào thư mục Tải xuống. Ảnh và video do trình duyệt tải trực tiếp từ máy chủ đa phương tiện của Xiaohongshu, không bao giờ đi qua chúng tôi.</li>
        <li>Điều duy nhất tiện ích ghi nhớ trên máy là một cài đặt: ngôn ngữ giao diện bạn chọn trong menu ngôn ngữ.</li>
      </ul>

      <h2>Những điều chúng tôi không làm</h2>
      <ul>
        <li>Không gửi bất kỳ dữ liệu nào đến máy chủ của chúng tôi hay bên thứ ba.</li>
        <li>Không dùng công cụ phân tích, quảng cáo hay theo dõi.</li>
        <li>Không bán, cho thuê hay chia sẻ bất kỳ dữ liệu nào.</li>
        <li>Không thu thập gì trong nền. Tiện ích chỉ xử lý một trang Xiaohongshu khi bạn đang xem trang đó.</li>
      </ul>

      <h2>Quyền truy cập</h2>
      <ul>
        <li><code>downloads</code> — lưu ảnh và video bạn chọn vào thư mục Tải xuống, gom vào một thư mục con đặt tên theo thời gian và tiêu đề bài.</li>
        <li><strong>Truy cập xiaohongshu.com và rednote.com</strong> (bao gồm tên miền phụ edith và so) — cho phép tiện ích chạy trên các trang đó và đọc dữ liệu ghi chú chúng tải về. Tiện ích không chạy trên trang web nào khác.</li>
      </ul>

      <h2>Nội dung bạn tải xuống</h2>
      <p>Nội dung tải xuống hoặc xuất bằng tiện ích này vẫn thuộc quyền của tác giả gốc. Vui lòng chỉ dùng cho mục đích cá nhân và nghiên cứu, đồng thời tuân thủ điều khoản dịch vụ của Xiaohongshu và pháp luật hiện hành. RedNote Exporter không liên kết với, không được xác nhận hay cho phép bởi Xiaohongshu (RedNote).</p>

      <h2>Thay đổi chính sách</h2>
      <p>Nếu cách tiện ích xử lý dữ liệu thay đổi, chúng tôi sẽ cập nhật trang này và ngày ở trên.</p>

      <h2>Liên hệ</h2>
      <p>Có câu hỏi về quyền riêng tư? Gửi email đến <a href="mailto:help@lab115.com">help@lab115.com</a>.</p>""",
}
