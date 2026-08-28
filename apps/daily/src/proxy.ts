import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LANG,
  isLang,
  LANG_COOKIE,
  LANG_COOKIE_MAX_AGE,
  type Lang,
} from "@/lib/lang";

/**
 * Which language a request is for, and what its URL should look like.
 *
 * This file is `proxy.ts`, not `middleware.ts`: Next 16 renamed the hook, and
 * the old name only warns for now.
 *
 * FIVE RULES, and the order matters:
 *
 *   `/preview` THROUGH UNTOUCHED in development, 404 everywhere else. See below.
 *   `/zh/…`   404. The default language is unprefixed now — see lib/lang.ts — so
 *             the prefixed Chinese form names nothing this site serves.
 *   `/`       307 to `/en` IF the reader ARRIVED here — typed it, followed an
 *             outside link, launched the app — and their language cookie says so.
 *             A press of the language switch is a link on this site, not an
 *             arrival, and is never redirected: see `fromInsideTheSite`.
 *   `/en/…`   through, with `x-lang: en`.
 *   anything  REWRITTEN to `/zh/…`, with `x-lang: zh`. A rewrite, not a redirect:
 *             the reader's URL bar keeps saying `/2026/08/24` while the App Router
 *             matches `src/app/[lang]/[year]/[month]/[day]`. That is what lets the page
 *             tree stay where it is rather than being duplicated at the root.
 *
 * Everything that passes through also LEAVES A COOKIE naming the language of the
 * URL it was for, which is what the third rule reads on the next visit.
 *
 * WHAT IS GONE, AND STAYS GONE: the Accept-Language negotiation that used to
 * decide where `/` sent you. It is what made every unprefixed URL a second
 * address for a Chinese page and put three of them in Search Console as
 * duplicates whose canonical Google had overridden. The cookie above is not that
 * mechanism wearing a different hat — a crawler carries no cookies, so it is
 * never redirected and `/` stays the self-canonical Chinese page it is, whereas
 * Accept-Language is sent by every client alive. lib/lang.ts carries the full
 * account of both.
 *
 * This is also where `<html lang>` comes from. The root layout renders that
 * attribute but, in the App Router, a layout cannot see the route segments
 * below it — so the language is handed forward as a request header instead of
 * being re-derived from a pathname the layout does not have.
 */
/**
 * Did this request come from a link ON this site, or is it an arrival AT it?
 *
 * THE WHOLE DIFFERENCE THE LANGUAGE COOKIE TURNS ON. Its job is to answer "you
 * typed the bare domain, which language did you mean?" — a question that only
 * exists on the way in. Once a reader is here, every link they press already
 * names a language, and honouring the cookie over a link they chose is how the
 * language switch became a dead control: on `/en` the switch points at `/`, and
 * `/` sent them straight back to `/en`. One press and there was no way home.
 *
 * `Sec-Fetch-Site` is the direct answer — `same-origin` for a link on this site,
 * `none` for a typed URL, a bookmark or a PWA launch, `cross-site` for a link
 * somewhere else — and the last two are precisely the arrivals the cookie is for.
 *
 * REFERER IS THE FALLBACK, for browsers that send no `Sec-Fetch-*` at all (Safari
 * before 16.4). Compared against the `Host` the client sent rather than against
 * `nextUrl.origin`, because this runs behind a reverse proxy in the Docker image
 * and the internal origin is not the one the reader's browser knows. A missing or
 * unparseable Referer reads as an arrival, which is the pre-cookie behaviour and
 * the safe way to be wrong.
 */
function fromInsideTheSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";

  const referer = request.headers.get("referer");
  const host = request.headers.get("host");
  if (!referer || !host) return false;
  try {
    return new URL(referer).host === host;
  } catch {
    return false;
  }
}

