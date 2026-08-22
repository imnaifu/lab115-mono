import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Products } from "@/components/Products";
import { Method } from "@/components/Method";
import { Footer } from "@/components/Footer";
import { strings } from "@/lib/i18n";
import { isLang, LANGS } from "@/lib/lang";

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
