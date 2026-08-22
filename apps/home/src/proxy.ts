import { NextResponse, type NextRequest } from "next/server";
import { detectLang, isLang } from "@/lib/lang";

/**
 * Every page lives under a language prefix, so anything arriving without one
 * gets sent to the language its browser asked for.
 *
 * This file is `proxy.ts`, not `middleware.ts`: Next 16 renamed the hook.
 *
 * This is also where `<html lang>` comes from. The root layout renders that
 * attribute but, in the App Router, a layout cannot see the route segments
 * below it — so the language is handed forward as a request header instead of
 * being re-derived from a pathname the layout does not have.
 */
export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const [, first] = pathname.split("/");

  if (!isLang(first)) {
    const lang = detectLang(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    // `/` becomes `/zh`, not `/zh/`.
    url.pathname = pathname === "/" ? `/${lang}` : `/${lang}${pathname}`;
    return NextResponse.redirect(url);
  }

  const headers = new Headers(request.headers);
  headers.set("x-lang", first);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  /**
   * Everything except Next's own assets and ANY file with an extension.
   *
   * Naming the exceptions one at a time is a trap: adding a file to `public/`
   * and forgetting to list it here makes it 404 through a redirect to
   * `/zh/<file>`. A dot in the last segment stands in for "this is a file, not
   * a page", which holds for every route here — the only route is `/<lang>`.
   */
  matcher: ["/((?!_next/|[^/]*\\.[a-zA-Z0-9]+$).*)"],
};
