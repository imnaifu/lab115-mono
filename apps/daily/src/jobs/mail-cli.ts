/**
 * Send one day's edition by hand: `npm run mail -- 2026-08-25`.
 *
 * WHAT IT IS FOR: the day the scheduled send failed — a Resend outage, a key
 * that had expired, a run that died between the push and the mail. The digest is
 * already in the repo by then, so this reads it back and mails it, and the name
 * check means running it on a day that DID go out is a no-op rather than a second
 * copy in everyone's inbox.
 *
 * `--test` renames the broadcast to `…-test<n>` so it does not consume the real
 * edition's name. Use it with a segment that contains only you:
 *
 *   npm run mail -- 2026-08-25 --test
 *
 * `DRY_RUN=1` renders and reports the size without sending anything at all.
 */
import { readDigest, readLatest } from "@/lib/store";
import { mailDigest } from "./mail";

const args = process.argv.slice(2);
const test = args.includes("--test");
const date = args.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));

async function main(): Promise<void> {
  const digest = date ? await readDigest(date) : await readLatest();
  if (!digest) {
    console.error(`[mail] no digest for ${date ?? "the most recent day"}`);
    process.exit(1);
  }

  // A suffix that changes every run, so repeated test sends are never blocked by
  // the idempotency check they are not the subject of.
  const nameSuffix = test ? `-test${Math.floor(Date.now() / 1000) % 100000}` : "";
  await mailDigest(digest, { nameSuffix });
}

main().catch((error) => {
  console.error("[mail] failed:", error);
  process.exit(1);
});
