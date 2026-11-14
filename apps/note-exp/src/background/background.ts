/**
 * Background Service Worker
 *
 * Owns file downloads so the extension-chosen path (folder + filename) is
 * actually honored. Passing `filename` to chrome.downloads.download is
 * unreliable for remote URLs: a server Content-Disposition header (or another
 * download-related extension) can override it, which made our downloads land
 * flat in the Downloads root with server-derived names. The
 * chrome.downloads.onDeterminingFilename event has the final say on the target
 * path, so we force our intended path there.
 *
 * (CSV export still happens in the popup via a Blob + <a download>, which names
 * its file reliably and doesn't need this path.)
 *
 * It also sends the anonymous usage stats (see "Usage stats" below), so an
 * event the popup reports still goes out after the popup has closed.
 */

// Maps a download URL to the relative path we want Chrome to save it under.
// Populated just before download() is called and consumed by the listener.
const pendingPaths = new Map<string, string>();

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  const desired = pendingPaths.get(item.url) ?? pendingPaths.get(item.finalUrl);
  if (desired) {
    pendingPaths.delete(item.url);
    pendingPaths.delete(item.finalUrl);
    // uniquify: append " (1)", " (2)"… rather than overwrite if it exists.
    suggest({ filename: desired, conflictAction: "uniquify" });
    return;
  }
  // Not one of ours — let Chrome name it as usual.
  suggest();
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "downloadResource") {
    // request: { urls: string[], filename: string }
    // Try each candidate URL (primary + CDN backups) until one starts.
    (async () => {
      for (const url of request.urls || []) {
        // Register the intended path BEFORE download() so onDeterminingFilename
        // (which fires during filename determination) can apply it.
        pendingPaths.set(url, request.filename);
        try {
          const id = await chrome.downloads.download({ url });
          // `index` tells the popup which candidate started, e.g. whether a
          // video came from the watermark-free original or a fallback stream.
          sendResponse({ ok: true, id, index: request.urls.indexOf(url) });
          return;
        } catch {
          pendingPaths.delete(url);
          // try next backup URL
        }
      }
      sendResponse({ ok: false });
    })();
    return true; // keep the message channel open for the async sendResponse
  }
  if (request.action === "track") {
    // request: { name: string, data?: object }; fire-and-forget from the popup.
    track(request.name, request.data);
    return undefined;
  }
  return undefined;
});

// ------------------------------------------------------------- Usage stats
// Anonymous feature-usage events sent to our self-hosted Umami
// (stats.lab115.com), so we can see which features people actually use. The
// privacy policy (site/strings.py, "privacy") lists every event and field; keep
// it in step with this file and with the popup's track() calls. Never send note
// ids, links, titles, authors, search words or file names.
//
// The endpoint answers CORS for any origin, so no host permission is needed —
// adding one would show a new warning and disable the extension on update
// until the user re-approves it.
const STATS_ENDPOINT = "https://stats.lab115.com/api/send";
const STATS_WEBSITE_ID = "af0cd472-303b-4978-b936-b1703ae500bf";
// Written by the popup's settings menu; anything but `false` means on.
const STATS_ENABLED_KEY = "statsEnabled";
const INSTALL_ID_KEY = "installId";
const SITE_ORIGIN = "https://rednote.lab115.com";

/** Random 16-hex-digit id, made once per install, to count users and see who comes back. */
let installIdPromise: Promise<string> | null = null;
function getInstallId(): Promise<string> {
  // Cached so the install event and a popup opened right away can't each
  // create their own id.
  installIdPromise ??= (async () => {
    const stored = await chrome.storage.local.get(INSTALL_ID_KEY);
    if (typeof stored[INSTALL_ID_KEY] === "string") return stored[INSTALL_ID_KEY];
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    await chrome.storage.local.set({ [INSTALL_ID_KEY]: id });
    return id;
  })();
  return installIdPromise;
}

async function statsEnabled(): Promise<boolean> {
  const stored = await chrome.storage.local.get(STATS_ENABLED_KEY);
  return stored[STATS_ENABLED_KEY] !== false;
}

type StatsData = Record<string, string | number>;

async function track(name: string, data: StatsData = {}): Promise<void> {
  try {
    if (!(await statsEnabled())) return;
    const install = await getInstallId();
    const version = chrome.runtime.getManifest().version;
    await fetch(STATS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "event",
        payload: {
          website: STATS_WEBSITE_ID,
          hostname: "extension",
          url: `/${name}`,
          language: chrome.i18n.getUILanguage(),
          name,
          // Umami's distinct id: ties one install's sessions together.
          id: install,
          data: { ...data, version, install },
        },
      }),
    });
  } catch {
    // Offline or blocked: losing a stat must never affect the extension.
  }
}

/** The site's path prefix for the browser's language, matching site/strings.py. */
function sitePathForBrowser(): string {
  const ui = chrome.i18n.getUILanguage().toLowerCase();
  if (ui.startsWith("zh")) return /(tw|hk|mo|hant)/.test(ui) ? "/zh-tw/" : "/zh/";
  const base = ui.slice(0, 2);
  return ["ko", "ja", "vi"].includes(base) ? `/${base}/` : "/";
}

/**
 * Chrome opens this page after the extension is removed: it asks why, and the
 * site's own stats count the visit. It carries the version, plus the install id
 * while stats are on, so a reason can be matched to what that install used.
 */
async function setUninstallPage(): Promise<void> {
  try {
    const params = new URLSearchParams({ v: chrome.runtime.getManifest().version });
    if (await statsEnabled()) params.set("i", await getInstallId());
    await chrome.runtime.setUninstallURL(`${SITE_ORIGIN}${sitePathForBrowser()}bye/?${params}`);
  } catch {
    // ignore: the uninstall page is a nicety
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    track("install");
  } else if (details.reason === "update") {
    const version = chrome.runtime.getManifest().version;
    // Chrome also fires "update" on a reload with the same version (development).
    if (details.previousVersion !== version) track("update", { from: details.previousVersion ?? "" });
  }
  setUninstallPage();
});

// Turning stats off in the popup drops the install id from the uninstall page.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && STATS_ENABLED_KEY in changes) setUninstallPage();
});

export {};
