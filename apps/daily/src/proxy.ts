import { NextResponse, type NextRequest } from "next/server";
import { barePath, DEFAULT_LANG, isLang } from "@/lib/lang";

/**
 * Which language a request is for, and what its URL should look like.
 *
 * This file is `proxy.ts`, not `middleware.ts`: Next 16 renamed the hook, and
 * the old name only warns for now.
 *
 * THREE RULES, and the order matters:
 *
 *   `/zh/…`   301 to the unprefixed form. The default language is unprefixed now
 *             — see lib/lang.ts — so every one of these is a legacy URL, and a
 *             permanent redirect is how the old shape stops competing with the
 *             new one in the index.
 *   `/en/…`   through, with `x-lang: en`.
 *   anything  REWRITTEN to `/zh/…`, with `x-lang: zh`. A rewrite, not a redirect:
 *             the reader's URL bar keeps saying `/2026/08/24` while the App Router
 *             matches `src/app/[lang]/[year]/[month]/[day]`. That is what lets the page
 *             tree stay where it is rather than being duplicated at the root.
 *
 * WHAT IS GONE: the Accept-Language negotiation that used to decide where `/`
 * sent you. It is what made every unprefixed URL a second address for a Chinese
 * page and put three of them in Search Console as duplicates whose canonical
 * Google had overridden. There is no negotiating redirect on this site any more,
 * and the cost — an English speaker typing the bare domain gets Chinese — is
 * accepted deliberately. lib/lang.ts carries the full account.
 *
 * This is also where `<html lang>` comes from. The root layout renders that
 * attribute but, in the App Router, a layout cannot see the route segments
 * below it — so the language is handed forward as a request header instead of
 * being re-derived from a pathname the layout does not have.
 */
export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const [, first] = pathname.split("/");

  if (first === DEFAULT_LANG) {
    const url = request.nextUrl.clone();
    url.pathname = barePath(pathname);
    /**
     * 308, not 307 or 302. This is the one redirect left on the site and it is
     * permanent by definition — the prefixed form is never coming back — so it
     * has to be the status that consolidates the old URL's signals onto the new
     * one. 308 rather than 301 because it also promises the method is preserved,
     * which costs nothing and is the modern spelling.
     */
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
   * It used to name the exceptions one at a time — `favicon.svg`, `robots.txt` —
   * and that list is a trap: adding a file to `public/` and forgetting to add it
   * here makes the file 404 through a redirect to `/zh/<file>`, which is a strange
   * enough failure to cost an afternoon. `/sw.js` in particular would have been
   * silently redirected, and a service worker that 404s does not register.
   *
   * A dot in the last segment stands in for "this is a file, not a page", which
   * holds for every route on this site: the paths are `/`,
   * `/<yyyy>/<mm>/<dd>` and `/<yyyy>/<mm>/<dd>/<slug>-<id>`, and none of those
   * segments contains one. The slug is built by `slugify` in lib/links, which
   * emits `[a-z0-9-]` and therefore cannot produce one either.
   *
   * The routes that DO end in an extension carry their language as an ordinary
   * path segment — `/og/zh/site.png`, `/share/zh/<date>/<id>/1.png`,
   * `/en/feed.xml` — rather than relying on the header this sets, so skipping
   * them here costs nothing. That is not a coincidence: a language-prefixed image
   * route would be UNREACHABLE now, because the unprefixed form the site serves
   * Chinese at needs the rewrite above and this matcher denies it to anything with
   * a dot in it. See the note on `ogUrl` in lib/links.
   *
   * `.*\.` AND NOT `[^/]*\.`, which is what it was, and the difference is a bug
   * this change walked straight into. The lookahead is anchored where the path
   * starts, and `[^/]` cannot cross a slash — so the old pattern only ever excused
   * a file in the ROOT. `/sw.js` was skipped; `/og/zh/site.png` was not, and the
   * rewrite above turned it into `/zh/og/zh/site.png`, which is a 404. It went
   * unnoticed before because nothing dotted lived more than one segment deep and
   * because the proxy's old branch for a prefixed path was a harmless no-op.
   * Neither is true now. `.*` spans the whole path, so the rule is what the
   * paragraph above has always claimed: a dot in the last segment means a file.
   *
   * `api/` IS EXCLUDED because the rewrite above is for the page tree and an API
   * route is not in it. `/api/mail/subscribe` has no extension and no language
   * prefix, so without this it would be rewritten to `/zh/api/mail/subscribe` —
   * a path with no route behind it, i.e. a 404 on the subscribe form's POST. The
   * method and body survive a rewrite, which is what makes this failure quiet:
   * the request arrives intact at a route that does not exist.
   *
   * These routes need no language anyway. They are called by scripts, they
   * answer in JSON, and where one does need to know the reader's language it is
   * in the payload — an English form posts `lang: "en"` rather than relying on a
   * prefix. The pages that report back to a human are ordinary pages under
   * `[lang]`, and they keep the rewrite.
   */
  matcher: ["/((?!api/|_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
