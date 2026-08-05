/**
 * Content script：注入拦截脚本，并在 service worker 要求时跑完一轮抓取。
 *
 * 它默认是完全被动的 —— 你自己浏览小红书时它只是挂上 hook，不点任何东西、不上报。
 * 只有收到 worker 的 START_WATCH（即这个标签页是插件自己开的后台页）才会动作。
 *
 * 本文件刻意不 import 任何模块：content script 以普通脚本加载，不能是 ES module。
 */

/** 首屏搜索响应等多久。登录墙 / 验证码的情况下永远等不到。 */
const FIRST_BATCH_TIMEOUT_MS = 25_000;
/** 点了「最新」之后等新一批结果多久。 */
const SORT_BATCH_TIMEOUT_MS = 10_000;
/** 多久没有新响应就认为这一轮加载完了。 */
const SETTLE_MS = 1_800;
/** 整轮硬上限，超过就用手上已有的数据交差。 */
const RUN_HARD_CAP_MS = 45_000;

let batchCount = 0;
let lastBatchAt = 0;
let running = false;

function injectInterceptor() {
  if (document.documentElement.dataset.xhsWatchInjected) return;
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.onload = () => {
    document.documentElement.dataset.xhsWatchInjected = "true";
    script.remove();
  };
  (document.head ?? document.documentElement).appendChild(script);
}

function postToInjected(message: Record<string, unknown>) {
  window.postMessage({ source: "xhs-watch-content", ...message }, "*");
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== "xhs-watch-injected") return;
  if (event.data.type === "BATCH") {
    batchCount = event.data.batchCount;
    lastBatchAt = Date.now();
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 轮询直到 predicate 为真或超时。返回是否等到了。 */
async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(200);
  }
  return predicate();
}

function requestCapture(): Promise<unknown[][]> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.source !== "xhs-watch-injected" || event.data.type !== "CAPTURE") return;
      window.removeEventListener("message", handler);
      resolve((event.data.batches as unknown[][]) ?? []);
    };
    window.addEventListener("message", handler);
    postToInjected({ action: "getCapture" });
    // 注入脚本没响应（被 CSP 挡掉之类）时不要卡死整轮。
    setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve([]);
    }, 3_000);
  });
}

/**
 * 每一步筛选的结果。区分得这么细是因为静默退化的代价很高：排序没切成「最新」时
 * 抓回来的是综合排序的老爆款，真正的新帖可能根本不在前 20 条里 —— 监控等于失效了，
 * 但一切看起来都正常。所以每一步都要能在日志里追溯到。
 */
type FilterOutcome =
  | "applied" // 点了，并且等到了新一批结果
  | "already-active" // 本来就是这个选项，不用点
  | "clicked-no-response" // 点了但没等到新响应
  | "toggle-not-found" // 找不到「筛选」按钮
  | "panel-not-open" // 点了「筛选」但面板没出现
  | "group-not-found" // 面板里没有这个分组（如「排序依据」）
  | "option-not-found" // 分组里没有目标文案
  | "skipped"; // 没配置这一项

/**
 * 排除掉别的扩展注入的透明覆盖层克隆。
 *
 * 页面上每个 .tags 可能有两份：真的那个由 Vue 渲染，另一份是别的扩展复制出来的
 * 热区代理（aria-hidden="true"、opacity: 1e-05、z-index: -1）。后者有真实的
 * 盒子尺寸，光看 getClientRects() 会误判成可见，点上去不会生效。
 *
 * 刻意不用 data-v-xxxxxxxx（Vue scope id）来认真元素 —— 那个 hash 每次构建都会变。
 */
function isRealElement(element: HTMLElement): boolean {
  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.getClientRects().length === 0) return false;
  const opacity = Number.parseFloat(getComputedStyle(element).opacity);
  return !Number.isFinite(opacity) || opacity >= 0.1;
}

function findPanel(): HTMLElement | null {
  const panel = document.querySelector<HTMLElement>(".filter-panel");
  return panel && isRealElement(panel) ? panel : null;
}

/**
 * 合成一次 hover。mouseenter 不冒泡，必须直接派发在目标元素上。
 */
function hover(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const init: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: Math.round(rect.x + rect.width / 2),
    clientY: Math.round(rect.y + rect.height / 2),
  };
  element.dispatchEvent(new MouseEvent("mouseover", init));
  element.dispatchEvent(new MouseEvent("mouseenter", { ...init, bubbles: false }));
}

