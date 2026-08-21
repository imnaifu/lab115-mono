import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import { MAX_STARS, starCount } from "@/lib/score";

/**
 * The score, as five stars.
 *
 * Plain ★/☆ glyphs rather than SVG: they sit inside a `text-xs` meta line whose
 * other items are words, so they inherit the size and the baseline for free, and
 * this page has no icon set to be consistent with.
 *
 * The arithmetic is `starCount` in lib/score.ts, shared with the share poster so
 * the two cannot disagree. It counts UP FROM THE PUBLISH FLOOR — dividing the
 * full scale into fifths put every published article on the same two stars, and
 * five stars was unreachable. See the note there.
 */
export function Stars({ score, lang }: { score: number; lang: Lang }) {
  // A score of 0 means the summarizer never spoke for this article — a failed
  // call, not a verdict of "worthless" (see the thesis check in jobs/daily.ts) —
  // and a digest archived before scores existed carries none at all. Both are
  // the absence of a rating, so both render nothing rather than a bad one.
  if (!Number.isFinite(score) || score <= 0) return null;

  const filled = starCount(score);

  return (
    // role="img" + aria-label so the label is read INSTEAD of ten glyph names.
    <span
      role="img"
      aria-label={strings(lang).rating(filled)}
      className="whitespace-nowrap"
    >
      <span className="text-orange">{"★".repeat(filled)}</span>
      <span className="opacity-40">{"☆".repeat(MAX_STARS - filled)}</span>
    </span>
  );
}
