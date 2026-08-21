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
       * The poster routes. They serve PNGs, not pages, and a crawler fetching
       * them costs a Satori render each — for an image it will find anyway
       * through the og:image tag on the article page, which is the copy that
       * carries context.
       */
      disallow: ["/*/d/*/*/share.png"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