/**
 * 展开筛选面板。排序和发布时间都藏在这里面，不是页面上的内联 tab。
 *
 * 桌面宽度下面板是 **hover** 展开的，窄视口下才是点击 —— 而 element.click() 不会产生
 * 任何 hover 状态，所以必须先派发合成的 mouseover / mouseenter，不行再退回 click。
 *
 * 面板是 v-if 懒渲染的：收起时整棵子树（含所有 .tags）根本不在 DOM 里，所以没法
 * 绕过展开直接点里面的选项。
 *
 * 「筛选」按钮的 textContent 会把整个面板的文字都算进来（实测是「已筛选排序依据…」），
 * 所以用前缀匹配而不是全等。面板已经开着时绝不能再触发一次：那会把它关掉。
 */
async function openFilterPanel(): Promise<HTMLElement | null> {
  const alreadyOpen = findPanel();
  if (alreadyOpen) return alreadyOpen;

  const toggle = [...document.querySelectorAll<HTMLElement>(".filter")]
    .filter(isRealElement)
    .find((element) => /^(筛选|已筛选)/.test(element.textContent?.trim() ?? ""));
  if (!toggle) return null;

  hover(toggle);
  if (await waitUntil(() => findPanel() !== null, 1_500)) return findPanel();

  toggle.click();
  await waitUntil(() => findPanel() !== null, 2_500);
  return findPanel();
}

/** 面板里每个分组的第一个子元素是标题（如 <span>排序依据</span>）。 */
function findFilterGroup(panel: HTMLElement, groupLabel: string): HTMLElement | null {
  for (const group of panel.querySelectorAll<HTMLElement>(".filters")) {
    if (group.firstElementChild?.textContent?.trim() === groupLabel) return group;
  }
  return null;
}

/**
 * 在筛选面板里选中一个选项。
 *
 * 每次都重新查一遍面板，不复用上一步的引用 —— 点过一个 tag 之后 Vue 会重渲染，
 * 旧的节点引用可能已经不在文档里了。
 *
 * batchBeforeClick 是点击前的批次数：切换筛选后返回的是另一批结果，调用方靠它
 * 只取这次点击之后的批次。
 */
async function applyFilterOption(
  groupLabel: string,
  optionLabel: string,
): Promise<{ outcome: FilterOutcome; batchBeforeClick: number }> {
  const batchBeforeClick = batchCount;
  const panel = findPanel();
  if (!panel) return { outcome: "panel-not-open", batchBeforeClick };

  const group = findFilterGroup(panel, groupLabel);
  if (!group) return { outcome: "group-not-found", batchBeforeClick };

  const target = [...group.querySelectorAll<HTMLElement>(".tags")]
    .filter(isRealElement)
    .find((tag) => tag.textContent?.trim() === optionLabel);
  if (!target) return { outcome: "option-not-found", batchBeforeClick };
  // 已经是这个选项了，再点一次可能把它取消掉。
  if (target.classList.contains("active")) {
    return { outcome: "already-active", batchBeforeClick };
  }

  target.click();
  const gotNewBatch = await waitUntil(() => batchCount > batchBeforeClick, SORT_BATCH_TIMEOUT_MS);
  return { outcome: gotNewBatch ? "applied" : "clicked-no-response", batchBeforeClick };
}

/**
 * 兜底路径：部分布局下排序是页面上的内联 tab，不在筛选面板里。
 *
 * 同一份文案会同时匹配到内层节点和它的各级包裹元素，所以取最深的那个（子元素最少）：
 * 事件监听在祖先上时点击照样冒泡得到，反过来点包裹元素则可能落在热区之外。
 */
async function clickInlineSortTab(
  label: string,
): Promise<{ outcome: FilterOutcome; batchBeforeClick: number }> {
  const batchBeforeClick = batchCount;
  const matches = [...document.querySelectorAll<HTMLElement>("div,span,button,li,a")]
    .filter((element) => element.textContent?.trim() === label)
    .filter(isRealElement)
    .sort((a, b) => a.childElementCount - b.childElementCount);
  if (matches.length === 0) return { outcome: "option-not-found", batchBeforeClick };

  matches[0]!.click();
  const gotNewBatch = await waitUntil(() => batchCount > batchBeforeClick, SORT_BATCH_TIMEOUT_MS);
  return { outcome: gotNewBatch ? "applied" : "clicked-no-response", batchBeforeClick };
}

/**
 * 一个响应都没等到，通常意味着登录墙或验证页面，而不是「0 条结果」。
 * 区分这两者决定了 worker 是走退避还是只记一次普通失败。
 */
function detectBlocked(): boolean {
  if (document.querySelector(".login-container, .login-modal, .captcha-container")) return true;
  const text = document.body?.innerText ?? "";
  return ["扫码登录", "登录后查看", "请完成验证", "滑动验证", "点击按钮开始验证"].some((marker) =>
    text.includes(marker),
  );
}

