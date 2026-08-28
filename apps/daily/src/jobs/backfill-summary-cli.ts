/**
 * Local entry point: `npm run backfill-summary`.
 *
 * Repairs half-written takes in digests that already shipped — an article with
 * the Chinese half and no English, with the English and no Chinese, or over the
 * floor with neither. See jobs/backfill-summary.ts for what it will and will not
 * touch.
 *
 *   npm run backfill-summary                      every archived day
 *   npm run backfill-summary -- 2026-08-20        one day
 *   npm run backfill-summary -- --limit 5         the five newest broken takes
 *   DRY_RUN=1 npm run backfill-summary            commit locally, never push
 *
 * IT COSTS MODEL CALLS — one per broken take, plus a re-fetch of the article —
 * so `--limit` exists to make a first pass on an unfamiliar archive small on
 * purpose.
 *
 * IT REPLACED `npm run backfill-en`, which translated a Chinese take into
 * English. Same command shape, wider job, one prompt instead of two.
 */
import { backfillSummaries } from "./backfill-summary";

const args = process.argv.slice(2);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Walked position by position rather than filtered, because a filter cannot say
 * "this token was consumed as the value of the one before it".
 *
 * AN UNRECOGNISED ARGUMENT ABORTS, and that is the whole reason this is not three
 * lines of `indexOf`. With no dates given this command walks the ENTIRE archive,
 * so a typo that gets ignored is a typo that silently starts the most expensive
 * run available.
 */
const dates: string[] = [];
let limit: number | undefined;

for (let at = 0; at < args.length; at += 1) {
  const arg = args[at];
  if (DATE.test(arg)) {
    dates.push(arg);
    continue;
  }
  if (arg === "--limit") {
    const value = Number(args[at + 1]);
    if (!Number.isInteger(value) || value < 1) {
      console.error("[daily] --limit needs a positive integer");
      process.exit(1);
    }
    limit = value;
    at += 1; // the value belongs to this flag
    continue;
  }
  console.error(
    `[daily] unrecognised argument: ${arg}\n` +
      `usage: npm run backfill-summary -- [yyyy-mm-dd ...] [--limit N]`,
  );
  process.exit(1);
}

backfillSummaries({ dates, limit })
  .then((result) => {
    process.exit(result.missed && !result.repaired ? 1 : 0);
  })
  .catch((error) => {
    console.error("[daily] backfill failed:", error);
    process.exit(1);
  });
