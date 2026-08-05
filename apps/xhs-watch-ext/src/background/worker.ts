/**
 * Service worker：调度、开后台标签页抓取、去重、推送。
 *
 * 一轮的流程：
 *   alarm 触发 → 打开后台标签页（不抢焦点）→ 页面自己发出带签名的搜索请求
 *   → content script 拦到响应并回报 → 去重 → 有新的就推送 → 关掉标签页
 *
 * 关键设计：一轮的进度存在 chrome.storage.session 而不是内存变量里。MV3 的
 * service worker 空闲 30 秒就会被回收，而一轮要几十秒，中途被回收是常态；
 * 把状态外置后，worker 被重新拉起也能正确收尾，不会留下野标签页或卡死的 pending。
 */
import { notifyAlert, notifyNewNotes, sendTestNotification } from "./notify";
import { normalizeItems } from "../shared/normalize";
import {
  addSeen,
  appendLog,
  getPendingRun,
  getSeen,
  loadConfig,
  loadState,
  patchState,
  resetSeen,
  saveConfig,
  setLatest,
  setPendingRun,
  takeNotificationUrl,
} from "../shared/store";
import type { Config, Note, PendingRun, RunState, Watch } from "../shared/types";

const ALARM_TICK = "xhs-watch-tick";
const ALARM_WATCHDOG = "xhs-watch-watchdog";

/** content script 的硬上限是 45s，看门狗留足余量再介入。 */
const WATCHDOG_MS = 75_000;
/** 超过这个时长的 pending 一定是残留（worker 被回收 + 看门狗也没跑成），可以强行接管。 */
const STALE_RUN_MS = 150_000;
const FAILURES_BEFORE_BACKOFF = 3;
const BACKOFF_MINUTES = 60;
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
/** 多个 watch 之间的随机停顿：机枪一样的固定节奏太显眼。 */
const POLITE_DELAY_MIN_MS = 3_000;
const POLITE_DELAY_MAX_MS = 8_000;

const BADGE_COLOR = "#ff2442";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── 调度 ─────────────────────────────────────────────────────────────────────

async function scheduleTick(config: Config): Promise<void> {
  await chrome.alarms.create(ALARM_TICK, {
    periodInMinutes: config.intervalMinutes,
    delayInMinutes: config.intervalMinutes,
  });
}

/**
 * worker 被回收后 power 请求可能一起失效，所以每次 tick 都重新申请一遍
 * （等于持续续期，代价可以忽略）。
 */
function applyKeepAwake(config: Config): void {
  try {
    if (config.keepAwake) chrome.power.requestKeepAwake("system");
    else chrome.power.releaseKeepAwake();
  } catch {
    // power API 不可用（某些平台）时忽略，其余功能不受影响。
  }
}

async function applyConfig(config: Config): Promise<void> {
  await scheduleTick(config);
  applyKeepAwake(config);
}

async function refreshBadge(): Promise<void> {
  const { unreadCount } = await loadState();
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  await chrome.action.setBadgeText({
    text: unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : "",
  });
}

// ── 一轮抓取 ─────────────────────────────────────────────────────────────────

/** 返回一句给 popup 显示的说明。 */
async function startCycle(manual: boolean): Promise<string> {
  const pending = await getPendingRun();
  if (pending) {
    if (Date.now() - pending.startedAt < STALE_RUN_MS) return "上一轮还在跑，已跳过";
    // 残留的 pending：先收尾再继续，否则永远卡在这里。
    await finishStalledRun(pending);
  }

  const config = await loadConfig();
  const state = await loadState();
  if (!manual && state.backoffUntil && Date.now() < state.backoffUntil) {
    return `连续失败已退避，${formatClock(state.backoffUntil)} 后重试`;
  }

  const enabled = config.watches.filter((watch) => watch.enabled);
  if (enabled.length === 0) return "没有启用的监控";

  await startWatch(
    config,
    enabled[0]!.id,
    enabled.slice(1).map((watch) => watch.id),
    manual,
  );
  return `开始检查「${enabled[0]!.name}」`;
}

