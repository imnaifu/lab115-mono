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
  return Response.redirect(new URL(`/${lang}/feed.xml`, request.url), 302);
}
