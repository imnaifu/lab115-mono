import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";

/**
 * robots.txt, generated rather than a file in `public/`.
 *
 * It WAS `public/robots.txt`, and the problem with it was not its contents — an
 * `Allow: /` plus a sitemap line is exactly right for a site with nothing to hide
 * — it was that a static file cannot read a constant. The domain was written out
 * inside it a third time, and it is the copy nothing would catch on a rename: a
 * wrong `Sitemap:` line does not break a page or fail a build, it just quietly
 * points a crawler at a host that no longer answers. Generated from SITE, which is
 * the same arrangement apps/daily uses.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
