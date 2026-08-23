import { blocksOf } from "@/lib/paragraphs";
import type { SummaryText } from "@/lib/types";

/**
 * The hero-sized variant runs every block a step larger than a card does.
 * Nothing renders a hero card any more, but the single-article page uses the
 * larger size for the one summary it shows.
 *
 * `rule` is the orange bar beside the thesis and the indent it opens up — the
 * only thing the two variants still differ by, since every text size is 16px in
 * both. The share poster draws the same bar from POSTER.thesisRule in
 * lib/share.ts; the poster has no label line, so the two are close but not
 * identical.
 */
const SIZE = {
  hero: {
    thesis: "text-base",
    rule: "border-l-3 pl-4",
    label: "mb-1",
    heading: "text-base",
    para: "text-base",
  },
  card: {
    // Body copy is 16px here too. It was 14px, which reads as a caption next to
    // the 16px headings it sits under — and the summary IS the card, so the list
    // is where the size matters most. The thesis is 16px as well, and at NORMAL
    // weight: it used to be the same size AND the same semibold as the numbered
    // headings below it, so the lead and the section labels read as the same
    // kind of thing. The TL;DR label carries "this is the lead" now, so the
    // thesis only needs to sit a HALF step above the prose — `font-medium`, not
    // semibold — and semibold goes back to meaning one thing: heading. 500 is a
    // real face in both families (see the Google Fonts link in layout.tsx); ask
    // for a weight that is not loaded and the browser fakes it.
    thesis: "text-base",
    rule: "border-l-3 pl-3",
    label: "mb-1",
    heading: "text-base",
    para: "text-base",
  },
} as const;

/**
 * The summary: a one-sentence lead, then prose.
 *
 * LANGUAGE-BLIND, and that is the point: it takes ONE `SummaryText`, already
 * chosen. It used to take both halves plus the page's language and index by it,
 * which put the fallback rule — what an English page does when there is no
 * English half — inside a component whose job is typography. That rule now lives
 * in `summaryFor` (lib/take.ts), which every caller goes through, so there is one
 * answer to it instead of one per renderer.
 *
 * `leading-[1.85]` on the paragraphs is the one arbitrary number left in this
 * file, and it stays deliberately: the summaries were rewritten to be read
 * rather than skimmed, and Tailwind's nearest step down (`leading-relaxed`,
 * 1.625) takes back some of the air that change was for.
 *
 * The body arrives as ONE string and is split on blank lines — see
 * lib/paragraphs.ts. A numbered block is a section heading and is drawn heavier
 * and tight against the paragraph it introduces: the headings exist to let a
 * reader breathe and skip, and one styled like body copy does neither.
 */
export function Summary({
  summary,
  variant,
}: {
  summary: SummaryText;
  variant: "hero" | "card";
}) {
  const text = summary;
  const size = SIZE[variant];
  const blocks = blocksOf(text.text ?? "");
  /**
   * The block the opening indent goes on: the first one that is PROSE.
   *
   * Not simply block 0 — a summary can open on a `## heading`, which is a label
   * rather than the start of the writing. `posterPages` in lib/share.ts picks the
   * same block the same way, so the page and the poster indent the same sentence.
   */
  const opening = blocks.findIndex((block) => block.kind !== "heading");

  return (
    <div className="mt-4 flex flex-col gap-3">
      {/* The claim: the site's orange bar, a TL;DR label on it, and the
          sentence itself. No panel — a filled block reads as a second card
          inside the card, and every tint tried against `bg-card` either sat too
          close to it to look deliberate or too far to look clean.

          `mb-2` on top of the container's `gap-3`: the lead needs more air
          under it than one paragraph needs under another, or the prose reads as
          its continuation rather than as the writing starting. */}
      {text.thesis ? (
        <div className={`mb-2 border-orange ${size.rule}`}>
          <p
            className={`text-[11px] font-bold tracking-[0.08em] text-orange ${size.label}`}
          >
            TL;DR
          </p>
          <p className={`font-medium text-ink ${size.thesis}`}>{text.thesis}</p>
        </div>
      ) : null}

      {/* `data-para` indexes the blocks in the order the poster route draws
          them, so a text selection can be mapped back to what to highlight.

          `-mb-1` on a heading eats part of the `gap-3` below it: a heading
          belongs to the paragraph under it, not to the one above. */}
      {blocks.map((block, i) => (
        <p
          data-para={i}
          className={
            block.kind === "heading"
              ? `-mb-1 font-semibold text-ink ${size.heading}`
              : // The OPENING paragraph starts two characters in, and only it —
                // `i === opening`. The paragraphs here are already separated by
                // `gap-3`, so indenting each one marks the same break twice; what
                // a gap cannot say is where the prose begins.
                //
                // `2em`, not the `rem` a Tailwind `indent-8` would give, so it
                // stays two CHARACTERS at whichever size the variant sets. The
                // poster draws the same measure from POSTER.indent — change one,
                // change both.
                `${i === opening ? "indent-[2em]" : ""} leading-[1.85] font-medium text-ink-mid ${size.para}`
          }
          key={i}
        >
          {block.text}
        </p>
      ))}
    </div>
  );
}
