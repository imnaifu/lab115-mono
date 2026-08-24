import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Products } from "@/components/Products";
import { Method } from "@/components/Method";
import { Footer } from "@/components/Footer";
import { strings } from "@/lib/i18n";
import { href, isLang, LANGS } from "@/lib/lang";
import { SITE } from "@/lib/config";
import { JsonLd, organization, productList, website } from "@/lib/seo";

/**
 * The complete set of languages, so `/zh` and `/en` are the only paths that
 * resolve. They still render per request rather than at build time — the root
 * layout reads the `x-lang` header, and `headers()` makes the whole tree
 * dynamic. That is the price of one `<html lang>` for a bilingual site, and
 * apps/daily pays it the same way.
 */
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

/** Anything outside `/zh` and `/en` is not a page here. */
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
       * WHO PUBLISHES THIS AND WHAT IS ON IT. The page had no structured data at
       * all — see the note at the top of lib/seo.tsx for why that is the expensive
       * omission on a two-URL site.
       *
       * A `@graph` of three, because there are three separate things to say and
       * nesting them would collapse distinctions that matter: the ORGANIZATION is
       * the brand, which owns properties on other domains; the WEBSITE is this
       * domain in this language; the PAGE is what a reader is looking at, and the
       * product shelf is its `mainEntity`. Everything cross-references by `@id`
       * rather than repeating, so a crawler that also reads daily.lab115.com sees
       * one publisher rather than two that happen to share a name.
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
              mainEntity: productList(lang),
            },
          ],
        }}
      />

      {/* First thing in the tab order: a keyboard reader should not have to
          walk the whole nav on every visit (HIG — Accessibility). */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-[15px] focus:text-surface"
      >
        {text.skipToContent}
      </a>

      <Nav lang={lang} />

      <main id="main">
        <Hero lang={lang} />
        <Products lang={lang} />
        <Method lang={lang} />
      </main>

      <Footer lang={lang} />
    </>
  );
}
