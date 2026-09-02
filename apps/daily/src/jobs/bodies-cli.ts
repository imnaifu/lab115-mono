/**
 * Local entry point: `npm run bodies`.
 *
 * Walks every archived digest and fetches the article bodies it does not have
 * yet into `data/bodies/<date>.json`. Read-only as far as the digests go — it
 * writes nothing into the clone and pushes nothing.
 *
 * Run it once and re-scoring any archived day becomes free. It is safe to run
 * again: only ids missing from the cache are fetched, so a second run over the
 * same days makes no requests at all.
 *
 * Pass `--date=2026-08-28` for one day, or nothing for all of them.
 */
import { fetchMissingBodies } from "@/lib/body-cache";
import { listDates, readDigest } from "@/lib/store";

async function main() {
  const asked = process.argv
    .find((arg) => arg.startsWith("--date="))
    ?.slice("--date=".length);
  const dates = asked ? [asked] : (await listDates()).slice().sort();
  if (!dates.length) {
    console.log("[bodies] no archived digests found under data/repo");
    return;
  }

  let totalFetched = 0;
  let totalEmpty = 0;
  let totalCached = 0;
  for (const date of dates) {
    const digest = await readDigest(date);
    if (!digest) {
      console.log(`  ${date}  no digest`);
      continue;
    }
    const articles = digest.articles.map((a) => ({ id: a.id, url: a.url }));
    const { bodies, fetched, empty } = await fetchMissingBodies(
      date,
      articles,
    );
    const held = articles.filter((a) => bodies[a.id]).length;
    totalFetched += fetched;
    totalEmpty += empty;
    totalCached += held;
    console.log(
      `  ${date}  ${String(articles.length).padStart(3)} articles  ` +
        `${String(fetched).padStart(3)} fetched now  ` +
        `${held}/${articles.length} with a body` +
        (empty ? `  (${empty} came back empty)` : ""),
    );
  }
  console.log(
    `\n[bodies] ${totalFetched} fetched this run, ` +
      `${totalCached} articles now have a body, ` +
      `${totalEmpty} could not be brought back.`,
  );
}

main().catch((error) => {
  console.error("[bodies] failed:", error);
  process.exit(1);
});
