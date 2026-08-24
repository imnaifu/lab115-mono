import { detectLang } from "@/lib/lang";

/**
 * `/feed.xml` — the address people actually type, and the one a reader guesses
 * when it is handed a bare domain.
 *
 * It NEGOTIATES rather than serving a copy, which is what `proxy.ts` does for
 * every unprefixed page and what `sitemap.ts` means by "the x-default target:
 * the unprefixed path, which the proxy negotiates". Two behaviours for the same
 * question would be one too many.
 *
 * It cannot simply be left to the proxy: that matcher skips anything ending in a
 * file extension, so without this handler `/feed.xml` is a 404.
 *
 * 302 and not 301: which language this resolves to depends on the request, so a
 * reader that cached the answer permanently would pin the wrong publication for
 * everyone behind the same cache. Feed readers follow redirects; the ones that
 * store the final URL end up subscribed to the language-prefixed feed, which is
 * the right thing to have stored.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const lang = detectLang(request.headers.get("accept-language"));

  /**
   * A RELATIVE `Location`, and it has to be relative.
   *
   * This was `Response.redirect(new URL(..., request.url), 302)`, which sent the
   * reader to `http://0.0.0.0:3000/zh/feed.xml` in production — an address nothing
   * can connect to. `request.url` in a route handler is rebuilt from the address
   * the server is BOUND to, not from the `Host` header the reader actually asked
   * for: the Dockerfile sets `HOSTNAME=0.0.0.0` so the container listens on every
   * interface, and that literal string is what came back out. Sending a real Host
   * header changes nothing, which is what makes this impossible to fix by
   * inspecting the request harder.
   *
   * `Response.redirect` cannot help here — it requires an absolute URL, so it
   * forces exactly the reconstruction that is wrong. A bare `Response` can set the
   * header itself, and RFC 7231 has allowed a relative reference in `Location`
   * since 2014: the client resolves it against the URL it requested, which is the
   * one party in this exchange that knows the real host and scheme.
   *
   * It is also what `proxy.ts` already emits for every unprefixed PAGE — a plain
   * `/zh/archive` — which is why pages negotiated correctly while this one route
   * did not. The comment above says this handler mirrors the proxy; now it does.
   */
  return new Response(null, {
    status: 302,
    headers: {
      location: `/${lang}/feed.xml`,
      /**
       * The answer depends on a request header, so it has to say so.
       *
       * Without this a shared cache — a CDN, a corporate proxy, an aggregator's
       * own fetcher — stores whichever language it saw first and hands it to
       * everyone behind it. That is the same failure the 302 above is chosen to
       * avoid, one layer up: 302 stops a client pinning the wrong language
       * forever, `Vary` stops a cache pinning it for other people.
       */
      vary: "Accept-Language",
    },
  });
}
