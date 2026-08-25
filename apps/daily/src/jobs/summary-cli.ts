/**
 * Local entry point: `npm run summary`.
 *
 * The second half of a run: read the day's file as `npm run score` left it —
 * INCLUDING any score you edited — summarize everything at or above the floor
 * that has no take yet, then write the published digest, push it, draw the
 * posters and send the notification.
 *
 * It writes the summary fields and nothing else: a score in that file is
 * whatever you left it as, and one that no longer matches the model's is
 * published saying so (`modelScore` + `scoredBy: "human"`).
 *
 * It is the expensive half. The floor is applied before a single summary is
 * requested, so pushing one article over the line costs that article's summary
 * and not the day's.
 *
 *   npm run summary                     # today, in DAILY_TZ
 *   npm run summary -- --date=2026-08-23
 *
 * Pair it with DRY_RUN=1 to write the digest locally without pushing to GitHub
 * or waking your phone:
 *
 *   DRY_RUN=1 npm run summary
 */
import { dateKey } from "@/lib/config";
import { runPublish } from "./daily";

/** `--date=2026-08-23`, or today. Not validated here — the store rejects
 *  anything that is not a date and it surfaces as a missing digest, which is
 *  the same message a typo deserves. */
const dateArg = process.argv
  .find((arg) => arg.startsWith("--date="))
  ?.slice("--date=".length);

const date = dateArg ?? dateKey(new Date());

runPublish(date)
  .then((digest) => {
    const edited = digest.articles.filter((a) => a.scoredBy === "human").length;
    const editedOut = (digest.rejected ?? []).filter(
      (a) => a.scoredBy === "human",
    ).length;
    console.log(
      `[daily] ${digest.date} published — ${digest.stats.shown} shown` +
        (edited ? `, ${edited} of them on a hand-set score` : "") +
        (editedOut ? `, ${editedOut} held back by hand` : ""),
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("[daily] summary failed:", (error as Error).message);
    process.exit(1);
  });
