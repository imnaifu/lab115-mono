import type { SummaryText } from "@/lib/types";

export type Lang = "zh" | "en";

/**
 * One language's summary: a one-sentence lead, then prose.
 *
 * Only ever ONE language at a time. The two used to be interleaved line by
 * line, which was readable while a card was two lines long; now that a card
 * runs 150–500 characters, showing both would put a 1000-character wall on
 * screen. The reader picks a language at the top of the page instead.
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
  const paragraphs = summary.paragraphs ?? [];
  const legacyPoints = summary.points ?? [];

  return (
    <div className={`summary${variant === "hero" ? " summary--hero" : ""}`}>
      {summary.background ? (
        <p className="summary__background">{summary.background}</p>
      ) : null}

      {summary.thesis ? (
        <p className="summary__thesis">{summary.thesis}</p>
      ) : null}

      {paragraphs.map((paragraph, i) => (
        <p className="summary__para" key={i}>
          {paragraph}
        </p>
      ))}

      {legacyPoints.length > 0 ? (
        <ul className="points">
          {legacyPoints.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      ) : null}

      {summary.implication ? (
        <p className="summary__implication">{summary.implication}</p>
      ) : null}
    </div>
  );
}
