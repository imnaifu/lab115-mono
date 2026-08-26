/**
 * The service worker — served from the origin root so its scope is the whole site.
 *
 * It exists for two reasons and no others: Chrome will not offer to install a
 * page without one that handles `fetch`, and an installed app that shows a browser
 * error page when the train goes into a tunnel is not worth installing. It is not
 * here to make the site faster; the pages are server-rendered and already cheap.
 *
 * THE CONTENT CHANGES EVERY MORNING, and that decides the whole strategy. A cache
 * that serves yesterday's digest to someone who opened the app today would be a
 * bug dressed as an optimisation, so HTML is always fetched from the network first
 * and the cache is only the fallback for when there is no network. The only things
 * served from cache in preference to the network are the ones whose URLs change
 * when their contents do.
 *
 * Plain JS in `public/`, not a bundled module: a service worker has to be a single
 * file at a stable URL, and it is fetched by the browser rather than imported by
 * the app, so it never goes through the build.
 */

/**
 * Bump this to retire every cache the previous worker wrote.
 *
 * The name is the whole invalidation mechanism — `activate` deletes anything that
 * does not match — so a change that makes old cached entries wrong needs a new
 * version here, not a migration.
 *
 * v2: EVERY URL ON THE SITE CHANGED. The default language lost its prefix and the
 * dates went hierarchical, so a v1 cache is a set of documents at addresses that
 * now answer with a redirect. Nothing there is worth keeping — the offline
 * fallback is the only thing this cache is for, and a fallback to a stale URL is
 * worse than a miss.
 *
 * v3: THE MARK CHANGED AND THE ICON URLS DID NOT. `favicon.svg` and the PNGs were
 * redrawn while their filenames stayed put, and the icons were cache-first — so
 * every browser that had ever opened the site kept serving the old logo from its
 * v2 cache, indefinitely, with nothing on the page to reveal it. Bumping is what
 * releases them. The strategy change below is what stops it recurring; this bump
 * is still needed, because a v2 cache does not clear itself just because the new
 * worker would have written it differently.
 */
const VERSION = "v3";
const STATIC_CACHE = `daily-static-${VERSION}`;
const PAGE_CACHE = `daily-pages-${VERSION}`;
const KEEP = [STATIC_CACHE, PAGE_CACHE];

/**
 * How many pages to keep. A digest is one page per day plus one per article, so a
 * reader who browses a week's archive would otherwise accumulate a hundred-odd
 * documents against a quota they never agreed to. Trimmed oldest-first, which for
 * this cache is least-recently-fetched.
 */
const PAGE_LIMIT = 60;

/** Hashed by the build, so the URL changes whenever the bytes do. */
const IMMUTABLE = /^\/_next\/static\//;

/**
 * Our own icons and the manifest's siblings.
 *
 * NETWORK-FIRST, NOT CACHE-FIRST, and the comment at the top of this file is why:
 * cache-first is only ever correct for URLs that change with their contents, and
 * these four do not — `favicon.svg` is `favicon.svg` forever. They were cache-first
 * on the grounds that they are "rarely changed", which held right up until the mark
 * was redrawn; then every returning reader kept the old logo and no amount of
 * reloading dislodged it. See the v3 note above.
 *
 * Cheap to be honest about: four files, the largest 20KB, all of them served with
 * HTTP caching anyway, and none of them on the path to first paint. The cache entry
 * still exists — it is what answers when the train is in the tunnel.
 */
const ASSETS = /^\/(favicon\.svg|icon-\d+\.png|icon-maskable-\d+\.png|apple-touch-icon\.png)$/;

/**
 * The share posters, which live under `/share/` now rather than ending in
 * `share.png`. Deliberately NOT cached here.
 *
 * It is ~200KB per article, it is already served with an hour of HTTP caching, and
 * the sheet fetches it twice on purpose — once to show, once to hand to the OS.
 * The browser cache handles that pair; a second copy in here would double the
 * storage for no gain.
 */
const POSTER = /^\/share\//;

self.addEventListener("install", (event) => {
  // Nothing to precache: there is no static shell to warm, since every document
  // is server-rendered per request. Taking over immediately instead.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !KEEP.includes(name)).map((name) => caches.delete(name)),
      );
      // So the first load after an update is served by the new worker rather than
      // the next one.
      await self.clients.claim();
    })(),
  );
});

/** Cache-first, for URLs that change when their contents change. */
async function fromCacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/**
 * Network-first — with the cached copy as the offline fallback.
 *
 * The cache write is deliberately not awaited before the response is returned: the
 * reader should not wait on bookkeeping. The trim is fired the same way.
 *
 * TWO CALLERS, TWO CACHES. Documents go to PAGE_CACHE, which `trim` holds at
 * PAGE_LIMIT; the icons go to STATIC_CACHE, which is four files and needs no
 * ceiling. Keeping them apart is what stops an icon from occupying a page's slot
 * and being evicted on a reader's fifty-first article.
 */
async function fromNetworkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache
        .put(request, response.clone())
        // Only the page cache can grow without bound.
        .then(() => (cacheName === PAGE_CACHE ? trim(cache) : undefined));
    }
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw error;
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= PAGE_LIMIT) return;
  // `keys()` is insertion-ordered, and a re-fetch overwrites in place rather than
  // moving to the end — so this is oldest-written, not least-recently-used. Close
  // enough for a limit whose only job is to stop unbounded growth.
  await Promise.all(keys.slice(0, keys.length - PAGE_LIMIT).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Anything else is not ours to reason about: a POST has side effects, and a
  // cross-origin response is opaque, so caching either would be guesswork.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (POSTER.test(url.pathname)) return;

  // The only cache-first case left, and the one the rule was written for: these
  // URLs carry a build hash, so a changed file is a changed address.
  if (IMMUTABLE.test(url.pathname)) {
    event.respondWith(fromCacheFirst(request, STATIC_CACHE));
    return;
  }

  if (ASSETS.test(url.pathname)) {
    event.respondWith(fromNetworkFirst(request, STATIC_CACHE));
    return;
  }

  // `mode: "navigate"` is the document itself — what a reader typed, tapped or
  // launched the app to. Everything else that reaches here (Next's data requests,
  // the manifest) goes to the network untouched, because serving a stale one
  // beside a fresh document is worse than not answering at all.
  if (request.mode === "navigate") {
    event.respondWith(fromNetworkFirst(request, PAGE_CACHE));
  }
});
