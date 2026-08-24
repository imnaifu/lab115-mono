import { manifest } from "@/lib/manifest";
import { DEFAULT_LANG } from "@/lib/lang";

/**
 * The default language's manifest, at the root — the one `app/layout.tsx` links
 * from every Chinese page.
 *
 * IT NEEDS ITS OWN ROUTE rather than being reached through `[lang]`, and the
 * reason is `proxy.ts`: its matcher skips any path ending in a file extension, so
 * `/manifest.webmanifest` never gets rewritten into the `[lang]` tree the way
 * `/archive` does. That exclusion is deliberate and load-bearing — it is what
 * keeps `/sw.js` and the icons in `public/` from being rewritten — so the answer
 * is a route here rather than a hole in the matcher.
 *
 * The body is `lib/manifest.ts`, shared with the prefixed route. Nothing is
 * duplicated but the HTTP.
 */
export const dynamic = "force-static";

export async function GET() {
  return new Response(JSON.stringify(manifest(DEFAULT_LANG), null, 2), {
    headers: {
      // The registered type. Chrome accepts application/json as well, but Safari
      // has been stricter about this than the spec requires.
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
