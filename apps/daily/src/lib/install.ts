import type { Lang } from "./lang";

/**
 * The instructions for turning this page into an app on the reader's device.
 *
 * ALL OF IT IS UA SNIFFING, on purpose and with no apology. The usual objection —
 * feature-detect instead — has no answer here: what has to be produced is a
 * sentence naming a menu item, and "点右上角的 ⋮ 菜单" is not a capability any API
 * reports. `beforeinstallprompt` covers the browsers that will just do it for you
 * (see InstallApp); this file exists for the ones that will not, and those are
 * exactly the ones that can only be told apart by their name.
 *
 * The consequence is that a wrong guess prints wrong steps rather than breaking
 * anything, so every branch falls back to a generic "open the browser menu and
 * look for…" instead of asserting something it is not sure of.
 *
 * THE COPY LIVES HERE, NOT IN i18n.ts, and that is deliberate. These strings ARE
 * the branch table: a platform's name, the words in its menu and the condition
 * that selects it are one fact in three parts, and splitting them across two
 * files means every future browser change has to be made in both. i18n.ts keeps
 * the chrome around them — the button, the heading, the close — because those are
 * interface, not platform data.
 */

/**
 * One set of steps. The key is also the analytics dimension (`install_open`'s
 * `platform` param), which is why it is a closed union rather than a formatted
 * string: a typo would file its own row in GA4 forever.
 */
export type GuideKey =
  | "ios-safari"
  | "ios-chrome"
  | "ios-firefox"
  | "ios-other"
  | "android-chromium"
  | "android-samsung"
  | "android-firefox"
  | "android-other"
  | "macos-safari"
  | "desktop-chromium"
  | "desktop-firefox"
  | "unknown";

export type Guide = {
  /** Which platform and browser these steps are for, said out loud. A reader who
   *  has been given the wrong ones needs to be able to see that at a glance. */
  title: string;
  /** One thing to do per entry, in order. Empty when `unsupported` is set. */
  steps: string[];
  /** A caveat under the steps — a version requirement, or where else to look. */
  note?: string;
  /** Set when this browser cannot install a page at all. Then there are no steps
   *  and this sentence says what to do instead; pretending otherwise would send
   *  the reader hunting for a menu item that does not exist. */
  unsupported?: string;
};

type Browser =
  | "safari"
  | "chrome"
  | "edge"
  | "firefox"
  | "samsung"
  | "opera"
  | "other";

/**
 * ORDER IS THE WHOLE FUNCTION. Every one of these UA strings contains the names
 * of the ones below it: Edge carries `Chrome` and `Safari`, Chrome carries
 * `Safari`, Samsung carries `Chrome`, and Firefox on iOS carries `Safari` too
 * (it is WebKit underneath). So the most specific token has to be tested first,
 * and `Safari` — the token nearly everyone claims — has to be tested last.
 */
function browserOf(ua: string): Browser {
  if (/FxiOS|Firefox/.test(ua)) return "firefox";
  // `Edg/` on desktop, `EdgA/` on Android, `EdgiOS/` on iOS.
  if (/EdgiOS|EdgA?\//.test(ua)) return "edge";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/OPR\/|OPiOS/.test(ua)) return "opera";
  if (/CriOS|Chrome|Chromium/.test(ua)) return "chrome";
  if (/Safari/.test(ua)) return "safari";
  return "other";
}

/**
 * Which guide this device gets.
 *
 * `touchPoints` is `navigator.maxTouchPoints`, and it is a parameter rather than
 * being read here so this stays a pure function of its inputs — the caller is a
 * client component that has both, and a pure function is one that can be checked
 * against a UA string without a browser.
 *
 * It is needed because an iPad on iOS 13+ sends a DESKTOP MAC user agent. There
 * is no `iPad` token any more, so a Mac claiming more than one touch point is the
 * only signal left, and getting it wrong would hand an iPad Safari's "文件 →
 * 添加到程序坞" — a menu it does not have.
 */
export function guideKey(ua: string, touchPoints: number): GuideKey {
  const browser = browserOf(ua);
  const ios =
    /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);

  if (ios) {
    // Every browser on iOS is WebKit and every one of them installs through a
    // share menu — what differs is only where that menu is and what the item in
    // it is called, which is why these are four entries and not one.
    if (browser === "firefox") return "ios-firefox";
    if (browser === "chrome") return "ios-chrome";
    if (browser === "safari") return "ios-safari";
    return "ios-other";
  }

  if (/Android/.test(ua)) {
    if (browser === "samsung") return "android-samsung";
    if (browser === "firefox") return "android-firefox";
    if (browser === "chrome" || browser === "edge") return "android-chromium";
    return "android-other";
  }

  if (/Macintosh|Mac OS X|Windows|Linux|CrOS/.test(ua)) {
    // Safari on a desktop means macOS: there has been no Safari for Windows for
    // over a decade, and the iPad case was already taken above.
    if (browser === "safari") return "macos-safari";
    if (browser === "firefox") return "desktop-firefox";
    if (browser === "chrome" || browser === "edge") return "desktop-chromium";
    // Opera and the rest are Chromium too and can install, but their menus are
    // named differently enough that naming Chrome's would be a wrong answer
    // stated confidently. They get the generic one.
  }

  return "unknown";
}

