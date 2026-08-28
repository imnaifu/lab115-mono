import { manifest } from "@/lib/manifest";
import { DEFAULT_LANG, isLang, LANGS } from "@/lib/lang";

/**
 * The prefixed manifest — `/en/manifest.webmanifest`, and nothing else.
 *
 * ONE PER LANGUAGE, not Next's root-level `app/manifest.ts` convention and not a
 * single shared manifest, because ONE LANGUAGE PER DOCUMENT applies here too: a
 * manifest carries a `name`, a `short_name` and a `description`, and those are the
 * strings that end up on a home screen and in an app launcher. A single manifest
 * would have to name the app twice, in both scripts, in the one place where the
 * text is a label rather than a sentence.
 *
 * The DEFAULT language's copy is served by `app/manifest.webmanifest` at the root,
 * because that is where its pages live now. The body of both is `lib/manifest.ts`.
 *
 * The old note here warned that a root manifest would start the app at `/`, "which
 * redirects — an installed app whose first request is a 307". That was true and is
 * not any more: `/` is a page. See lib/lang.ts.
 *
 * A directory named with the extension plus `route.ts` is the same trick
 * `feed.xml/route.ts` uses next door.
 *
 * `/zh/manifest.webmanifest` IS GONE, and this file is the only place it could be
 * removed. The site has no `/zh/…` addresses left — lib/lang.ts has the account of
 * what a second address for a Chinese document cost — and `proxy.ts` enforces that
 * for every page, but not here: its matcher excludes any path ending in a file
 * extension, so this route is reached directly. Same story as the feed next door.
 */
export const dynamic = "force-static";

/**
 * Every language that has a prefix — which is every language but the default one,
 * whose manifest is served at the root. Prerendered at build: this is fixed text
 * and two icon lists.
 *
 * `dynamicParams = false` is what turns the omission into a 404 rather than into a
 * page rendered on demand. Without it Next would happily build
 * `/zh/manifest.webmanifest` the first time something asked for it, and filtering
 * here would change nothing but the build log.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return LANGS.filter((lang) => lang !== DEFAULT_LANG).map((lang) => ({ lang }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;

  /**
   * The same refusal `dynamicParams` above already makes, stated again in code.
   *
   * Not redundant: `dynamicParams = false` is enforced by the ROUTER, and the dev
   * server runs this handler for `/zh/manifest.webmanifest` regardless — which is
   * exactly the environment someone checks the URL in. A rule that holds in
   * production and not on the machine where it is being verified is a rule nobody
   * will trust. It also survives this route ever losing `force-static`.
   */
  if (!isLang(lang) || lang === DEFAULT_LANG) {
    return new Response("Not found", { status: 404 });
  }

  const body = manifest(lang);

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      // The registered type. Chrome accepts application/json as well, but Safari
      // has been stricter about this than the spec requires.
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
