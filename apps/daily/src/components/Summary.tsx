import type { Lang } from "@/lib/lang";
import type { SummaryText } from "@/lib/types";

/**
 * The hero-sized variant runs every block a step larger than a card does.
 * Nothing renders a hero card any more, but the single-article page uses the
 * larger size for the one summary it shows.
 *
 * `rule` is the orange bar beside the thesis, one step heavier on the hero. The
 * share poster draws the same bar from POSTER.thesisRule in lib/share.ts — if the
 * weight changes here, change it there.
 */
const SIZE = {
  hero: {
    background: "text-base",
    thesis: "text-lg",
    rule: "border-l-[3px] pl-4",
    para: "text-base",
  },
  card: {
    background: "text-sm",
    thesis: "text-base",
    rule: "border-l-2 pl-3",
    para: "text-sm",
  },
} as const;

/**
 * One language's summary: a one-sentence lead, then prose.
 *
 * It takes both languages and the choice, rather than the chosen one, so the
 * call sites do not each have to remember to index by language.
 *
 * Only ever ONE language on screen. The two used to be interleaved line by
 * line, which was readable while a card was two lines long; now that a card
 * runs 150–600 characters, showing both would put a 1000-character wall on
 * screen.
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
  lang,
}: {
  summary: { zh: SummaryText; en: SummaryText };
  variant: "hero" | "card";
  lang: Lang;
}) {
  const text = summary[lang];
  const size = SIZE[variant];

  const paragraphs = text.paragraphs ?? [];
  const legacyPoints = text.points ?? [];

  return (
    <div className="mt-4 flex flex-col gap-3">
      {text.background ? (
        <p className={`text-ink-soft ${size.background}`}>{text.background}</p>
      ) : null}

      {/* The claim, marked out by the accent bar the site uses for emphasis —
          the same one the legacy `implication` block below carries. */}
      {text.thesis ? (
        <p
          className={`border-orange font-semibold text-ink ${size.thesis} ${size.rule}`}
        >
          {text.thesis}
        </p>
      ) : null}

      {/* `data-para` is how the share dialog works out which paragraphs a text
          selection touches, so the poster can highlight them. The index is the
          one the poster route indexes by too — the same array, same order. */}
      {paragraphs.map((paragraph, i) => (
        <p
          data-para={i}
          className={`leading-[1.85] font-medium text-ink-mid ${size.para}`}
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

      {text.implication ? (
        <p className="border-l-2 border-orange pl-3 text-sm text-ink-mid">
          {text.implication}
        </p>
      ) : null}
    </div>
  );
}
