import { NextResponse, type NextRequest } from "next/server";
import { barePath, DEFAULT_LANG, isLang } from "@/lib/lang";

/**
 * Which language a request is for, what host it should be on, and what its URL
 * should look like.
 *
 * This file is `proxy.ts`, not `middleware.ts`: Next 16 renamed the hook.
 *
 * AFTER THE `www` REDIRECT BELOW, three rules, and the order matters:
 *
 *   `/zh/…`   308 to the unprefixed form. The default language is unprefixed now
 *             — see lib/lang.ts — so every one of these is a legacy URL.
 *   `/en/…`   through, with `x-lang: en`.
 *   anything  REWRITTEN to `/zh/…`, with `x-lang: zh`. A rewrite, not a redirect:
 *             the URL bar keeps saying `/` while the App Router matches
 *             `src/app/[lang]`. That is what lets the page tree stay where it is.
 *
 * WHAT IS GONE: the Accept-Language negotiation that used to decide where `/` sent
 * you. It is what made the bare URL a second address for the Chinese page and put
 * `lab115.com/zh` in Search Console as a duplicate whose canonical Google had
 * overridden. apps/daily lost the same redirect for the same reason. The cost — an
 * English speaker typing the bare domain gets Chinese — is accepted deliberately;
 * lib/lang.ts carries the full account.
 *
 * This is also where `<html lang>` comes from. The root layout renders that
 * attribute but, in the App Router, a layout cannot see the route segments
 * below it — so the language is handed forward as a request header instead of
 * being re-derived from a pathname the layout does not have.
 */
export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const [, first] = pathname.split("/");

  /**
   * `www` IS A SECOND COPY OF THE SITE, and it was serving 200 on every path.
   *
   * Traefik routes `lab115.com` and `www.lab115.com` to this container — both, on
   * purpose, because a single Host rule would leave `www` unrouted and it is a
   * separate certificate SAN (see the note on the `home` service in
   * docker-compose.yml). Nothing then sent one to the other, so every page existed
   * at two hostnames.
   *
   * The pages did declare `https://lab115.com/...` as canonical, since SITE is
   * hardcoded — which is the mild version of this problem rather than the absence
   * of it. A canonical tag is a hint, and Search Console reported `lab115.com/zh`
   * as a page whose canonical Google had overridden, with `www` as one of the two
   * plausible URLs it picked instead. A 308 is not a hint.
   *
   * HERE RATHER THAN IN TRAEFIK: a `redirectregex` middleware would work, but the
   * apex and `www` share one router and one certificate, and splitting them into
   * two routers to hang a redirect off one is more moving parts in the file that
   * is hardest to test. This runs before everything else in the app and needs no
   * infrastructure change.
   *
   * The host comes from the header, not from `nextUrl.host`: behind a proxy the
   * latter is the address this process is bound to, which is how `feed.xml` in
   * apps/daily once redirected readers to `0.0.0.0:3000`.
   */
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const url = request.nextUrl.clone();
    url.host = host.slice(4);
    // The port travels with `host` above; clearing it keeps the default rather
    // than pinning whatever this process happens to be listening on.
    url.port = "";
    url.protocol = "https";
    return NextResponse.redirect(url, 308);
  }

  if (first === DEFAULT_LANG) {
    const url = request.nextUrl.clone();
    url.pathname = barePath(pathname);
    // Permanent by definition — the prefixed form is not coming back — so it has
    // to be the status that consolidates the old URL's signals onto the new one.
    return NextResponse.redirect(url, 308);
  }

  const lang = isLang(first) ? first : DEFAULT_LANG;
  const headers = new Headers(request.headers);
  headers.set("x-lang", lang);

  // Already prefixed with the non-default language: nothing to rewrite.
  if (isLang(first)) return NextResponse.next({ request: { headers } });

  const url = request.nextUrl.clone();
  // `/` becomes `/zh`, not `/zh/`.
  url.pathname = pathname === "/" ? `/${DEFAULT_LANG}` : `/${DEFAULT_LANG}${pathname}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  /**
   * Everything except Next's own assets and ANY file with an extension.
   *
   * Naming the exceptions one at a time is a trap: adding a file to `public/`
   * and forgetting to list it here makes it 404 through a redirect to
   * `/zh/<file>`. A dot in the last segment stands in for "this is a file, not
   * a page", which holds for every route here — the pages are `/` and `/en`.
   *
   * `.*\.` AND NOT `[^/]*\.`, which is what it was. The lookahead is anchored
   * where the path starts and `[^/]` cannot cross a slash, so the old pattern only
   * ever excused a file in the ROOT — `/favicon.svg` was skipped, `/og/zh.png` was
   * not. That was harmless while every dotted path was one segment deep and the
   * prefixed branch below was a no-op; with the card moved out of the page tree and
   * unprefixed paths now REWRITTEN, it would turn `/og/zh.png` into
   * `/zh/og/zh.png`. apps/daily had the identical latent bug. `.*` spans the whole
   * path, so the rule is finally what the paragraph above claims.
   */
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
