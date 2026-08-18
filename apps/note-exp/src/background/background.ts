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
          sendResponse({ ok: true, id });
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
  return undefined;
});

export {};
