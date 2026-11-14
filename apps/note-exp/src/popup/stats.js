// Anonymous usage stats from the popup. The background worker does the
// sending (and skips it when the user turned stats off), so an event fired just
// before the popup closes still goes out. Every event and field is listed in
// the privacy policy (site/strings.py); keep the two in step.

export const STATS_ENABLED_KEY = "statsEnabled";

/** Fire-and-forget: a lost stat must never get in the way of the popup. */
export function track(name, data = {}) {
  try {
    chrome.runtime.sendMessage({ action: "track", name, data }).catch(() => {});
  } catch {
    // runtime unavailable (e.g. the popup previewed outside the extension)
  }
}

/** Whether stats are on; anything but an explicit `false` means on. */
export async function readStatsEnabled() {
  try {
    const stored = await chrome.storage.local.get(STATS_ENABLED_KEY);
    return stored[STATS_ENABLED_KEY] !== false;
  } catch {
    return true;
  }
}

export async function writeStatsEnabled(enabled) {
  try {
    await chrome.storage.local.set({ [STATS_ENABLED_KEY]: enabled });
  } catch {
    // storage unavailable: the toggle just won't stick
  }
}

/**
 * The kind of page a tab shows, from its URL — only the kind is reported,
 * never the URL. `site` is "xhs" (xiaohongshu.com), "rednote" (rednote.com) or
 * "other".
 */
export function pageKind(url) {
  let parsed;
  try {
    parsed = new URL(url || "");
  } catch {
    return { site: "other", page: "other" };
  }
  const host = parsed.hostname;
  const site = host.endsWith("xiaohongshu.com") ? "xhs" : host.endsWith("rednote.com") ? "rednote" : "other";
  if (site === "other") return { site, page: "other" };
  const path = parsed.pathname;
  let page = "other";
  if (path === "/" || path === "/explore" || path === "/explore/") page = "home";
  else if (/^\/(explore|discovery\/item)\/[^/]+/.test(path)) page = "note";
  else if (path.startsWith("/search_result")) page = "search";
  // Collections are a tab of a profile page, so they count as profile here.
  else if (path.startsWith("/user/profile/")) page = "profile";
  return { site, page };
}