async function startWatch(
  config: Config,
  watchId: string,
  queue: string[],
  manual: boolean,
): Promise<void> {
  const watch = config.watches.find((candidate) => candidate.id === watchId);
  if (!watch) {
    await continueQueue(config, queue, manual);
    return;
  }

  let tabId: number | undefined;
  try {
    // active: false —— 标签页在后台打开，不抢焦点、不打断你正在做的事，
    // 抓完立刻关掉。不用 pinned，免得挤乱你自己的固定标签页。
    const tab = await chrome.tabs.create({ url: watch.url, active: false });
    tabId = tab.id;
  } catch (error) {
    await recordFailure(config, watch, `打不开标签页：${String(error)}`, false);
    await continueQueue(config, queue, manual);
    return;
  }
  if (tabId === undefined) {
    await recordFailure(config, watch, "标签页创建后没有拿到 id", false);
    await continueQueue(config, queue, manual);
    return;
  }

  await setPendingRun({ watchId, tabId, startedAt: Date.now(), queue, manual });
  await chrome.alarms.create(ALARM_WATCHDOG, { when: Date.now() + WATCHDOG_MS });

  const delivered = await sendStartWatch(tabId, watch, config.captureLimit);
  if (!delivered) {
    await chrome.alarms.clear(ALARM_WATCHDOG);
    await setPendingRun(null);
    await closeTab(tabId);
    await recordFailure(
      config,
      watch,
      "content script 没有响应（URL 可能不在 www.xiaohongshu.com 域下）",
      false,
    );
    await continueQueue(config, queue, manual);
  }
}

/**
 * 标签页刚创建时 content script 还没加载完，sendMessage 会直接抛错，
 * 所以要重试到它上车为止。
 */
async function sendStartWatch(
  tabId: number,
  watch: Watch,
  captureLimit: number,
): Promise<boolean> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "START_WATCH",
        sortTabLabel: watch.sortTabLabel,
        timeFilterLabel: watch.timeFilterLabel,
        captureLimit,
      });
      return true;
    } catch {
      await sleep(300);
    }
  }
  return false;
}

async function continueQueue(config: Config, queue: string[], manual: boolean): Promise<void> {
  if (queue.length === 0) return;
  const span = POLITE_DELAY_MAX_MS - POLITE_DELAY_MIN_MS;
  await sleep(POLITE_DELAY_MIN_MS + Math.floor(Math.random() * span));
  await startWatch(config, queue[0]!, queue.slice(1), manual);
}

async function closeTab(tabId: number): Promise<void> {
  // 用户可能已经手动关掉了这个标签页，remove 会抛错。
  await chrome.tabs.remove(tabId).catch(() => undefined);
}

/** 看门狗触发或发现残留 pending 时的收尾。 */
async function finishStalledRun(pending: PendingRun): Promise<void> {
  await setPendingRun(null);
  await closeTab(pending.tabId);
  const config = await loadConfig();
  const watch = config.watches.find((candidate) => candidate.id === pending.watchId);
  if (watch) {
    await recordFailure(config, watch, "抓取超时（页面没有在预期时间内返回搜索结果）", false);
  }
  await continueQueue(config, pending.queue, pending.manual);
}

async function handleWatchResult(
  tabId: number | undefined,
  message: {
    ok: boolean;
    items?: unknown[];
    reason?: string;
    blocked?: boolean;
    sortOutcome?: string;
    timeOutcome?: string;
  },
): Promise<void> {
  const pending = await getPendingRun();
  // 只认当前这一轮的那个标签页；用户自己浏览搜索页时发来的消息在这里被丢掉。
  if (!pending || tabId === undefined || pending.tabId !== tabId) return;

  await chrome.alarms.clear(ALARM_WATCHDOG);
  await setPendingRun(null);
  await closeTab(tabId);

  const config = await loadConfig();
  const watch = config.watches.find((candidate) => candidate.id === pending.watchId);
  if (watch) {
    if (message.ok && message.items) {
      await processCapture(config, watch, message.items, {
        sort: message.sortOutcome,
        time: message.timeOutcome,
      });
    } else {
      await recordFailure(config, watch, message.reason ?? "未知失败", message.blocked ?? false);
    }
  }

  await continueQueue(config, pending.queue, pending.manual);
}

