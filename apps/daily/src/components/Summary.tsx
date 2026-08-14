import type { SummaryText } from "@/lib/types";

export type Lang = "zh" | "en";

/**
 * One language's summary: a one-sentence lead, then prose.
 *
 * Only ever ONE language at a time. The two used to be interleaved line by
 * line, which was readable while a card was two lines long; now that a card
 * runs 150–600 characters, showing both would put a 1000-character wall on
 * screen. The reader picks a language at the top of the page instead.
 *
 * `leading-[1.85]` on the paragraphs is the one arbitrary number left in this
 * file, and it stays deliberately: the summaries were rewritten to be read
 * rather than skimmed, and Tailwind's nearest step down (`leading-relaxed`,
 * 1.625) takes back some of the air that change was for.
 *
 * The legacy branch renders digests archived under the older bullet shape —
 * background, points, implication. New runs never populate those.
 */
export function Summary({
  summary,
  variant,
}: {
  summary: SummaryText;
  variant: "hero" | "card";
}) {
  const hero = variant === "hero";
  const paragraphs = summary.paragraphs ?? [];
  const legacyPoints = summary.points ?? [];

  return (
    <div className="mt-4 flex flex-col gap-3">
      {summary.background ? (
        <p className={`text-ink-soft ${hero ? "text-base" : "text-sm"}`}>
          {summary.background}
        </p>
      ) : null}

      {summary.thesis ? (
        <p
          className={`font-semibold text-ink ${hero ? "text-lg" : "text-base"}`}
        >
          {summary.thesis}
        </p>
      ) : null}

      {/**
       * `font-medium` because 400-weight 思源黑体 reads thin at 14px — Chinese
       * glyphs carry many more strokes per em than Latin, so the same weight
       * that looks fine in English looks washed out in 中文. The CJK 500 subset
       * is requested in layout.tsx, so this is a real face and not a browser's
       * synthesised bold.
       */}
      {paragraphs.map((paragraph, i) => (
        <p
          className={`leading-[1.85] font-medium text-ink-mid ${hero ? "text-base" : "text-sm"}`}
          key={i}
        >
          {paragraph}
        </p>
      ))}

      {legacyPoints.length > 0 ? (
        <ul className="list-disc space-y-2 pl-5 text-sm text-ink-mid marker:text-orange">
          {legacyPoints.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      ) : null}

      {summary.implication ? (
        <p className="border-l-2 border-orange pl-3 text-sm text-ink-mid">
          {summary.implication}
        </p>
      ) : null}
    </div>
  );
}
