/**
 * Local entry point: `npm run summary`.
 *
 * Publish a day from the scores in its file — including the ones you edited —
 * summarizing whatever clears the floor and has no take yet, then writing the
 * digest, pushing it, drawing the posters and sending the notification.
 *
 * IT ONLY WRITES THE SUMMARY SIDE, unconditionally. No score is recomputed, no
 * article is re-fetched, and nothing branches on what state the file is in: the
 * file is whatever `npm run score` left plus whatever you edited, and that is a
 * complete input by construction. Run it twice and the second run changes
 * nothing but the timestamp — an article that already has a take is not asked
 * for again.
 *
 * It writes the summary fields and nothing else: a score in that file is
 * whatever you left it as, and one that no longer matches the model's is
 * published saying so (`modelScore` + `scoredBy: "human"`).
 *
 * It is the expensive half. The floor is applied before a single summary is
 * requested, so pushing one article over the line costs that article's summary
 * and not the day's.
 *
 *   npm run summary                     # today, in TZ
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
    // Split by whether the hand-set score put the article ON the page or kept
    // it off: both are edits, and they are opposite decisions.
    const edited = digest.articles.filter((a) => a.scoredBy === "human");
    const up = edited.filter((a) => a.summary).length;
    const down = edited.length - up;
    console.log(
      `[daily] ${digest.date} published — ${digest.stats.shown} of ` +
        `${digest.stats.fetched}` +
        (up ? `, ${up} on a hand-set score` : "") +
        (down ? `, ${down} held back by hand` : ""),
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("[daily] summary failed:", (error as Error).message);
    process.exit(1);
  });
