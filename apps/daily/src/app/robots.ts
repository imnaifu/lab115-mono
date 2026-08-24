import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";

/**
 * robots.txt, generated rather than a file in `public/`.
 *
 * It WAS a static file, holding `User-agent: *` and `Allow: /` and nothing else —
 * which is the same as having no file at all, since allowing everything is the
 * default. What it was missing is the line that does something: a pointer to the
 * sitemap. A crawler that has to find this site's archive by walking
 * archive → day → article discovers old digests slowly or not at all.
 *
 * Generated so the domain comes from SITE. A hardcoded host in a text file is one
 * more place to forget on a rename, and the sitemap next door already reads it
 * from there.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /**
       * THE POSTER'S EXTRA PAGES ONLY — never the bare `share.png`.
       *
       * This used to disallow every `share.png` under a day outright, to save a Satori
       * render per crawl, and it was suppressing the thing it was protecting: that
       * exact URL is what every article page declares as `og:image` and
       * `twitter:image`, and the crawlers that unfurl a link — facebookexternalhit,
       * Twitterbot, and the ones behind the chat apps this site is designed to be
       * screenshotted into — read robots.txt before fetching an image. A disallowed
       * og:image is a link card with no card. Since the poster IS the distribution
       * mechanism here, that trade was backwards.
       *
       * So part 1 is open, and only `?part=2` and up are held back. Those are the
       * pages of prose, they are built client-side by the share sheet and linked
       * from no markup, so nothing was ever going to crawl them anyway — the rule
       * survives as a statement of intent rather than as a load-bearing block. The
       * render cost that motivated the original line is handled where it belongs:
       * `share.png/route.tsx` sends `max-age=3600` and `poster-serve` keeps every
       * image it renders.
       */
      disallow: ["/*/d/*/*/share.png?*"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
