import type { SummaryText } from "@/lib/types";

/**
 * Chinese and English are interleaved line by line, not split into two blocks.
 *
 * The old layout put every English sentence in one "ENGLISH" section at the
 * bottom of the card, which meant reading it required scrolling back up to
 * find the Chinese it belonged to. Pairing them makes each line legible on its
 * own — which is what a screenshot needs, since the reader cannot scroll.
 *
 * The two point arrays are zipped positionally: the English pass is told to
 * return the same number of takeaways in the same order. When it returns
 * fewer anyway, the unpaired Chinese lines simply render alone.
 */
export function Bilingual({
  zh,
  en,
  variant,
}: {
  zh: SummaryText;
  en: SummaryText;
  variant: "hero" | "card";
}) {
  const thesisClass = variant === "hero" ? "hero__thesis" : "card__thesis";

  return (
    <>
      {zh.thesis ? (
        <div className="thesis">
          <p className={thesisClass}>{zh.thesis}</p>
          {en.thesis ? <p className={`${thesisClass} is-en`}>{en.thesis}</p> : null}
        </div>
      ) : null}

      {zh.points.length > 0 ? (
        <ul className="points">
          {zh.points.map((point, i) => (
            <li key={i}>
              <span className="points__zh">{point}</span>
              {en.points[i] ? (
                <span className="points__en">{en.points[i]}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
