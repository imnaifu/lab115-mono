import { SITE } from "../../src/lib/config";
import { resolveSite, submitSitemap } from "./gsc";

/**
 * Resubmit the sitemap to Search Console, and print what Google currently thinks
 * of it.
 *
 * THE GOOGLE-FACING HALF of the post-migration push. `resubmit.ts` covers
 * IndexNow, which Google does not participate in — this is the one lever on the
 * Google side that is an API call rather than a person clicking in the UI.
 *
 * KEEP THE EXPECTATIONS HONEST: this re-queues a READ of the sitemap. It does not
 * index anything, and the 379 Chinese pages sitting at «已发现 — 尚未编入索引»
 * will not move because of it. It is worth doing after a URL migration because
 * the `lastModified` values are now the only machine-readable statement that
 * every page on this site changed address, and it costs one request.
 *
 *   npx tsx tools/gsc/sitemap-submit.ts
 *
 * Not gated behind a --confirm, unlike the IndexNow push: resubmitting a sitemap
 * that is already submitted re-registers the same URL and changes nothing else,
 * so there is no state here to destroy by pressing up-arrow.
 */
async function main() {
  const siteUrl = await resolveSite();
  const sitemapUrl = `${SITE}/sitemap.xml`;

  console.log(`资源  : ${siteUrl}`);
  console.log(`sitemap: ${sitemapUrl}\n`);

  await submitSitemap(siteUrl, sitemapUrl);
  console.log(`已重新提交。\n`);

  console.log(`这只是让 Google 重新读一遍 sitemap —— 不等于会索引。`);
  console.log(`2–4 周后用 coverage.ts 重测，基线是中文 0/379、英文 74/379。`);
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