export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const [, first] = pathname.split("/");

  /**
   * The contact sheet and the emails it renders — `/preview` and everything under
   * it. THE ONE GATE, and it does two things nothing else can.
   *
   * IT IS WHERE DEV-ONLY IS ENFORCED. `NODE_ENV` is production under `next build`
   * and under `next start`, so this is a 404 in both — the tool answers on a dev
   * server and nowhere else, including a production build run on this machine.
   * The page and the mail route each check again; a route that leaks because a
   * matcher was edited is not a failure worth being one edit away from.
   *
   * IT IS ALSO WHY THE PATH RESOLVES AT ALL. Without this, the rewrite at the
   * bottom would send `/preview` to `/zh/preview`, and the preview tree does not
   * live under `[lang]` — it has no single language, it renders both. Every other
   * language-less route on this site ends in an extension and is excluded by the
   * matcher instead; this one does not, so it is named here.
   */
  if (first === "preview") {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  /**
   * `/zh/…` — 404, where it used to be a 308 to the unprefixed form.
   *
   * The redirect was right while the old shape still had inbound links and index
   * entries to hand over; that consolidation is done, and what is left is an
   * address that answers. IT MUST NOT SIMPLY FALL THROUGH: `zh` passes `isLang`,
   * so without this branch the pass-through below would render the Chinese site
   * at `/zh/2026/08/24` — a second live address for every Chinese page, which is
   * precisely the failure lib/lang.ts documents, rebuilt by deletion.
   */
  if (first === DEFAULT_LANG) {
    return new NextResponse(null, { status: 404 });
  }

  const cookie = request.cookies.get(LANG_COOKIE)?.value;

  /**
   * THE ONE ADDRESS THAT NAMES NO LANGUAGE, and the one place the cookie is read
   * — on arrival only, never on a link from inside. See `fromInsideTheSite` for
   * why that distinction is the difference between a working language switch and
   * a dead one.
   *
   * 307 AND NOT 308, and this is the only redirect the site emits. A permanent
   * one states a fact about the URL; this states a fact about ONE READER'S
   * BROWSER, and it is false for the next visitor — so it must never be written
   * into a cache, or a bookmark, as a property of `/` itself. `Vary: Cookie`
   * says the same thing to anything between here and them — without it a shared
   * cache is free to hand this redirect to a reader who has no cookie at all,
   * which would turn a per-reader convenience back into the site-wide alias that
   * cost us the index once.
   *
   * A READER WHO HAS NEVER BEEN HERE HAS NO COOKIE and falls through to the
   * rewrite below, so `/` is still a page — for them and for every crawler.
   *
   * THAT 200 CARRIES NO `Vary: Cookie`, AND CANNOT FROM HERE. Next recomputes
   * the header on every rendered response — `rsc, next-router-state-tree, …` —
   * and overwrites whatever this function set. Measured, not assumed: an
   * ordinary header set here does reach the client and `Vary` alone does not.
   * What keeps the un-redirected `/` from being stored and handed to someone
   * this branch should have moved is that every page under `[lang]` is
   * `force-dynamic` and goes out `no-cache, must-revalidate`, so a shared cache
   * has to come back here before serving — and then this runs. The two are tied
   * together: a page that ever loses `force-dynamic` loses this with it.
   */
  if (
    pathname === "/" &&
    isLang(cookie) &&
    cookie !== DEFAULT_LANG &&
    // A link on this site is a language the reader just picked. See the note above.
    !fromInsideTheSite(request)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${cookie}`;
    const response = NextResponse.redirect(url, 307);
    response.headers.append("Vary", "Cookie");
    return response;
  }

  const lang: Lang = isLang(first) ? first : DEFAULT_LANG;
  const headers = new Headers(request.headers);
  headers.set("x-lang", lang);

  /**
   * Remember the language of the page actually being served.
   *
   * ONLY WHEN IT CHANGES. This runs on every page navigation, and re-sending an
   * identical cookie on all of them is a header on every response to buy nothing.
   *
   * The matcher below is what makes writing it here safe: assets, `/api/` and
   * anything with a dot never reach this function, so the value can only ever be
   * set by a request for a page a human is reading.
   */
  const response = isLang(first)
    ? // Already prefixed with the non-default language: nothing to rewrite.
      NextResponse.next({ request: { headers } })
    : (() => {
        const url = request.nextUrl.clone();
        // `/` becomes `/zh`, not `/zh/`.
        url.pathname =
          pathname === "/" ? `/${DEFAULT_LANG}` : `/${DEFAULT_LANG}${pathname}`;
        return NextResponse.rewrite(url, { request: { headers } });
      })();

  if (cookie !== lang) {
    response.cookies.set(LANG_COOKIE, lang, {
      path: "/",
      maxAge: LANG_COOKIE_MAX_AGE,
      sameSite: "lax",
      // Nothing on the client reads this — the language is in the URL by the time
      // any script runs — so there is no reason to expose it to one.
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
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
