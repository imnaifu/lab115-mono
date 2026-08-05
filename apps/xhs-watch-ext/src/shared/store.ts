/**
 * 所有持久化都走 chrome.storage.local。
 *
 * 为什么不是 localStorage：定时任务必须跑在 service worker 里，而 service worker
 * 没有 localStorage。chrome.storage.local 是等价物 —— 同样持久化、浏览器重启不丢，
 * 而且 popup 和 worker 能读同一份数据。
 */
import { withDefaults } from "./config";
import type { Config, LogEntry, Note, PendingRun, RunState } from "./types";

/** 每个 watch 记住多少条历史 id。够覆盖很多轮，又不会把存储撑爆。 */
const SEEN_CAP = 1000;
const LOG_CAP = 50;

const KEY_CONFIG = "config";
const KEY_STATE = "state";
const KEY_LOG = "log";
const KEY_PENDING_RUN = "pendingRun";

const seenIdsKey = (watchId: string) => `seenIds:${watchId}`;
const seenKeysKey = (watchId: string) => `seenKeys:${watchId}`;
const latestKey = (watchId: string) => `latest:${watchId}`;
const notificationUrlKey = (notificationId: string) => `notifUrl:${notificationId}`;

const EMPTY_STATE: RunState = {
  lastRunAt: null,
  lastOkAt: null,
  lastError: null,
  consecutiveFailures: 0,
  backoffUntil: null,
  lastAlertAt: null,
  unreadCount: 0,
};

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const bag = await chrome.storage.local.get(key);
  return (bag[key] as T | undefined) ?? fallback;
}

export async function loadConfig(): Promise<Config> {
  return withDefaults(await getLocal<Partial<Config> | undefined>(KEY_CONFIG, undefined));
}

export async function saveConfig(config: Config): Promise<Config> {
  const normalized = withDefaults(config);
  await chrome.storage.local.set({ [KEY_CONFIG]: normalized });
  return normalized;
}

export async function loadState(): Promise<RunState> {
  return { ...EMPTY_STATE, ...(await getLocal<Partial<RunState>>(KEY_STATE, {})) };
}

export async function patchState(patch: Partial<RunState>): Promise<RunState> {
  const next = { ...(await loadState()), ...patch };
  await chrome.storage.local.set({ [KEY_STATE]: next });
  return next;
}

export async function getSeen(watchId: string): Promise<{ ids: string[]; keys: string[] }> {
  const bag = await chrome.storage.local.get([seenIdsKey(watchId), seenKeysKey(watchId)]);
  return {
    ids: (bag[seenIdsKey(watchId)] as string[] | undefined) ?? [],
    keys: (bag[seenKeysKey(watchId)] as string[] | undefined) ?? [],
  };
}

/**
 * 把这一轮抓到的笔记全部记为已见 —— 包括因为太旧或点赞太少而没推送的那些，
 * 否则下一轮它们又会被算成「新」，每轮都重复提醒。
 */
export async function addSeen(watchId: string, notes: Note[]): Promise<void> {
  const seen = await getSeen(watchId);
  const ids = dedupeTail([...seen.ids, ...notes.map((note) => note.noteId)]);
  const keys = dedupeTail([...seen.keys, ...notes.map((note) => note.contentKey)]);
  await chrome.storage.local.set({
    [seenIdsKey(watchId)]: ids,
    [seenKeysKey(watchId)]: keys,
  });
}

/** 去重并只保留最近 SEEN_CAP 条（数组尾部 = 最近见到的）。 */
function dedupeTail(values: string[]): string[] {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.slice(Math.max(0, unique.length - SEEN_CAP));
}

export async function resetSeen(watchId: string): Promise<void> {
  await chrome.storage.local.remove([
    seenIdsKey(watchId),
    seenKeysKey(watchId),
    latestKey(watchId),
  ]);
}

/** 最近一轮抓到的前 N 条，给 popup 展示用。 */
export async function setLatest(watchId: string, notes: Note[]): Promise<void> {
  await chrome.storage.local.set({ [latestKey(watchId)]: notes });
}

export async function getLatest(watchId: string): Promise<Note[]> {
  return getLocal<Note[]>(latestKey(watchId), []);
}

export async function appendLog(entry: LogEntry): Promise<void> {
  const log = await getLocal<LogEntry[]>(KEY_LOG, []);
  await chrome.storage.local.set({ [KEY_LOG]: [entry, ...log].slice(0, LOG_CAP) });
}

export async function getLog(): Promise<LogEntry[]> {
  return getLocal<LogEntry[]>(KEY_LOG, []);
}

export async function getPendingRun(): Promise<PendingRun | null> {
  const bag = await chrome.storage.session.get(KEY_PENDING_RUN);
  return (bag[KEY_PENDING_RUN] as PendingRun | undefined) ?? null;
}

export async function setPendingRun(run: PendingRun | null): Promise<void> {
  if (run) await chrome.storage.session.set({ [KEY_PENDING_RUN]: run });
  else await chrome.storage.session.remove(KEY_PENDING_RUN);
}

/**
 * 通知点击后要打开的链接。存 session 而不是内存：worker 被回收后
 * onClicked 会重新拉起它，那时内存里的 Map 已经没了。
 */
export async function rememberNotificationUrl(
  notificationId: string,
  url: string,
): Promise<void> {
  await chrome.storage.session.set({ [notificationUrlKey(notificationId)]: url });
}

export async function takeNotificationUrl(notificationId: string): Promise<string | null> {
  const key = notificationUrlKey(notificationId);
  const bag = await chrome.storage.session.get(key);
  const url = (bag[key] as string | undefined) ?? null;
  if (url) await chrome.storage.session.remove(key);
  return url;
}
