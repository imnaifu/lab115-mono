/**
 * The service worker: make the toolbar icon open the side panel, and notice a
 * new edition. Reading happens in the side panel.
 *
 * The digest is published once a day (07:00 Los Angeles), so a 30-minute poll
 * finds it within half an hour, costs 48 small requests a day, and lines up with
 * the edge cache's own 30-minute lifetime — polling faster would mostly be
 * answered from that cache anyway.
 */

import { getLang, markSeen, refreshFeed, updateBadge } from "../shared/store.ts";

const ALARM = "refresh";
const PERIOD_MINUTES = 30;

// Clicking the toolbar icon opens the side panel (manifest `side_panel`) instead
// of a popup. Called on every service-worker start: it is cheap, and it means
// the behaviour never depends on an install event having run.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.warn("[daily-picks] setPanelBehavior failed:", error));

/** Is the side panel open in any window? */
async function panelOpen(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.SIDE_PANEL],
  });
  return contexts.length > 0;
}

async function refresh(): Promise<void> {
  try {
    const feed = await refreshFeed(await getLang());
    // The open panel re-renders from storage on its own (App.tsx listens), so a
    // reader looking at it already sees the new edition: count it as seen
    // instead of putting a number on the icon next to the list it describes.
    // Deciding here, not in the panel, keeps one writer of the badge per
    // refresh, so a panel-side "seen" can never race a badge set after it.
    if (await panelOpen()) await markSeen(feed);
    else await updateBadge(feed);
  } catch (error) {
    // Offline or the site is down: keep the cache and the badge as they are,
    // and try again on the next alarm.
    console.warn("[daily-picks] refresh failed:", error);
  }
}

/**
 * Chrome documents that alarms "may be cleared upon browser restart", so the
 * alarm is re-checked on every startup, not only created on install.
 * `create` with an existing name replaces it, so this can never stack alarms.
 */
async function ensureAlarm(): Promise<void> {
  if (await chrome.alarms.get(ALARM)) return;
  await chrome.alarms.create(ALARM, {
    periodInMinutes: PERIOD_MINUTES,
    delayInMinutes: PERIOD_MINUTES,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureAlarm();
  void refresh();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureAlarm();
  void refresh();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void refresh();
});
