/**
 * Local entry point: `npm run score`.
 *
 * The first half of a run — fetch today's articles and score them — and then
 * it stops. Nothing is summarized, nothing is committed, nothing is pushed and
 * no phone rings. What it leaves is the day's own digest file, with every
 * fetched article in it and a `score` on each, sitting dirty in the clone:
 * that file is the thing you edit, and `npm run summary` finishes it.
 *
 * IT REPLACES THE FILE. Not a merge — everything that was in it is gone,
 * including takes written by an earlier `npm run summary` and including scores
 * you edited by hand. Run it and the day starts over from the feeds.
 *
 * That is a choice, and the alternative was in place first: carry the takes
 * across, refresh only the numbers. It makes re-scoring cheap and it makes the
 * file's contents depend on its own history — the same command run twice on the
 * same day produces different output the second time, and everything reading
 * that file needs to handle "the summaries might already be there". Being able
 * to say what this command produces is worth more than the model calls it saves.
 */
import { PUBLISH_MIN_SCORE } from "@/lib/categories";
import { runScore } from "./daily";

/** Cut a headline to fit one terminal line beside the columns before it. */
function clip(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, width - 1)}…`;
}

runScore(new Date())
  .then(({ working, path }) => {
    console.log(`\n[daily] scores written — data/repo/${path}\n`);

    // Sorted by score already. The floor is drawn as a line through the table
    // rather than printed per row: the question this output exists to answer
    // is "what is sitting just under it", and a rule you can see the gap
    // around answers it faster than a column of yes/no.
    let floorDrawn = false;
    const rule = () =>
      console.log(`  ────── floor ${PUBLISH_MIN_SCORE} ${"─".repeat(40)}`);

    console.log("  score  source            article");
    for (const article of working.articles) {
      if (!floorDrawn && article.score < PUBLISH_MIN_SCORE) {
        floorDrawn = true;
        rule();
      }
      const score = String(article.score).padStart(5);
      const source = article.sourceId.padEnd(16);
      // Never scored, which is not the same as scored low — the model failed
      // to answer for this one and it will publish nothing without a number
      // typed in by hand.
      const flag = article.review ? " " : "!";
      console.log(`  ${score}${flag} ${source}  ${clip(article.title, 52)}`);
    }
    if (!floorDrawn) rule();

    const judged = working.articles.filter((a) => a.review).length;
    const above = working.articles.filter(
      (a) => a.score >= PUBLISH_MIN_SCORE,
    ).length;
    // Counted separately on purpose: "scored" is not "fetched" when a model
    // call dropped, and neither is "above the floor". One number would hide
    // whichever of the three went wrong.
    console.log(
      `\n  ${working.articles.length} fetched, ${judged} scored` +
        (judged < working.articles.length
          ? ` (${working.articles.length - judged} marked ! — the model never ` +
            `answered for them)`
          : "") +
        `, ${above} above the floor.` +
        `\n  Edit "score" in the file above, then:\n` +
        `\n    npm run summary -- --date=${working.date}\n`,
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("[daily] score failed:", error);
    process.exit(1);
  });
