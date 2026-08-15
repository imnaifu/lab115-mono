import { NextResponse, type NextRequest } from "next/server";
import { detectLang, isLang } from "@/lib/lang";

/**
 * Every page lives under a language prefix, so anything arriving without one
 * gets sent to the language its browser asked for.
 *
 * This file is `proxy.ts`, not `middleware.ts`: Next 16 renamed the hook, and
 * the old name only warns for now.
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
   * Everything except Next's own assets and the files served straight from
   * `public/`. A redirect on `/favicon.svg` would break the icon, and one on
   * `/_next/...` would break the whole page.
   */
  matcher: ["/((?!_next/|favicon\\.svg|robots\\.txt).*)"],
};
