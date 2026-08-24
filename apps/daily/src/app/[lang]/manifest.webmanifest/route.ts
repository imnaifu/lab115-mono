import { manifest } from "@/lib/manifest";
import { DEFAULT_LANG, isLang, LANGS } from "@/lib/lang";

/**
 * The prefixed manifest — in practice `/en/manifest.webmanifest`.
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
 */
export const dynamic = "force-static";

/** Both languages, prerendered at build: this is fixed text and two icon lists. */
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  const body = manifest(isLang(lang) ? lang : DEFAULT_LANG);

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      // The registered type. Chrome accepts application/json as well, but Safari
      // has been stricter about this than the spec requires.
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