/** 按 note id 去重并保序，然后截到 limit 条。 */
function dedupeItems(items: unknown[], limit: number): unknown[] {
  const seen = new Set<string>();
  const unique: unknown[] = [];
  for (const raw of items) {
    const item = raw as Record<string, any> | null;
    const id: string | undefined = item?.id ?? item?.note_id ?? item?.note_card?.note_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(item);
    if (unique.length >= limit) break;
  }
  return unique;
}

function report(result: Record<string, unknown>) {
  // worker 可能已被回收，sendMessage 会把它重新拉起；失败只可能是插件被卸载/重载。
  chrome.runtime.sendMessage({ type: "WATCH_RESULT", ...result }).catch(() => undefined);
}

function isApplied(outcome: FilterOutcome): boolean {
  return outcome === "applied" || outcome === "already-active";
}

/**
 * 依次应用排序和发布时间筛选，返回「应该从第几批开始取结果」。
 *
 * 每成功应用一个筛选就更新 skipBatches —— 我们要的是**最后一次**筛选变更之后返回的
 * 那批结果，前面的批次（默认排序的、还没加时间过滤的）都要丢掉。
 */
async function applyFilters(
  sortTabLabel: string | null,
  timeFilterLabel: string | null,
): Promise<{ skipBatches: number; sort: FilterOutcome; time: FilterOutcome }> {
  let skipBatches = 0;
  let sort: FilterOutcome = sortTabLabel ? "toggle-not-found" : "skipped";
  let time: FilterOutcome = timeFilterLabel ? "toggle-not-found" : "skipped";

  if (!sortTabLabel && !timeFilterLabel) return { skipBatches, sort, time };

  if (await openFilterPanel()) {
    if (sortTabLabel) {
      const result = await applyFilterOption("排序依据", sortTabLabel);
      sort = result.outcome;
      if (result.outcome === "applied") skipBatches = result.batchBeforeClick;
    }
    if (timeFilterLabel) {
      const result = await applyFilterOption("发布时间", timeFilterLabel);
      time = result.outcome;
      if (result.outcome === "applied") skipBatches = result.batchBeforeClick;
    }
  }

  // 面板路径没走通时退回内联 tab（不同布局下排序入口位置不一样）。
  if (sortTabLabel && !isApplied(sort)) {
    const fallback = await clickInlineSortTab(sortTabLabel);
    if (isApplied(fallback.outcome)) {
      sort = fallback.outcome;
      if (fallback.outcome === "applied") skipBatches = fallback.batchBeforeClick;
    }
  }

  return { skipBatches, sort, time };
}

async function runWatch(
  sortTabLabel: string | null,
  timeFilterLabel: string | null,
  captureLimit: number,
) {
  if (running) return;
  running = true;
  const hardDeadline = Date.now() + RUN_HARD_CAP_MS;

  try {
    const gotFirstBatch = await waitUntil(() => batchCount > 0, FIRST_BATCH_TIMEOUT_MS);
    if (!gotFirstBatch) {
      const blocked = detectBlocked();
      report({
        ok: false,
        blocked,
        reason: blocked
          ? "被拦截：出现登录 / 验证页面，需要在浏览器里重新登录小红书"
          : "未捕获到搜索接口响应（页面结构或接口可能已变更）",
      });
      return;
    }

    const filters = await applyFilters(sortTabLabel, timeFilterLabel);

    await waitUntil(
      () => Date.now() - lastBatchAt > SETTLE_MS,
      Math.max(0, hardDeadline - Date.now()),
    );

    const batches = await requestCapture();
    const items = dedupeItems(batches.slice(filters.skipBatches).flat(), captureLimit);
    if (items.length === 0) {
      report({ ok: false, blocked: false, reason: "捕获到响应但解析不出任何笔记" });
      return;
    }
    report({ ok: true, items, sortOutcome: filters.sort, timeOutcome: filters.time });
  } catch (error) {
    report({ ok: false, blocked: false, reason: `抓取异常：${String(error)}` });
  } finally {
    running = false;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "START_WATCH") return undefined;
  // 立刻 ack 让 worker 停止重试，抓取本身异步跑完后走 sendMessage 上报 ——
  // 一轮要几十秒，不适合把 response 通道一直挂着。
  sendResponse({ ack: true });
  void runWatch(
    message.sortTabLabel ?? null,
    message.timeFilterLabel ?? null,
    message.captureLimit ?? 20,
  );
  return undefined;
});

injectInterceptor();
