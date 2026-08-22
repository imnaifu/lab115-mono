/**
 * Local entry point: `npm run backfill-en`.
 *
 * Writes the English half into archived digests that shipped without one. See
 * jobs/backfill.ts for what it will and will not touch.
 *
 *   npm run backfill-en                      every archived day
 *   npm run backfill-en -- 2026-08-20        one day
 *   npm run backfill-en -- --limit 5         the five newest articles missing it
 *   DRY_RUN=1 npm run backfill-en            commit locally, never push
 *
 * IT COSTS MODEL CALLS — one per article — so `--limit` exists to make a first
 * pass on an unfamiliar archive small on purpose.
 */
import { backfillEnglish } from "./backfill";

const args = process.argv.slice(2);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Walked position by position rather than filtered, because a filter cannot say
 * "this token was consumed as the value of the one before it".
 *
 * AN UNRECOGNISED ARGUMENT ABORTS, and that is the whole reason this is not three
 * lines of `indexOf`. With no dates given this command backfills the ENTIRE
 * archive, so a typo that gets ignored is a typo that silently starts the most
 * expensive run available. The first version of this consumed `--limit`'s value
 * by index and computed that index as -1 + 1 when the flag was absent — which
 * excused argument 0 from validation, so `backfill-en bogus` ran the full archive
 * instead of refusing. It cost nothing only because the key was unset.
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
      `usage: npm run backfill-en -- [yyyy-mm-dd ...] [--limit N]`,
  );
  process.exit(1);
}

backfillEnglish({ dates, limit })
  .then((result) => {
    process.exit(result.missed && !result.written ? 1 : 0);
  })
  .catch((error) => {
    console.error("[daily] backfill failed:", error);
    process.exit(1);
  });
