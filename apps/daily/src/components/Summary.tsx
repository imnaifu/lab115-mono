import type { SummaryText } from "@/lib/types";

/** The quieter English half of a bilingual card. Rendered only when the model
 *  actually produced something — a fallback verdict has empty points. */
export function EnglishBlock({ en }: { en: SummaryText }) {
  if (!en.thesis && en.points.length === 0) return null;

  return (
    <div className="en">
      <span className="en__label">English</span>
      {en.thesis ? <p className="en__thesis">{en.thesis}</p> : null}
      <Points points={en.points} />
    </div>
  );
}

export function Points({ points }: { points: string[] }) {
  if (points.length === 0) return null;

  return (
    <ul className="points">
      {points.map((point, i) => (
        <li key={i}>{point}</li>
      ))}
    </ul>
  );
}
