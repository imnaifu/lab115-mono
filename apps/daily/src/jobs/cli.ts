/**
 * Local entry point: `npm run once`.
 *
 * Pair it with DRY_RUN=1 to exercise the whole pipeline (fetch, summarize,
 * write, local commit) without pushing to GitHub or waking your phone:
 *
 *   DRY_RUN=1 npm run once
 *
 * Unlike the scheduled run this regenerates today even if it is already
 * published — re-running by hand is the whole point of this entry point.
 * Pass `--skip-if-published` to get the cron's behaviour instead.
 */
import { runDaily } from "./daily";

const skipIfPublished = process.argv.includes("--skip-if-published");

runDaily(new Date(), { skipIfPublished })
  .then((digest) => {
    if (!digest) {
      console.log("[daily] nothing to do — today is already published");
    } else {
      console.log(JSON.stringify(digest, null, 2));
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("[daily] run failed:", error);
    process.exit(1);
  });
