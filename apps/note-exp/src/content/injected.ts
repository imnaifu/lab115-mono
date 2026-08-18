/**
 * Injected Script
 *
 * This script is injected into the page's JavaScript context (not content script context).
 * It runs in the same context as the page's own scripts, so it can properly intercept
 * fetch and XHR requests before the page code can save references to them.
 *
 * Communication with content script is done via window.postMessage.
 */

(function () {
  "use strict";

  // Check if already injected
  if ((window as any).__XHS_EXPORTER_INJECTED__) {
    return;
  }
  (window as any).__XHS_EXPORTER_INJECTED__ = true;

  // Note items accumulated from EVERY list source: search results, the
  // homepage feed (API + SSR first screen) and user-profile note lists. The
  // cache is never reset automatically — navigating between pages or searches
  // keeps accumulating; only the popup's Clear button empties it.
  let cachedListItems: any[] = [];
  // Track note ids we've already cached. List APIs are paginated and different
  // sources can return the same note, so we dedupe by `item.id` to avoid
  // duplicate rows in the exported CSV.
  const seenNoteIds = new Set<string>();
  // Total items received across all responses BEFORE dedup, so the popup can
  // show how many duplicates were skipped.
  let totalReceived = 0;
  // Set when the user clears via the popup. Stops the SSR homefeed seeding
  // below from instantly re-adding the homepage first screen after a clear
  // (those notes are still in __INITIAL_STATE__, but the user asked for them
  // to be gone; a page reload starts seeding again).
  let listCleared = false;

  // Raw single-post items captured from the note-detail (feed) endpoint —
  // both image (图文) and video notes. We store raw items (mirroring
  // cachedListItems) and let the popup parse them with utils/video,
  // keeping this injected script dependency-free.
  let cachedPostItems: any[] = [];
  // Dedupe posts by id; the same post can be re-fetched on revisit.
  const seenPostIds = new Set<string>();

  // Note-list API endpoints we intercept (GET or POST):
  // - search:   so.xiaohongshu.com/api/sns/web/v2/search/notes
  //             edith.xiaohongshu.com/api/sns/web/v1/search/notes (legacy)
  // - homepage: /api/sns/web/v1/homefeed (scroll-loaded recommend feed)
  // - profile:  /api/sns/web/v1/user_posted (a user's posted notes)
  // Host differs per endpoint/version but all are under xiaohongshu.com /
  // rednote.com, which the domain check below already covers.
  const NOTE_LIST_PATHS = [
    "/api/sns/web/v2/search/notes",
    "/api/sns/web/v1/search/notes",
    "/api/sns/web/v1/homefeed",
    "/api/sns/web/v1/user_posted",
  ];

  // Note-detail (feed) endpoint. Unlike the search/list endpoints above, the
  // feed response carries the playable video stream URLs under
  // note_card.video.media.stream, so we hook it separately to capture videos.
  const NOTE_FEED_PATHS = ["/api/sns/web/v1/feed"];

  /**
   * Normalizes a possibly protocol-relative or relative URL to an absolute one,
   * so the path/domain checks below see a consistent form.
   */
  function normalizeUrl(url: string): string {
    if (url.startsWith("//")) return `https:${url}`;
    if (!url.includes("://")) {
      return new URL(url, window.location.origin).toString();
    }
    return url;
  }

  /**
   * Whether a URL is on the Xiaohongshu/RedNote domains we care about.
   * rednote.com (the overseas brand) may serve the API from its own host
   * (edith.rednote.com) or still proxy to xiaohongshu.com, so we accept either
   * domain rather than hardcoding one.
   */
  function isKnownDomain(normalized: string): boolean {
    return (
      normalized.includes("xiaohongshu.com") ||
      normalized.includes("rednote.com")
    );
  }

  /**
   * Checks if a URL is one of the Xiaohongshu note-list API endpoints.
   */
  function isNoteListAPI(url: string): boolean {
    if (!url) return false;
    const normalized = normalizeUrl(url);
    return (
      isKnownDomain(normalized) &&
      NOTE_LIST_PATHS.some((path) => normalized.includes(path))
    );
  }

  /**
   * Checks if a URL is the Xiaohongshu note-detail (feed) API endpoint.
   */
  function isNoteFeedAPI(url: string): boolean {
    if (!url) return false;
    const normalized = normalizeUrl(url);
    return (
      isKnownDomain(normalized) &&
      NOTE_FEED_PATHS.some((path) => normalized.includes(path))
    );
  }

  /**
   * Send message to content script
   */
  function sendToContentScript(message: any) {
    window.postMessage(
      {
        source: "xhs-exporter-injected",
        ...message,
      },
      "*"
    );
  }

  /**
   * Recursively converts an object's keys from camelCase to snake_case (arrays
   * are mapped, primitives pass through). Xiaohongshu's SSR state
   * (__INITIAL_STATE__) uses camelCase while its API responses use snake_case;
   * converting makes an SSR note match the feed-API shape the popup parser
   * (utils/video) already understands, so one parser handles both sources.
   */
  function camelToSnakeDeep(value: any): any {
    if (Array.isArray(value)) return value.map(camelToSnakeDeep);
    if (value && typeof value === "object") {
      const out: Record<string, any> = {};
      for (const key of Object.keys(value)) {
        const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        out[snakeKey] = camelToSnakeDeep(value[key]);
      }
      return out;
    }
    return value;
  }

  /**
   * Seeds cachedPostItems from window.__INITIAL_STATE__ when the note the user
   * is currently viewing isn't already captured. Detail pages opened directly
   * (or reached via SPA navigation from search) are server-rendered: the note
   * lives in note.noteDetailMap and NO feed API request fires, so the network
   * hooks never see it. Values are wrapped in Vue refs ({ __v_isRef, _value }),
   * which a JSON replacer strips; the plain camelCase note is then converted to
   * the snake_case feed-item shape ({ id, xsec_token, note_card }) so it flows
   * through the same pipeline as intercepted feed items.
   */
  function captureInitialStateNote() {
    try {
      const state = (window as any).__INITIAL_STATE__;
      const noteStore = state?.note;
      if (!noteStore) return;
      // Top-level store values are Vue refs; unwrap to the underlying value.
      const unref = (val: any) =>
        val && typeof val === "object" && val.__v_isRef ? val._value : val;

      const detailMap = unref(noteStore.noteDetailMap);
      if (!detailMap) return;
      const currentId =
        unref(noteStore.currentNoteId) ||
        unref(noteStore.firstNoteId) ||
        Object.keys(detailMap)[0];
      // Cheap guard: skip the heavy serialization below once this note is cached
      // (the 1s popup poll calls this repeatedly).
      if (!currentId || seenPostIds.has(currentId)) return;

      const entry = unref(detailMap[currentId]);
      const rawNote = entry && unref(entry.note);
      if (!rawNote) return;

      // Strip Vue refs/reactivity to a plain camelCase object, then convert to
      // the snake_case shape parseNoteDetail expects.
      const plainNote = JSON.parse(
        JSON.stringify(rawNote, (_key, val) =>
          val && typeof val === "object" && val.__v_isRef ? val._value : val
        )
      );
      const noteCard = camelToSnakeDeep(plainNote);
      const id = noteCard.note_id ?? currentId;
      if (seenPostIds.has(id)) return;
      seenPostIds.add(id);
      cachedPostItems = [
        ...cachedPostItems,
        // note-level xsec_token is the working, note-scoped token for the link.
        { id, xsec_token: noteCard.xsec_token ?? "", note_card: noteCard },
      ];
    } catch {
      // __INITIAL_STATE__ shape changed or unreadable — fail quietly.
    }
  }

  /**
   * Wraps a raw list-API entry into the { id, xsec_token, note_card } shape the
   * popup parser expects, or returns null for non-note entries (e.g. the
   * model_type "hot_query" recommend chips search responses interleave).
   * Search/homefeed items already carry note_card; user_posted returns bare
   * notes with note_id and the card fields at the top level, so those get
   * wrapped instead.
   */
  function toListItem(item: any): any | null {
    if (item?.note_card) return item;
    if (item?.note_id) {
      return {
        id: item.note_id,
        xsec_token: item.xsec_token ?? "",
        note_card: item,
      };
    }
    return null;
  }

  /**
   * Appends normalized list items to the cache, deduping by id, and updates
   * the before-dedup counter the popup shows as "received".
   */
  function appendListItems(items: any[]) {
    totalReceived += items.length;
    const uniqueNewItems = items.filter((item) => {
      const id = item?.id;
      if (!id || seenNoteIds.has(id)) return false;
      seenNoteIds.add(id);
      return true;
    });
    cachedListItems = [...cachedListItems, ...uniqueNewItems];
  }

  /**
   * Seeds cachedListItems from window.__INITIAL_STATE__'s homepage feed store.
   * The homepage first screen is server-rendered: those notes never hit the
   * homefeed API, so the network hooks can't see them. Only runs on the actual
   * homepage ("/" or "/explore" — note detail pages are "/explore/<id>"), and
   * stops after the user clears so cleared notes don't instantly reappear from
   * the still-populated SSR store (a page reload starts seeding again).
   */
  function captureInitialStateHomeFeed() {
    if (listCleared) return;
    const path = window.location.pathname;
    if (path !== "/" && path !== "/explore") return;
    try {
      const state = (window as any).__INITIAL_STATE__;
      const feedStore = state?.feed;
      if (!feedStore) return;
      // Top-level store values are Vue refs; unwrap to the underlying value.
      const unref = (val: any) =>
        val && typeof val === "object" && val.__v_isRef ? val._value : val;

      const feeds = unref(feedStore.feeds);
      if (!Array.isArray(feeds)) return;

      const freshItems: any[] = [];
      for (const rawItem of feeds) {
        const id = unref(rawItem?.id);
        // Cheap guard: skip the heavy serialization below for already-cached
        // notes (the 1s popup poll calls this repeatedly).
        if (!id || seenNoteIds.has(id)) continue;
        // Strip Vue refs/reactivity to a plain camelCase object, then convert
        // to the snake_case list-item shape the popup parser expects.
        const plainItem = JSON.parse(
          JSON.stringify(rawItem, (_key, val) =>
            val && typeof val === "object" && val.__v_isRef ? val._value : val
          )
        );
        if (plainItem?.modelType !== "note" || !plainItem.noteCard) continue;
        freshItems.push({
          id,
          xsec_token: plainItem.xsecToken ?? "",
          note_card: camelToSnakeDeep(plainItem.noteCard),
        });
      }
      if (freshItems.length) appendListItems(freshItems);
    } catch {
      // __INITIAL_STATE__ shape changed or unreadable — fail quietly.
    }
  }

  function hookXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      (this as any)._url = typeof url === "string" ? url : url.toString();
      return originalOpen.call(
        this,
        method,
        url,
        async ?? true,
        username ?? null,
        password ?? null
      );
    };

    XMLHttpRequest.prototype.send = function (
      body?: Document | XMLHttpRequestBodyInit | null
    ) {
      const url = (this as any)._url;
      const isList = isNoteListAPI(url);
      const isFeed = isNoteFeedAPI(url);
      if (!url || (!isList && !isFeed)) {
        return originalSend.call(this, body);
      }

      const handleResponse = () => {
        if (this.status !== 200) return;
        const data = JSON.parse(this.responseText);
        const allItems = data?.data?.items || [];

        if (isList) {
          // user_posted responses put the notes under data.notes; the other
          // list endpoints use data.items. Normalize entries and keep only
          // real note items so non-note cards don't pollute the received /
          // unique / duplicate counts.
          const listEntries = data?.data?.items ?? data?.data?.notes ?? [];
          const noteItems = listEntries.map(toListItem).filter(Boolean);
          appendListItems(noteItems);
          sendToContentScript({
            type: "DATA_CACHED",
            data: cachedListItems,
            url,
            count: cachedListItems.length,
            totalReceived,
          });
        }

        if (isFeed) {
          // The feed endpoint returns the full note (image_list for 图文 posts,
          // and video.media.stream URLs for video posts). Keep every note that
          // has a note_card — the popup decides what's downloadable — and dedupe
          // by id so revisiting the same post doesn't add duplicates.
          const postItems = allItems.filter((item: any) => item?.note_card);
          const uniquePosts = postItems.filter((item: any) => {
            const id = item?.id;
            if (!id || seenPostIds.has(id)) return false;
            seenPostIds.add(id);
            return true;
          });

          cachedPostItems = [...cachedPostItems, ...uniquePosts];
          sendToContentScript({
            type: "POST_CACHED",
            data: cachedPostItems,
            url,
            count: cachedPostItems.length,
          });
        }
      };

      this.addEventListener("loadend", handleResponse);
      return originalSend.call(this, body);
    };
  }

  /**
   * Initialize hooks
   */
  function initHooks() {
    hookXHR();
  }

  /**
   * Listen for messages from content script
   */
  window.addEventListener("message", (event) => {
    // Only accept messages from our content script
    if (event.data?.source !== "xhs-exporter-content") {
      return;
    }

    const { action } = event.data;

    switch (action) {
      case "getData":
        // The homepage first screen is server-rendered and fires no list API
        // request; pull it from __INITIAL_STATE__ so the list tab still gets it.
        captureInitialStateHomeFeed();
        sendToContentScript({
          type: "DATA_RESPONSE",
          data: cachedListItems,
          // count is the true unique (deduped) item count; totalReceived is the
          // raw count before dedup, so the popup can show duplicates skipped.
          count: cachedListItems.length,
          totalReceived,
        });
        break;
      case "getPosts":
        // Server-rendered detail pages make no feed request; pull the currently
        // open note from __INITIAL_STATE__ so the post tab still gets it.
        captureInitialStateNote();
        sendToContentScript({
          type: "POST_RESPONSE",
          data: cachedPostItems,
          count: cachedPostItems.length,
        });
        break;
      case "clearData":
        // Reset all accumulated state so capturing starts clean
        cachedListItems = [];
        seenNoteIds.clear();
        totalReceived = 0;
        // Stop SSR homefeed seeding from re-adding the homepage first screen
        // the user just cleared (see captureInitialStateHomeFeed).
        listCleared = true;
        // Also drop captured posts so Clear resets both lists together
        cachedPostItems = [];
        seenPostIds.clear();
        sendToContentScript({
          type: "DATA_CACHED",
          data: cachedListItems,
          count: 0,
          totalReceived: 0,
        });
        break;
    }
  });

  initHooks();
})();
