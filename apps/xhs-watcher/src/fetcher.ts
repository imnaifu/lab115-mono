/**
 * Playwright-based fetcher.
 *
 * Why a browser instead of plain HTTP: the search endpoint is signed
 * (`x-s` / `x-t`, derived in obfuscated page JS). Letting the real page issue
 * the request and just *listening* to the response means we never have to
 * reverse or track that signature.
 *
 * Why intercept XHR instead of scraping the DOM: the JSON payload is
 * structured and survives UI redesigns.
 */
import fs from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { config, type WatchConfig } from "./config.js";

/** Login expired / captcha wall / account restricted — retrying now won't help. */
export class BlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedError";
  }
}

const SEARCH_API = "/search/notes";
const SORT_TAB_LABEL: Record<WatchConfig["sort"], string | null> = {
  general: null,
  time_descending: "最新",
  popularity_descending: "最多点赞",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(250);
  }
  return predicate();
}

export interface Session {
  searchNotes(watch: WatchConfig): Promise<unknown[]>;
}

/**
 * Opens the persistent profile once and runs `body` against it — browser
 * startup is expensive, so all keywords in a cycle share one session.
 */
export async function withSession<T>(body: (session: Session) => Promise<T>): Promise<T> {
  if (!fs.existsSync(config.profileDir)) {
    throw new BlockedError(
      `未找到浏览器 profile (${config.profileDir})，请先在本地执行 npm run login 扫码登录`,
    );
  }

  const context = await chromium.launchPersistentContext(config.profileDir, {
    headless: config.headless,
    viewport: { width: 1440, height: 900 },
    locale: "zh-CN",
    timezoneId: config.timezone,
    // Cosmetic hardening: the default headless UA advertises HeadlessChrome.
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const cookies = await context.cookies("https://www.xiaohongshu.com");
    if (!cookies.some((cookie) => cookie.name === "web_session" && cookie.value)) {
      throw new BlockedError("登录态已失效（web_session cookie 缺失），需要重新扫码登录");
    }
    return await body({ searchNotes: (watch) => searchNotes(context, watch) });
  } finally {
    await context.close();
  }
}

async function searchNotes(context: BrowserContext, watch: WatchConfig): Promise<unknown[]> {
  const page = await context.newPage();
  const captured: unknown[] = [];

  page.on("response", (response) => {
    if (!response.url().includes(SEARCH_API)) return;
    // Fire-and-forget: a navigation can invalidate the body mid-read.
    void response
      .json()
      .then((payload: any) => {
        const items = payload?.data?.items ?? payload?.data?.note_list ?? [];
        if (Array.isArray(items)) captured.push(...items);
      })
      .catch(() => undefined);
  });

  try {
    const url =
      "https://www.xiaohongshu.com/search_result" +
      `?keyword=${encodeURIComponent(watch.keyword)}&source=web_search_result_notes&type=51`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const gotFirstPage = await waitUntil(() => captured.length > 0, 20_000);
    if (!gotFirstPage) {
      // No payload at all usually means a login wall or a captcha, not "0 results".
      if (await isBlocked(page)) {
        throw new BlockedError(`关键词「${watch.keyword}」被拦截：出现登录/验证页面`);
      }
      throw new Error(`关键词「${watch.keyword}」未捕获到搜索接口响应（页面结构或接口可能已变更）`);
    }

    await applySortTab(page, watch, captured);

    for (let scroll = 0; scroll < config.scrolls; scroll += 1) {
      const before = captured.length;
      await page.mouse.wheel(0, 2400);
      await waitUntil(() => captured.length > before, 8000);
      await sleep(1500);
    }

    return captured;
  } finally {
    await page.close();
  }
}

/**
 * "最新" is a UI tab, not a URL parameter. Clicking it is best-effort: if the
 * tab moves or disappears we keep the default-sorted results — dedupe by
 * note_id still makes the run correct, just slightly less fresh.
 */
async function applySortTab(page: Page, watch: WatchConfig, captured: unknown[]): Promise<void> {
  const label = SORT_TAB_LABEL[watch.sort];
  if (!label) return;

  try {
    const before = captured.length;
    await page.getByText(label, { exact: true }).first().click({ timeout: 5000 });
    await waitUntil(() => captured.length > before, 10_000);
    await sleep(1000);
  } catch {
    console.warn(`[fetch] 未能切换到「${label}」排序，使用默认排序结果`);
  }
}

async function isBlocked(page: Page): Promise<boolean> {
  const markers = [".login-container", ".login-modal", "text=扫码登录", "text=验证"];
  for (const marker of markers) {
    if (await page.locator(marker).first().isVisible({ timeout: 1000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

/** Randomised pause between keywords — steady machine-gun timing is a giveaway. */
export function politeDelay(): Promise<void> {
  const span = Math.max(0, config.delayMaxMs - config.delayMinMs);
  return sleep(config.delayMinMs + Math.floor(Math.random() * span));
}
