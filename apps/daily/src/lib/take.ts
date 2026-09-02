import type { Lang } from "./lang";
import type { DailyPhoto, PublishedArticle, SummaryText } from "./types";

/**
 * A take is the Chinese AND the English. This is the one place that says so.
 *
 * ONE PREDICATE OVER TWO SHAPES, which is why the parameter is structural rather
 * than a named type: the summary pass holds a `Verdict` (`en: SummaryText | null`,
 * still in memory) and the archive holds an `Article["summary"]` (`en?: SummaryText`,
 * read off disk). They are the same question asked at two moments, and a second
 * copy of the expression is a second place for "complete" to drift.
 *
 * `zh.thesis` rather than `zh`, because the empty `SummaryText` that
 * `emptyVerdict` installs is an object: an article the summary pass never
 * answered for has a `zh` and no thesis in it, and that is not half a take, it
 * is none.
 *
 * Read by pass 3 of `summarizeSurvivors` to decide what to re-ask for, and by
 * `backfill-summary` to decide what to re-ask for in the archive.
 */
export function isCompleteTake(
  take: { zh: SummaryText; en?: SummaryText | null } | undefined,
): boolean {
  return Boolean(take?.zh.thesis && take.en);
}

/**
 * The take a reader on `lang` should see, with ONE fallback.
 *
 * Every renderer goes through here — the card, the article page, the masthead's
 * length arithmetic, the share poster and the poster cache job — because they all
 * used to reach for `article.summary.zh` directly, and that hardcoded Chinese
 * into six places that each already knew the reader's language.
 *
 * `zh` IS THE FALLBACK, AND IT IS NOT AN ERROR PATH — but it now serves ONE
 * situation rather than two: a digest written while the site was Chinese-only.
 *
 * The second one is gone. An article whose English half did not come back used
 * to publish Chinese-only and land here, and `publishFrom` now holds it back
 * instead: a take is both languages at the page's gate, the same definition
 * `isCompleteTake` above has always used for the repair pass. So for anything
 * written from that change onward this fallback cannot fire.
 *
 * It stays because the archive predates it, and because rendering nothing is
 * worse than rendering the Chinese: the summary IS the page, so an English
 * reader would get a headline over an empty card. Breaking the
 * one-language-at-a-time rule in lib/i18n.ts is a cost with an end date — the
 * date the last Chinese-only digest falls out of what anyone reads.
 */
export function summaryFor(
  article: PublishedArticle,
  lang: Lang,
): SummaryText {
  return (lang === "en" ? article.summary.en : undefined) ?? article.summary.zh;
}

/**
 * The day photo's caption for a reader on `lang`, with the same single fallback
 * and for the same reason as `summaryFor` above.
 *
 * `en` is absent, not empty, when Wikimedia shipped no English description for
 * that file — and on those days a Chinese caption under an English-language page
 * is still the right call: the sentence exists to say what the photograph shows,
 * and the alternative is a picture with nothing under it.
 */
export function captionFor(photo: DailyPhoto, lang: Lang): string {
  return (lang === "en" ? photo.caption.en : undefined) ?? photo.caption.zh;
}
