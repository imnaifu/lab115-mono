/**
 * Content Script
 *
 * Content scripts run in an isolated context from the page's JavaScript.
 * To properly intercept fetch/XHR, we inject a script into the page context.
 *
 * This script:
 * 1. Injects injected.js into the page's JavaScript context
 * 2. Listens for messages from the injected script
 * 3. Relays messages between popup/background and injected script
 */

// Store intercepted API responses (synced from injected script)
let cachedListItems: any[] = [];

/**
 * Inject the injected script into the page context
 * This allows us to hook fetch/XHR in the same context as page scripts
 */
function injectScript() {
  // Check if already injected
  if (document.documentElement.getAttribute("data-xhs-exporter-injected")) {
    return;
  }

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.onload = function () {
    // Mark as injected
    document.documentElement.setAttribute("data-xhs-exporter-injected", "true");
    console.log("[Extension] Injected script loaded successfully");
    // Remove the script tag after injection
    const scriptElement = this as HTMLScriptElement;
    if (scriptElement.parentNode) {
      scriptElement.parentNode.removeChild(scriptElement);
    }
  };
  script.onerror = function () {
    console.error("[Extension] Failed to load injected script");
  };
  (document.head || document.documentElement).appendChild(script);
}

/**
 * Send message to injected script
 */
function sendToInjectedScript(message: any) {
  window.postMessage(
    {
      source: "xhs-exporter-content",
      ...message,
    },
    "*"
  );
}

/**
 * Listen for messages from injected script
 */
window.addEventListener("message", (event) => {
  // Only accept messages from our injected script
  if (event.data?.source !== "xhs-exporter-injected") {
    return;
  }

  const { type, ...data } = event.data;

  switch (type) {
    case "DATA_CACHED":
      cachedListItems = data.data;
      break;
  }
});

/**
 * Message handler for content script
 * Listens for messages from popup or background script
 * and forwards them to the injected script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractPostData") {
    // Forward to injected script to get data
    sendToInjectedScript({ action: "getData" });

    // Wait for response from injected script
    const handler = (event: MessageEvent) => {
      if (
        event.data?.source === "xhs-exporter-injected" &&
        event.data?.type === "DATA_RESPONSE"
      ) {
        window.removeEventListener("message", handler);
        if (event.data.data) {
          cachedListItems = event.data.data;
          sendResponse({
            data: event.data.data,
            count: event.data.count ?? 0,
            totalReceived: event.data.totalReceived ?? 0,
          });
        }
      }
    };
    window.addEventListener("message", handler);

    return true; // Indicate async response
  }

  if (request.action === "getPostData") {
    // Ask the injected script for captured single-post notes (image + video)
    // and relay them back. Mirrors the extractPostData flow above but for the
    // feed/post-detail cache.
    sendToInjectedScript({ action: "getPosts" });

    const handler = (event: MessageEvent) => {
      if (
        event.data?.source === "xhs-exporter-injected" &&
        event.data?.type === "POST_RESPONSE"
      ) {
        window.removeEventListener("message", handler);
        sendResponse({
          data: event.data.data ?? [],
          count: event.data.count ?? 0,
        });
      }
    };
    window.addEventListener("message", handler);

    return true; // Indicate async response
  }

  if (request.action === "clearData") {
    // Forward clear request to injected script and ack synchronously
    sendToInjectedScript({ action: "clearData" });
    sendResponse({ success: true });
  }
});

// Inject script immediately when content script loads
// This ensures hooks are installed before any page scripts run
injectScript();

// Also try injecting on DOMContentLoaded as backup
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    // Check if already injected, if not inject again
    if (!document.documentElement.getAttribute("data-xhs-exporter-injected")) {
      console.log("[Extension] Retrying script injection on DOMContentLoaded");
      injectScript();
    }
  });
}
