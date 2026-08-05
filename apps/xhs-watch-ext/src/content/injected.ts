/**
 * 注入到页面 JS 上下文的脚本（不是 content script 上下文）。
 *
 * 为什么要用浏览器而不是直接发 HTTP：搜索接口需要 x-s / x-t 签名，由页面里混淆过的
 * JS 生成。让真实页面自己发请求、我们只监听 response，就永远不用逆向也不用跟版。
 *
 * 为什么拦 XHR 而不是解析 DOM：拿到的是结构化 JSON，UI 改版不影响。
 *
 * 必须注入到页面上下文才能在页面代码保存 XMLHttpRequest / fetch 引用之前替换掉它们；
 * content script 的隔离世界里改不到页面用的那份。
 *
 * 本文件刻意不 import 任何模块 —— 它以普通 <script> 加载，不能是 ES module。
 */
(function () {
  "use strict";

  if ((window as any).__XHS_WATCH_INJECTED__) return;
  (window as any).__XHS_WATCH_INJECTED__ = true;

  /**
   * 按「响应批次」保存而不是拍平成一个大数组：切到「最新」排序后返回的是另一批结果，
   * content script 需要能只取切换之后的那几批。
   */
  const batches: unknown[][] = [];
  /** 防御性上限，避免用户长时间停留在搜索页时无限增长。 */
  const MAX_BATCHES = 40;

  function normalizeUrl(url: string): string {
    if (url.startsWith("//")) return `https:${url}`;
    if (!url.includes("://")) return new URL(url, window.location.origin).toString();
    return url;
  }

  /**
   * 匹配任意小红书域下路径含 /search/ 的接口，而不是写死
   * /api/sns/web/v2/search/notes —— 普通搜索页、AI 搜索页（search_result_ai）
   * 和后续接口升版走的路径都不一样，通配才不会因为换了个页面就抓不到。
   */
  function isSearchApi(url: string): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(normalizeUrl(url));
      const host = parsed.hostname;
      if (!host.endsWith("xiaohongshu.com")) return false;
      return parsed.pathname.includes("/search/");
    } catch {
      return false;
    }
  }

  /** 从响应体里挖出笔记列表；不同接口分别放在 data.items / data.notes 下。 */
  function extractItems(responseText: string): unknown[] | null {
    let payload: any;
    try {
      payload = JSON.parse(responseText);
    } catch {
      return null;
    }
    const items = payload?.data?.items ?? payload?.data?.notes;
    if (!Array.isArray(items) || items.length === 0) return null;
    // 只保留带 note_card 的条目，推荐搜索词之类的卡片不算。
    const notes = items.filter((item: any) => item?.note_card ?? item?.noteCard);
    return notes.length > 0 ? notes : null;
  }

  function recordBatch(items: unknown[]) {
    batches.push(items);
    if (batches.length > MAX_BATCHES) batches.shift();
    post({ type: "BATCH", batchCount: batches.length, itemCount: items.length });
  }

  function post(message: Record<string, unknown>) {
    window.postMessage({ source: "xhs-watch-injected", ...message }, "*");
  }

  function hookXhr() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      (this as any).__xhsWatchUrl = typeof url === "string" ? url : url.toString();
      return originalOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
    };

    XMLHttpRequest.prototype.send = function (body?: XMLHttpRequestBodyInit | null) {
      const url = (this as any).__xhsWatchUrl as string | undefined;
      if (url && isSearchApi(url)) {
        this.addEventListener("loadend", () => {
          if (this.status !== 200) return;
          const items = extractItems(this.responseText);
          if (items) recordBatch(items);
        });
      }
      return originalSend.call(this, body);
    };
  }

  /**
   * fetch 也要 hook：页面在不同代码路径上两者都用过，只挂一个会漏。
   * 用 clone() 读取，绝不消耗页面自己要用的那个 body stream。
   */
  function hookFetch() {
    const originalFetch = window.fetch;
    if (typeof originalFetch !== "function") return;

    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request)?.url;

      const promise = originalFetch.call(window, input as RequestInfo, init);
      if (!url || !isSearchApi(url)) return promise;

      return promise.then((response) => {
        if (response.ok) {
          response
            .clone()
            .text()
            .then((text) => {
              const items = extractItems(text);
              if (items) recordBatch(items);
            })
            .catch(() => undefined);
        }
        return response;
      });
    } as typeof window.fetch;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== "xhs-watch-content") return;

    if (event.data.action === "getCapture") {
      // 结构化克隆会复制整个数组，postMessage 传出去后两边互不影响。
      post({ type: "CAPTURE", batches });
    }
  });

  hookXhr();
  hookFetch();
  post({ type: "READY" });
})();
