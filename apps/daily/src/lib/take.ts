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
/**
 * `whyItMatters` IS DELIBERATELY NOT PART OF "COMPLETE", and this is the note
 * that has to stop someone adding it.
 *
 * The field is optional BY DESIGN, not by accident: the summary prompt tells the
 * model to return an empty one rather than a platitude when an article has no
 * real answer to the question (see the 「为什么值得读」 section there). So an
 * absent one is frequently the CORRECT output.
 *
 * Adding it here would turn every one of those correct outputs into an
 * incomplete take — which means `repairTakes` re-asks for the whole summary, at
 * one extra model call per article, to chase a field the model already declined
 * on purpose; and since the re-ask uses the same prompt, it would mostly decline
 * again and the article would be logged as "still incomplete" forever. Worse,
 * the pressure of being re-asked is exactly what produces the platitude the
 * prompt is written to keep out.
 *
 * `report` in summarize.ts counts the field separately for this reason: how many
 * takes have one is worth watching, and it is not the same question as whether a
 * take is whole.
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
 * THERE IS NO `leadOf(summary)` HERE, AND THERE WAS FOR ONE ROUND. The note is
 * the whole point of this block, because the helper looked obviously right.
 *
 * It returned `whyItMatters ?? thesis` — "the one sentence to show" — and eleven
 * surfaces were moved onto it. The mistake it encoded is that the two fields are
 * two VERSIONS of the same sentence, one better than the other, so a site should
 * prefer the better one everywhere and fall back. They are not. They are two
 * LAYERS, and which one a surface wants is decided by what the reader already
 * knows:
 *
 *   thesis        什么事           — for a reader deciding whether to open it
 *   whyItMatters  所以呢           — for a reader who already did
 *
 * Measured over the 22 takes that carried both (2026-09-19 to 09-21): a card
 * showing `whyItMatters` tells a reader who has read nothing that «这类研究把
 * 「生命为什么突然变复杂」从哲学问题变成物理问题» — true, and no use at all for
 * deciding, because it never says an ancient mountain range was ground into the
 * sea. The thesis says exactly that. One field cannot do both jobs, so nothing
 * here should offer a way to ask for "the" sentence.
 *
 * So every surface names the field it wants. `summary.thesis` on every
 * discovery surface — the day cards, the front page's teaser, the topic rows,
 * the related rows, `<meta name="description">`, the feed, the poster, the mail.
 * `summary.whyItMatters` in exactly one place, the block under the prose on the
 * article page. See components/Summary.
 */

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