const GUIDES: Record<Lang, Record<GuideKey, Guide>> = {
  zh: {
    "ios-safari": {
      title: "iPhone / iPad · Safari",
      steps: [
        "点屏幕底部中间的分享按钮（方框里一个向上的箭头）",
        "在弹出的菜单里往下滑，选「添加到主屏幕」",
        "右上角点「添加」",
      ],
    },
    "ios-chrome": {
      title: "iPhone / iPad · Chrome",
      steps: [
        "点地址栏右边的分享按钮（方框里一个向上的箭头）",
        "在菜单里选「添加到主屏幕」",
        "点「添加」",
      ],
    },
    "ios-firefox": {
      title: "iPhone / iPad · Firefox",
      steps: [
        "点右下角的菜单按钮（三个点，⋯）",
        "选「分享」，再选「添加到主屏幕」",
        "点「添加」",
      ],
    },
    "ios-other": {
      title: "iPhone / iPad",
      steps: [
        "打开浏览器的分享菜单（通常是方框里一个向上的箭头）",
        "往下找「添加到主屏幕」",
        "确认添加",
      ],
      note: "菜单里找不到这一项的话，用 Safari 打开这个页面，那里一定有。",
    },
    "android-chromium": {
      title: "Android · Chrome / Edge",
      steps: [
        "点右上角的菜单按钮（三个点，⋮）",
        "选「安装应用」（有些版本叫「添加到主屏幕」）",
        "点「安装」",
      ],
    },
    "android-samsung": {
      title: "Android · 三星浏览器",
      steps: [
        "点右下角的菜单按钮（三条横线，≡）",
        "选「添加页面到」，再选「主屏幕」",
        "点「添加」",
      ],
    },
    "android-firefox": {
      title: "Android · Firefox",
      steps: [
        "点右上角的菜单按钮（三个点，⋮）",
        "选「安装」或「添加到主屏幕」",
        "确认添加",
      ],
    },
    "android-other": {
      title: "Android",
      steps: [
        "打开浏览器菜单（右上角三个点 ⋮，或右下角三条横线 ≡）",
        "找「安装应用」或「添加到主屏幕」",
        "确认添加",
      ],
      note: "找不到的话，用 Chrome 打开这个页面。",
    },
    "macos-safari": {
      title: "Mac · Safari",
      steps: [
        "菜单栏点「文件」",
        "选「添加到程序坞」",
        "确认名字，点「添加」",
      ],
      note: "需要 macOS Sonoma（14）或更新的版本。更早的 Safari 没有这一项，可以改用 Chrome 或 Edge。",
    },
    "desktop-chromium": {
      title: "电脑 · Chrome / Edge",
      steps: [
        "看地址栏最右边，有一个安装图标（一个方框加一个向下的箭头）",
        "点它，再点「安装」",
        "没看到图标就点右上角的菜单按钮（三个点，⋮）→「投放、保存和共享」→「安装页面为应用」",
      ],
    },
    "desktop-firefox": {
      title: "电脑 · Firefox",
      steps: [],
      unsupported:
        "Firefox 桌面版不支持把网页装成应用。想要独立窗口和图标，用 Safari（Mac）或 Chrome / Edge 打开这个页面；只是想快点回来的话，加个书签就够了。",
    },
    unknown: {
      title: "其他浏览器",
      steps: [
        "打开浏览器菜单",
        "找「安装」「安装应用」或「添加到主屏幕」",
        "确认添加",
      ],
      note: "没有这一项说明这个浏览器不支持。手机上用 Safari 或 Chrome，电脑上用 Chrome 或 Edge。",
    },
  },

  en: {
    "ios-safari": {
      title: "iPhone / iPad · Safari",
      steps: [
        "Tap the share button at the bottom of the screen — an arrow pointing up out of a box",
        "Scroll down the menu and choose “Add to Home Screen”",
        "Tap “Add” in the top right",
      ],
    },
    "ios-chrome": {
      title: "iPhone / iPad · Chrome",
      steps: [
        "Tap the share button to the right of the address bar — an arrow pointing up out of a box",
        "Choose “Add to Home Screen”",
        "Tap “Add”",
      ],
    },
    "ios-firefox": {
      title: "iPhone / iPad · Firefox",
      steps: [
        "Tap the menu button in the bottom right — three dots, ⋯",
        "Choose “Share”, then “Add to Home Screen”",
        "Tap “Add”",
      ],
    },
    "ios-other": {
      title: "iPhone / iPad",
      steps: [
        "Open the browser’s share menu — usually an arrow pointing up out of a box",
        "Look for “Add to Home Screen”",
        "Confirm",
      ],
      note: "If it is not in the menu, open this page in Safari — it is always there.",
    },
    "android-chromium": {
      title: "Android · Chrome / Edge",
      steps: [
        "Tap the menu button in the top right — three dots, ⋮",
        "Choose “Install app” (some versions say “Add to Home screen”)",
        "Tap “Install”",
      ],
    },
    "android-samsung": {
      title: "Android · Samsung Internet",
      steps: [
        "Tap the menu button in the bottom right — three lines, ≡",
        "Choose “Add page to”, then “Home screen”",
        "Tap “Add”",
      ],
    },
    "android-firefox": {
      title: "Android · Firefox",
      steps: [
        "Tap the menu button in the top right — three dots, ⋮",
        "Choose “Install” or “Add to Home screen”",
        "Confirm",
      ],
    },
    "android-other": {
      title: "Android",
      steps: [
        "Open the browser menu — three dots (⋮) in the top right, or three lines (≡) in the bottom right",
        "Look for “Install app” or “Add to Home screen”",
        "Confirm",
      ],
      note: "If there is no such item, open this page in Chrome.",
    },
    "macos-safari": {
      title: "Mac · Safari",
      steps: [
        "Open the “File” menu",
        "Choose “Add to Dock”",
        "Check the name and click “Add”",
      ],
      note: "Needs macOS Sonoma (14) or newer. Earlier versions of Safari have no such menu item — use Chrome or Edge instead.",
    },
    "desktop-chromium": {
      title: "Desktop · Chrome / Edge",
      steps: [
        "Look at the right-hand end of the address bar for the install icon — a screen with an arrow pointing down into it",
        "Click it, then click “Install”",
        "No icon? Use the menu button in the top right — three dots, ⋮ — then “Cast, save and share” → “Install page as app”",
      ],
    },
    "desktop-firefox": {
      title: "Desktop · Firefox",
      steps: [],
      unsupported:
        "Firefox on the desktop cannot install a page as an app. For a window and an icon of its own, open this page in Safari (on a Mac) or in Chrome or Edge; if you only want to get back here quickly, a bookmark is enough.",
    },
    unknown: {
      title: "Other browsers",
      steps: [
        "Open the browser menu",
        "Look for “Install”, “Install app” or “Add to Home screen”",
        "Confirm",
      ],
      note: "If there is no such item, this browser cannot do it. Use Safari or Chrome on a phone, Chrome or Edge on a computer.",
    },
  },
};

/** The steps for one device, in one language. */
export function installGuide(key: GuideKey, lang: Lang): Guide {
  return GUIDES[lang][key];
}
