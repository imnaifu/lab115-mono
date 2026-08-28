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
 * `zh` IS THE FALLBACK, AND IT IS NOT AN ERROR PATH. Two ordinary situations land
 * there: a digest written while the site was Chinese-only, and one article whose
 * English half did not come back on a run where the Chinese did (see
 * `applySummaries` in lib/summarize.ts — the English is never worth re-asking at
 * the price of the Chinese already in hand).
 *
 * The alternative was rendering nothing for those, and nothing is worse: the
 * summary IS the page, so an English reader would get a headline over an empty
 * card. Showing the Chinese breaks the one-language-at-a-time rule in lib/i18n.ts
 * for exactly as long as the archive predates the English half, which is a cost
 * with an end date.
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
