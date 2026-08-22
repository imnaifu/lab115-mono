import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, isLang, LANGS, type Lang } from "@/lib/lang";
import "@/index.css";

const SITE_URL = "https://lab115.com";

/**
 * What both the layout and its metadata need.
 *
 * A layout cannot see the route segments below it, so the language arrives as
 * the `x-lang` header that `src/proxy.ts` sets. See the note there.
 */
async function langFromHeader(): Promise<Lang> {
  const header = (await headers()).get("x-lang") ?? undefined;
  return isLang(header) ? header : DEFAULT_LANG;
}

const OG_LOCALE: Record<Lang, string> = { zh: "zh_CN", en: "en_US" };

/**
 * ONE language per document, title included — a bilingual <title> would say the
 * site's name twice in the browser tab and give search engines two descriptions
 * of the same page in a language neither audience reads end to end.
 */
export async function generateMetadata(): Promise<Metadata> {
  const lang = await langFromHeader();
  const text = strings(lang);
  const title = `${text.brand} — ${text.tagline}`;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description: text.metaDescription,
    alternates: {
      canonical: `/${lang}`,
      // `x-default` points at the bare root, which the proxy resolves by
      // Accept-Language — the right answer for a crawler with no preference.
      languages: {
        ...Object.fromEntries(LANGS.map((code) => [code, `/${code}`])),
        "x-default": "/",
      },
    },
    openGraph: {
      type: "website",
      siteName: text.brand,
      title,
      description: text.metaDescription,
      url: `/${lang}`,
      locale: OG_LOCALE[lang],
    },
    icons: {
      icon: "/favicon.svg",
      apple: "/apple-touch-icon.svg",
    },
  };
}

export const viewport: Viewport = {
  // Both values, so the browser tints its own chrome to match whichever
  // appearance the reader is in rather than guessing from the first paint.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const lang = await langFromHeader();

  return (
    <html lang={lang}>
      <body className="bg-surface font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
