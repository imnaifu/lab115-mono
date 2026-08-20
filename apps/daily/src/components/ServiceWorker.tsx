"use client";

import { useEffect } from "react";

/**
 * Registers `public/sw.js`, and does nothing else.
 *
 * A component rather than an inline `<script>` in the layout, because this has to
 * run in the browser and the layout is a server component; and separate from
 * everything else so the one client component the root layout pulls in is a
 * dozen lines with no state.
 *
 * PRODUCTION ONLY. A worker registered in dev caches whatever the dev server was
 * serving at the time and then keeps answering with it — the classic "my edit did
 * nothing" afternoon. `NODE_ENV` is inlined at build time, so in a dev bundle this
 * whole effect body is dead code.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

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
