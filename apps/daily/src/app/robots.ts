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
/**
 * The AI crawlers, named so the policy is a DECISION rather than a default.
 *
 * They were already allowed — `User-agent: *` covers them and always did — so
 * this changes no behaviour. What it changes is that the answer is now written
 * down: this site exists to be read and passed on, an AI search engine that
 * summarises it and links back is the same distribution as a human sharing a
 * poster, and the structured data already tells one exactly what it is looking at
 * (see `isBasedOn` on the article page — our summary OF someone else's article,
 * with their byline and publisher attached).
 *
 * TO REVERSE IT, change `allow` to `disallow: ["/"]` in the group below. Doing it
 * here rather than by deleting the group matters: without a named group these
 * bots fall back to `*` and are allowed again, silently.
 *
 * THE GROUP REPEATS THE `/share/` RULES, and that is not redundancy — robots
 * groups do not inherit. A crawler that matches a named `User-agent` ignores `*`
 * entirely, so a group holding only `Allow: /` would hand these bots the poster
 * pages that every other crawler is held back from.
 *
 * `Google-Extended` is not Googlebot: it governs Gemini and AI Overviews
 * grounding, and blocking it does NOT remove the site from Search. They are
 * separate switches on purpose, which is the reason to name it separately here.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
  "meta-externalagent",
  "Bytespider",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
      userAgent: "*",
      /**
       * `/` and then part 1 of the posters, which is one list rather than two
       * fields: `allow` may only appear once, and the second entry is the carve-out
       * from the `disallow` below.
       *
       * Google resolves allow/disallow by LONGEST MATCH, so the part-1 pattern
       * beats the bare `/share/` block and that block still covers 2 and up.
       */
      allow: ["/", "/share/*/1.png$"],
      /**
       * THE POSTER'S EXTRA PAGES ONLY — never part 1.
       *
       * This used to disallow every poster outright, to save a Satori render per
       * crawl, and it was suppressing the thing it was protecting: part 1 is what
       * every article page declares as `og:image` and
       * `twitter:image`, and the crawlers that unfurl a link — facebookexternalhit,
       * Twitterbot, and the ones behind the chat apps this site is designed to be
       * screenshotted into — read robots.txt before fetching an image. A disallowed
       * og:image is a link card with no card. Since the poster IS the distribution
       * mechanism here, that trade was backwards.
       *
       * So part 1 is open, and only parts 2 and up are held back. Those are the
       * pages of prose, they are built client-side by the share sheet and linked
       * from no markup, so nothing was ever going to crawl them anyway — the rule
       * survives as a statement of intent rather than as a load-bearing block. The
       * render cost that motivated the original line is handled where it belongs:
       * the poster route sends `max-age=3600` and `poster-serve` keeps every image
       * it renders.
       *
       * The SHAPE of this changed with the poster URLs — it used to be a single
       * pattern ending in `share.png` followed by a query wildcard, matching the
       * `?part=` that used to carry the part number. The decision behind it did
       * not change. A path segment cannot express "2 and up" in a robots pattern,
       * so it is a block here plus the carve-out in `allow` above, which is easier
       * to read than the query pattern was.
       */
      disallow: ["/share/"],
      },
      {
        userAgent: AI_CRAWLERS,
        allow: ["/", "/share/*/1.png$"],
        disallow: ["/share/"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