// ── 去重与推送 ───────────────────────────────────────────────────────────────

/**
 * 搜索结果里会混进几个月前的爆款。这类笔记要入库（否则每轮都算"新"）但不推送。
 * 拿不到发布时间时放行 —— 宁可多推一条，也不要漏掉真正的新帖。
 */
function passesAgeFilter(note: Note, config: Config, now: number): boolean {
  if (config.maxAgeDays <= 0) return true;
  if (note.publishedAt === null) return true;
  return note.publishedAt >= now - config.maxAgeDays * 86_400_000;
}

const FILTER_OUTCOME_TEXT: Record<string, string> = {
  applied: "已生效",
  "already-active": "本来就是该选项",
  "clicked-no-response": "点了但没等到新结果",
  "toggle-not-found": "找不到「筛选」按钮",
  "panel-not-open": "筛选面板没打开",
  "group-not-found": "面板里没有这个分组",
  "option-not-found": "面板里找不到该选项",
  skipped: "未配置",
};

/**
 * 配了某个筛选但它没生效时，返回一句人话描述；生效了返回 null。
 *
 * 这件事必须可见：排序没切成「最新」的话，抓回来的是综合排序的老爆款，真正的新帖
 * 可能根本不在前 20 条里 —— 监控实际已经失效，但每一轮看起来都"成功"。
 */
function describeFilterProblem(
  label: string | null,
  outcome: string | undefined,
  what: string,
): string | null {
  if (!label) return null;
  if (outcome === "applied" || outcome === "already-active") return null;
  return `${what}「${label}」未生效（${FILTER_OUTCOME_TEXT[outcome ?? ""] ?? outcome ?? "未知"}）`;
}

async function processCapture(
  config: Config,
  watch: Watch,
  items: unknown[],
  outcomes: { sort?: string; time?: string },
): Promise<void> {
  const now = Date.now();
  const notes = normalizeItems(items, now).slice(0, config.captureLimit);
  if (notes.length === 0) {
    await recordFailure(config, watch, "响应里没有可解析的笔记", false);
    return;
  }

  const seen = await getSeen(watch.id);
  const seenIds = new Set(seen.ids);
  const seenContentKeys = new Set(seen.keys);
  const isFirstRun = seen.ids.length === 0;

  const fresh: Note[] = [];
  for (const note of notes) {
    // 两层去重：note_id 挡同一条笔记，contentKey 挡中介 / 搬运号重复发布
    // （每次都是新 note_id，第一层挡不住）。边走边记，同一轮内的重复也能挡掉。
    if (seenIds.has(note.noteId) || seenContentKeys.has(note.contentKey)) continue;
    seenIds.add(note.noteId);
    seenContentKeys.add(note.contentKey);
    fresh.push(note);
  }

  // 抓到的全部记为已见（包括下面被过滤掉、不推送的那些），否则它们下一轮又变成"新"。
  await addSeen(watch.id, notes);
  await setLatest(watch.id, notes);

  const seeding = isFirstRun && config.seedOnFirstRun;
  const toNotify = seeding
    ? []
    : fresh.filter(
        (note) => passesAgeFilter(note, config, now) && note.likedCount >= watch.minLike,
      );

  const notifyErrors = toNotify.length > 0 ? await notifyNewNotes(config, watch, toNotify) : [];

  if (toNotify.length > 0) {
    const state = await loadState();
    await patchState({ unreadCount: state.unreadCount + toNotify.length });
    await refreshBadge();
  }

  const filterProblems = [
    describeFilterProblem(watch.sortTabLabel, outcomes.sort, "排序"),
    describeFilterProblem(watch.timeFilterLabel, outcomes.time, "发布时间"),
  ].filter((problem): problem is string => problem !== null);
  const sortFailed = describeFilterProblem(watch.sortTabLabel, outcomes.sort, "排序") !== null;
  const warning = filterProblems.length
    ? `${filterProblems.join("；")}${sortFailed ? "，抓到的可能是综合排序的老帖" : ""}`
    : null;

  await patchState({
    lastRunAt: now,
    lastOkAt: now,
    // 推送错误优先显示，其次是筛选没生效的警告 —— 两者都会让 popup 状态栏变色。
    lastError: notifyErrors[0] ?? warning,
    consecutiveFailures: 0,
    backoffUntil: null,
  });

  const summary = seeding
    ? `首轮只建立基线，记录 ${notes.length} 条`
    : (notifyErrors.join("；") ||
      (toNotify.length > 0 ? `推送 ${toNotify.length} 条新笔记` : "没有新内容"));

  await appendLog({
    at: now,
    watchName: watch.name,
    // 筛选没生效时日志标红，否则这种静默退化在日志里看不出来。
    ok: !warning,
    captured: notes.length,
    fresh: toNotify.length,
    message: warning ? `${summary}｜${warning}` : summary,
  });
}

