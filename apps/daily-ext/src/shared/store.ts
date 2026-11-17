/**
 * Everything the extension keeps, all in `chrome.storage.local` (never synced,
 * never sent anywhere — the privacy page at daily.lab115.com/extension says
 * exactly this list, so a new key here means a change there too):
 *
 *   lang       the reader's chosen language; absent = follow the browser
 *   feed:zh    last fetched Chinese feed, for an instant open and offline reading
 *   feed:en    same, English
 *   seenDate   newest digest date the reader has had the side panel open on —
 *              the badge shows while the feed has a newer one
 */

import { datesOf, fetchFeed, type Feed, type Lang } from "./feed.ts";

const LANG_KEY = "lang";
const SEEN_KEY = "seenDate";
const feedKey = (lang: Lang) => `feed:${lang}`;

/** The browser's UI language decides the default: any Chinese variant reads the Chinese feed. */
export function browserLang(): Lang {
  return chrome.i18n.getUILanguage().toLowerCase().startsWith("zh") ? "zh" : "en";
}

export async function getLang(): Promise<Lang> {
  const stored = (await chrome.storage.local.get(LANG_KEY))[LANG_KEY];
  return stored === "zh" || stored === "en" ? stored : browserLang();
}

export async function setLang(lang: Lang): Promise<void> {
  await chrome.storage.local.set({ [LANG_KEY]: lang });
}

const asFeed = (stored: unknown): Feed | null =>
  stored && Array.isArray((stored as Feed).entries) ? (stored as Feed) : null;

export async function getCachedFeed(lang: Lang): Promise<Feed | null> {
  return asFeed((await chrome.storage.local.get(feedKey(lang)))[feedKey(lang)]);
}

/** Fetch, and keep the copy only when the fetch succeeded — a failure never wipes the cache. */
export async function refreshFeed(lang: Lang): Promise<Feed> {
  const feed = await fetchFeed(lang);
  await chrome.storage.local.set({ [feedKey(lang)]: feed });
  return feed;
}

/**
 * Show the newest digest's article count on the toolbar icon, unless the reader
 * has already had the side panel open on that digest.
 *
 * Counts only the newest day: "12" means "today's edition has 12 picks", which
 * is what the number is for, not a backlog the reader is expected to clear.
 */
export async function updateBadge(feed: Feed): Promise<void> {
  const newest = datesOf(feed)[0];
  const seen = (await chrome.storage.local.get(SEEN_KEY))[SEEN_KEY];
  const count = newest ? feed.entries.filter((entry) => entry.date === newest).length : 0;
  const text = newest && newest !== seen && count > 0 ? String(count) : "";
  await chrome.action.setBadgeText({ text });
  if (text) {
    // The site's brand yellow as a fill with ink on it — yellow text is never used.
    await chrome.action.setBadgeBackgroundColor({ color: "#F7C948" });
    await chrome.action.setBadgeTextColor({ color: "#2F3542" });
  }
}

/** Having the side panel open on a digest counts as having seen it. */
export async function markSeen(feed: Feed): Promise<void> {
  const newest = datesOf(feed)[0];
  if (!newest) return;
  await chrome.storage.local.set({ [SEEN_KEY]: newest });
  await chrome.action.setBadgeText({ text: "" });
}

/**
 * Follow the store while the side panel stays open, which can be all day:
 * `onFeed` gets every newly saved copy of `lang`'s feed (the background's
 * 30-minute poll, or this panel's own fetch), `onLang` a language switched in
 * another window's panel. Returns the unsubscribe function.
 */
export function watchStore(
  lang: Lang,
  handlers: { onFeed: (feed: Feed) => void; onLang: (lang: Lang) => void },
): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local") return;
    const feed = asFeed(changes[feedKey(lang)]?.newValue);
    if (feed) handlers.onFeed(feed);
    const switched = changes[LANG_KEY]?.newValue;
    if ((switched === "zh" || switched === "en") && switched !== lang) handlers.onLang(switched);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
