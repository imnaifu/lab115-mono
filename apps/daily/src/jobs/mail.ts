import { DRY_RUN } from "@/lib/config";
import { LANGS } from "@/lib/lang";
import { digestEmail } from "@/lib/mail/render";
import { broadcastNames, mailEnabled, segmentFor, sendBroadcast } from "@/lib/mail/resend";
import { shownArticles } from "@/lib/store";
import type { Digest } from "@/lib/types";

/**
 * One day's edition, to each language's list.
 *
 * IT CANNOT FAIL THE RUN, and the caller enforces that with a catch. By the
 * time this is reached the digest is written and pushed; a mail that does not
 * go out is a day the site still has and the inbox does not, which is
 * recoverable by hand and not worth losing a run over.
 *
 * IDEMPOTENT WITHOUT LOCAL STATE. `runDaily` is re-runnable on purpose, and a
 * second run must not mail the list twice — so each edition is named
 * `daily-<date>-<lang>` and an existing broadcast under that name is the record
 * that it already went. Resend holds it, which is the same place the list lives,
 * so there is nothing here to keep in sync and nothing to lose with the volume.
 *
 * PER LANGUAGE, INDEPENDENTLY. One segment failing — misconfigured, or an API
 * error mid-flight — must not take the other side's edition with it, so the
 * try/catch is inside the loop.
 */
export async function mailDigest(
  digest: Digest,
  options: { nameSuffix?: string } = {},
): Promise<void> {
  if (!mailEnabled()) return;

  /**
   * An empty day is not mailed.
   *
   * The site can say 今日无更新 honestly — a reader who opened it asked. An email
   * that arrives to say nothing happened is training the reader to ignore the
   * sender, and it spends the one piece of attention this address gets a day.
   */
  if (shownArticles(digest).length === 0) {
    console.log(`[mail] ${digest.date} has nothing to show — not sending`);
    return;
  }

  const sent = await broadcastNames();

  for (const lang of LANGS) {
    const name = `daily-${digest.date}-${lang}${options.nameSuffix ?? ""}`;

    const segment = segmentFor(lang);
    if (!segment) {
      console.warn(`[mail] no segment for "${lang}" — skipping`);
      continue;
    }

    if (sent.has(name)) {
      console.log(`[mail] ${name} already sent — skipping`);
      continue;
    }

    try {
      const { subject, html, text } = digestEmail(digest, lang);

      if (DRY_RUN) {
        console.log(
          `[mail] DRY_RUN — would send ${name}: "${subject}" ` +
            `(${Buffer.byteLength(html)} bytes html)`,
        );
        continue;
      }

      const { id } = await sendBroadcast({ name, segmentId: segment, subject, html, text });
      console.log(`[mail] sent ${name} (${id})`);
    } catch (error) {
      console.error(`[mail] ${name} failed:`, error);
    }
  }
}
