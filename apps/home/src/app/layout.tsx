import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang, LANGS, otherLang, type Lang } from "@/lib/lang";
import { SITE } from "@/lib/config";
import { ogCardFor } from "@/lib/seo";
import "@/index.css";

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
    metadataBase: new URL(SITE),
    title,
    description: text.metaDescription,
    alternates: {
      canonical: href(lang, "/"),
      /**
       * `x-default` NAMES THE DEFAULT LANGUAGE'S PAGE, not the bare root.
       *
       * It used to be `/`, on the reasoning that the proxy resolves that by
       * Accept-Language and so it is "the right answer for a crawler with no
       * preference". The reasoning was sound and the outcome was a bug.
       *
       * A crawler with no preference does not get a negotiation — it gets Chinese,
       * every time, because Googlebot sends no Accept-Language and `detectLang`
       * falls back to DEFAULT_LANG. So `/` was a stable second address for `/zh`,
       * and this tag was the site NOMINATING it. Google clustered the two and chose
       * `/` over the page's own `<link rel="canonical">`; Search Console reported
       * `lab115.com/zh` as "Duplicate, Google chose different canonical than user".
       * apps/daily had the identical tag and the identical symptom on three pages.
       *
       * THE REDIRECT WENT TOO, which is what makes this simple rather than a
       * mitigation. The default language is unprefixed now, so `/` is the Chinese
       * page — there is no negotiating URL left anywhere to name. `x-default` and
       * `zh` therefore point at the same URL, which is a documented configuration
       * and not a workaround: it says that a reader who asked for nothing in
       * particular gets the page they actually land on.
       */
      languages: {
        ...Object.fromEntries(LANGS.map((code) => [code, href(code, "/")])),
        "x-default": href(DEFAULT_LANG, "/"),
      },
    },
    openGraph: {
      type: "website",
      siteName: text.brand,
      title,
      description: text.metaDescription,
      // Through `href` like the canonical above, so the two can never disagree.
      // An og:url is what an unfurler stores and shows as the link's identity, so
      // it has to name a page rather than a redirect.
      url: href(lang, "/"),
      locale: OG_LOCALE[lang],
      alternateLocale: OG_LOCALE[otherLang(lang)],
      /**
       * The card, which did not exist.
       *
       * Every tag above this one is about WHICH url to index; none of them puts
       * anything on screen when the url is pasted somewhere. Without an og:image a
       * link to this site unfurls as a line of grey text — in a chat thread, in a
       * tweet, in a Slack channel, which for the front door of a brand is most of
       * where it is ever seen. See lib/og.tsx for what is drawn on it.
       */
      images: ogCardFor(lang),
    },
    /**
     * Twitter's own tags, which were absent entirely — it falls back to the og
     * ones, but not for the CARD TYPE, and the default without this is the small
     * square thumbnail. `summary_large_image` is what makes a 1.91:1 card the whole
     * preview rather than a stamp beside the text.
     */
    twitter: {
      card: "summary_large_image",
      title,
      description: text.metaDescription,
      images: ogCardFor(lang).map((image) => image.url),
    },
    icons: {
      icon: "/favicon.svg",
      /**
       * A PNG, and it has to be.
       *
       * This was `apple-touch-icon.svg`. iOS does not read SVG for a home-screen
       * icon — it ignores the link and screenshots the page instead, which is why
       * "add to home screen" produced a thumbnail of the hero rather than the mark.
       * The file is the same artwork as favicon.svg rasterized at 180x180, the size
       * iOS asks for.
       */
      apple: "/apple-touch-icon.png",
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