async function recordFailure(
  config: Config,
  watch: Watch,
  reason: string,
  blocked: boolean,
): Promise<void> {
  const state = await loadState();
  const failures = state.consecutiveFailures + 1;
  const now = Date.now();

  const patch: Partial<RunState> = {
    lastRunAt: now,
    lastError: reason,
    consecutiveFailures: failures,
  };
  // 被拦截时立刻退避 —— 继续按原节奏敲门只会让情况更糟。
  if (blocked || failures >= FAILURES_BEFORE_BACKOFF) {
    patch.backoffUntil = now + BACKOFF_MINUTES * 60_000;
  }

  const shouldAlert =
    (blocked || failures >= FAILURES_BEFORE_BACKOFF) &&
    now - (state.lastAlertAt ?? 0) > ALERT_COOLDOWN_MS;
  if (shouldAlert) patch.lastAlertAt = now;

  await patchState(patch);
  await appendLog({
    at: now,
    watchName: watch.name,
    ok: false,
    captured: 0,
    fresh: 0,
    message: reason,
  });

  if (shouldAlert) {
    await notifyAlert(config, "小红书监控异常", reason);
  }
}

// ── 事件入口 ─────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const config = await loadConfig();
    // 首次安装时把默认配置落盘，popup 打开就能看到实际值。
    await saveConfig(config);
    await applyConfig(config);
    await refreshBadge();
    await startCycle(false);
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    const config = await loadConfig();
    await applyConfig(config);
    await refreshBadge();
    // 浏览器刚启动，先补一轮：关机 / 休眠期间攒下的新帖在这里被捞回来。
    await startCycle(false);
  })();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void (async () => {
    if (alarm.name === ALARM_WATCHDOG) {
      const pending = await getPendingRun();
      if (pending) await finishStalledRun(pending);
      return;
    }
    if (alarm.name === ALARM_TICK) {
      // 电脑休眠期间错过的周期性 alarm 会在唤醒时立刻补一次触发，
      // 所以「唤醒后马上检查一轮」是免费拿到的，不需要额外处理。
      // 这里只续期防休眠请求，不重建 alarm —— 周期性 alarm 自己会继续跑。
      applyKeepAwake(await loadConfig());
      await startCycle(false);
    }
  })();
});

chrome.notifications.onClicked.addListener((notificationId) => {
  void (async () => {
    const url = await takeNotificationUrl(notificationId);
    if (url) await chrome.tabs.create({ url });
    await chrome.notifications.clear(notificationId);
  })();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message?.type) {
    case "WATCH_RESULT":
      void handleWatchResult(sender.tab?.id, message);
      return undefined;

    case "RUN_NOW":
      void startCycle(true).then((note) => sendResponse({ note }));
      return true;

    case "CONFIG_SAVED":
      void (async () => {
        await applyConfig(await loadConfig());
        sendResponse({ ok: true });
      })();
      return true;

    case "CLEAR_UNREAD":
      void (async () => {
        await patchState({ unreadCount: 0 });
        await refreshBadge();
        sendResponse({ ok: true });
      })();
      return true;

    case "RESET_SEEN":
      void (async () => {
        await resetSeen(message.watchId);
        sendResponse({ ok: true });
      })();
      return true;

    case "TEST_NOTIFY":
      void (async () => {
        const errors = await sendTestNotification(await loadConfig());
        sendResponse({ errors });
      })();
      return true;

    default:
      return undefined;
  }
});

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
