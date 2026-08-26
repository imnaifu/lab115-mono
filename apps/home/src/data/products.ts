import type { Lang } from "@/lib/lang";

/** A string that exists in both languages. */
export type Bilingual = Record<Lang, string>;

export type Product = {
  id: string;
  /** Product name — the same in both languages, so not a `Bilingual`. */
  name: string;
  /** Where it lives. THE one place to edit when a product moves or launches. */
  url: string;
  /** Shown on the link button, e.g. the bare domain or "Chrome Web Store". */
  host: Bilingual;
  tagline: Bilingual;
  description: Bilingual;
  /** Three short facts, rendered as a hairline-separated row under the copy. */
  facts: Record<Lang, [string, string, string]>;
};

export const PRODUCTS: Product[] = [
  {
    id: "daily",
    name: "Daily Picks",
    url: "https://daily.lab115.com",
    host: { zh: "daily.lab115.com", en: "daily.lab115.com" },
    tagline: {
      zh: "各个领域最新的观点，每天一版",
      en: "The latest takes from every field, once a day",
    },
    description: {
      zh: "每天把各个领域值得读的观点汇成一份。大模型先给每篇打分、筛掉噪音，只留下值得看的几篇，再写成中英双语摘要，排成一张可以直接截图分享的竖版长图。没有账号，没有信息流，一天只更新一次。",
      en: "Gathers the current thinking across every field into one edition a day. A model scores each piece before anything is written and keeps only what clears the bar; the survivors become bilingual summaries laid out as one tall page built to be screenshotted and shared. No account, no feed, updated once a day.",
    },
    facts: {
      zh: ["中英双语", "多家来源", "无需注册"],
      en: ["Chinese & English", "Many sources", "No sign-up"],
    },
  },
  {
    id: "rednote-exporter",
    name: "RedNote Exporter",
    url: "https://chromewebstore.google.com/detail/rednote-exporter/peadpgjojnooldamfigkfbdiahhffjlm",
    host: { zh: "Chrome 应用商店", en: "Chrome Web Store" },
    tagline: {
      zh: "小红书笔记一键导出 CSV",
      en: "Export RedNote posts to CSV in one click",
    },
    description: {
      zh: "一个 Chrome 扩展。它不爬取页面、也不替你点击——只是旁听你浏览时页面自己发出的接口响应，把看过的笔记收集起来，随时导出成 CSV；也可以把单篇笔记的图片和视频一次性下载到同一个文件夹。全部在本机完成，不经过任何服务器。",
      en: "A Chrome extension. It neither scrapes the page nor clicks for you — it listens to the responses the site already requests while you browse, collects the posts you have seen, and exports them as CSV whenever you ask. It can also pull every image and the video from a single post into one folder. All of it happens on your machine; no server is involved.",
    },
    facts: {
      zh: ["Chrome 扩展", "全程本地处理", "无需登录"],
      en: ["Chrome extension", "Runs entirely on-device", "No login"],
    },
  },
];

/**
 * Is this product hosted on our own domain?
 *
 * WHAT IT DECIDES: whether the link to it sends a referrer. Both product links
 * used to carry `rel="noopener noreferrer"`, on the reasoning that an outbound
 * link has no business telling the destination where the click came from — right
 * for the Chrome Web Store, and wrong for daily.lab115.com, which is OURS. With
 * `noreferrer` on it, daily's analytics saw every visitor from the shelf as direct
 * traffic, so the one number this page exists to move was the one number it could
 * not report. `noopener` stays on both: that is about the opened tab's access to
 * this one, which is nobody's business either way.
 *
 * Derived from the url rather than stored as a flag on each product, because the
 * url is already the single source of truth for where a product lives — a
 * hand-maintained `own: true` beside it is a second one, free to disagree.
 *
 * A suffix test on the HOSTNAME, not on the whole url: `includes("lab115.com")`
 * would also be true of `evil.example.com/?x=lab115.com`, and the dot in front of
 * the suffix is what stops it matching a `notlab115.com`.
 */
export function isOwnProperty(product: Product): boolean {
  const { hostname } = new URL(product.url);
  return hostname === "lab115.com" || hostname.endsWith(".lab115.com");
}
