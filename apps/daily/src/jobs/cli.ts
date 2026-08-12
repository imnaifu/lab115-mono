/**
 * Local entry point: `npm run once`.
 *
 * Pair it with DRY_RUN=1 to exercise the whole pipeline (fetch, summarize,
 * write, local commit) without pushing to GitHub or waking your phone:
 *
 *   DAILY_DATA_DIR=./data DRY_RUN=1 DEEPSEEK_API_KEY=... npm run once
 */
import { runDaily } from "./daily";

runDaily()
  .then((digest) => {
    console.log(JSON.stringify(digest, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("[daily] run failed:", error);
    process.exit(1);
  });
