import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

/** How many points of `score` one star is worth. */
const PER_STAR = 20;

const MAX_STARS = 5;

/**
 * The model's 0–100 score, as five stars.
 *
 * Plain ★/☆ glyphs rather than SVG: they sit inside a `text-xs` meta line whose
 * other items are words, so they inherit the size and the baseline for free, and
 * this page has no icon set to be consistent with.
 *
 * The scale is simply `score / 20` — the model's own range cut into fifths. It is
 * NOT stretched to fit the published band: a digest written today cleared a floor
 * of 40, so mapping 40–100 onto 1–5 would spend the whole width of the scale on
 * the narrow part of it and rate an article that passed the floor at one star.
 * Divided honestly, today's digests run two stars to five, and the archived ones
 * written before the floor existed still show the one-star pieces they published
 * — which is the point of not rescaling.
 */
export function Stars({ score, lang }: { score: number; lang: Lang }) {
  // A score of 0 means the summarizer never spoke for this article — a failed
  // call, not a verdict of "worthless" (see the thesis check in jobs/daily.ts) —
  // and a digest archived before scores existed carries none at all. Both are
  // the absence of a rating, so both render nothing rather than a bad one.
  if (!Number.isFinite(score) || score <= 0) return null;

  const filled = Math.min(MAX_STARS, Math.max(1, Math.round(score / PER_STAR)));

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
