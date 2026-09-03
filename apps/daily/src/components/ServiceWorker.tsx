"use client";

import { useEffect } from "react";

/**
 * The one-shot flag on the dev teardown's reload. `sessionStorage`, not
 * `localStorage`: it should stop the loop within a tab and NOT survive the
 * browser being reopened, because a worker planted by a later production run
 * deserves the same one reload the first one got.
 */
const RELOADED = "daily:sw-cleared";

/**
 * Registers `public/sw.js`, and does nothing else.
 *
 * A component rather than an inline `<script>` in the layout, because this has to
 * run in the browser and the layout is a server component; and separate from
 * everything else so the one client component the root layout pulls in is a
 * dozen lines with no state.
 *
 * PRODUCTION ONLY — AND IN DEV IT ACTIVELY TEARS THE WORKER DOWN, which is the
 * half this file was missing.
 *
 * The original note was right about the danger and wrong about being safe from
 * it: "a worker registered in dev caches whatever the dev server was serving at
 * the time and then keeps answering with it — the classic 'my edit did nothing'
 * afternoon". Guarding the REGISTRATION does not prevent that, because a service
 * worker is persistent per ORIGIN and nothing here was removing it. Run the
 * production build once on the port dev also uses — `npm start` on :3000 — and
 * that worker stays installed and goes on intercepting every dev request made to
 * that origin afterwards.
 *
 * WHAT IT BREAKS IS SPECIFICALLY THE STYLESHEET. `sw.js` serves `/_next/static/`
 * cache-first, on the stated grounds that those URLs carry a build hash so a
 * changed file is a changed address — true of `npm run build`, whose CSS comes
 * out as `2jjw5g3vjfge2.css`, and NOT true of Turbopack in dev, which serves
 * `apps_daily_src_index_1a5tco-.css`, a name hashed from the module path and
 * therefore stable across edits. So the first dev stylesheet the worker sees is
 * the last one it ever serves, and the page renders new markup against old CSS:
 * classes introduced after that point simply do not exist, so a `hidden` element
 * whose `md:block` is missing stays hidden and an `<img>` whose `size-6` is
 * missing falls back to its intrinsic size. That is not hypothetical either —
 * it cost two rounds of "the header is wrong" before anyone looked in the cache.
 *
 * `Cmd+Shift+R` bypasses the worker, which is exactly why the bug looks like it
 * is not there when you go checking for it.
 *
 * SO DEV CLEANS UP AFTER PRODUCTION. Only `daily-` caches are dropped — the
 * names `sw.js` writes — because this has no business deleting storage some
 * other localhost project put there.
 *
 * `NODE_ENV` is inlined at build time, so exactly one of these two branches is in
 * any given bundle and the other is dead code.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      /**
       * Retire anything a past production run left on this origin, then reload
       * ONCE if that worker was actually serving this page.
       *
       * The reload is needed because `unregister()` does not evict the worker
       * from pages it is already controlling — it stops it claiming NEW clients,
       * and the current document keeps its stale stylesheet until it navigates.
       * Which is the trap in doing this by hand: you unregister, you reload, and
       * the reload is still answered from the cache.
       *
       * TWO CONDITIONS GUARD IT, so it can fire at most once per tab and only
       * when there was something to fix: `controller` is null unless a worker is
       * driving this page, and the session flag survives the reload it triggers.
       * A dev-only reload loop would be a bad way to learn this was wrong.
       */
      const controlled = !!navigator.serviceWorker.controller;

      void (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));

          if ("caches" in window) {
            const names = await caches.keys();
            await Promise.all(
              names
                .filter((name) => name.startsWith("daily-"))
                .map((name) => caches.delete(name)),
            );
          }

          if (!controlled) return;
          // The read can throw in a private window, which the catch below
          // handles: an unreadable flag means an unguarded reload, so the safe
          // reading of a failure here is "do not reload at all".
          if (sessionStorage.getItem(RELOADED) === "1") return;
          sessionStorage.setItem(RELOADED, "1");
          location.reload();
        } catch {
          // Storage disabled, or a browser that refuses the enumeration. The
          // page is server-rendered and works either way; the cost is that the
          // reader has to reload once themselves.
        }
      })();

      return;
    }

    /**
     * After `load`, not immediately: registration competes with the page's own
     * requests for bandwidth, and nothing on a first visit depends on the worker
     * existing. If the event has already fired by the time this runs — likely,
     * since effects follow hydration — register straight away.
     */
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration costs nothing: the site is server-rendered and
        // works without it. Not worth a console error on, say, a browser with
        // storage disabled.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
