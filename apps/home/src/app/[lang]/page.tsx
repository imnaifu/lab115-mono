import { notFound } from "next/navigation";
import { Blocks } from "@/components/Blocks";
import { LogoMark, WORDMARK } from "@/components/Logo";
import { strings } from "@/lib/i18n";
import { href, isLang, LANGS } from "@/lib/lang";
import { SITE } from "@/lib/config";
import { JsonLd, organization, website } from "@/lib/seo";

/**
 * The complete set of languages, so `/` and `/en` are the only paths that
 * resolve. They still render per request rather than at build time — the root
 * layout reads the `x-lang` header, and `headers()` makes the whole tree
 * dynamic. That is the price of one `<html lang>` for a bilingual site, and
 * apps/daily pays it the same way.
 *
 * The two pages look identical now — the screen carries no copy — but they keep
 * their own title, description and `<html lang>`, and keeping both URLs alive
 * means nothing already indexed or linked starts returning 404.
 */
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

/** Anything outside `/` and `/en` is not a page here. */
export const dynamicParams = false;

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const text = strings(lang);

  return (
    <>
      {/**
       * WHO PUBLISHES THIS. See the note at the top of lib/seo.tsx.
       *
       * The ORGANIZATION is the brand, which owns properties on other domains;
       * the WEBSITE is this domain in this language; the PAGE is what a reader is
       * looking at. The product list that used to be the page's `mainEntity` is
       * gone with the shelf it described — structured data should not claim
       * content the page no longer shows. The products are still named, as the
       * organization's `sameAs`.
       */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            organization(),
            website(lang),
            {
              "@type": "WebPage",
              "@id": `${SITE}${href(lang, "/")}#page`,
              url: `${SITE}${href(lang, "/")}`,
              name: `${text.brand} — ${text.tagline}`,
              description: text.metaDescription,
              inLanguage: lang === "zh" ? "zh-CN" : "en-US",
              isPartOf: { "@id": `${SITE}${href(lang, "/")}#site` },
              publisher: { "@id": `${SITE}/#org` },
            },
          ],
        }}
      />

      {/* One screen, nothing to scroll to: the mark and the wordmark over the
          blocks. Sizes are in viewport units so the lockup fills the screen at
          any size, and `portrait:` re-lays it for a phone held upright. */}
      <main className="relative h-dvh overflow-hidden bg-paper">
        <Blocks />

        <h1 className="absolute bottom-[13%] left-[7%] flex flex-col items-start gap-[2.5vmin] portrait:bottom-[9%] portrait:left-[8%] portrait:gap-[4vw]">
          <LogoMark className="size-[15vmin] portrait:size-[22vw]" />
          <span className="font-display text-[10.5vw] leading-[0.9] font-extrabold tracking-[-0.01em] text-ink portrait:text-[21vw]">
            {WORDMARK}
          </span>
        </h1>
      </main>
    </>
  );
}
