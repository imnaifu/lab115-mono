import type { ReactNode } from "react";
import { blocksOf } from "@/lib/paragraphs";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import type { SummaryText } from "@/lib/types";

/**
 * The hero-sized variant runs every block a step larger than a card does.
 * Nothing renders a hero card any more, but the single-article page uses the
 * larger size for the one summary it shows.
 *
 * `rule` IS GONE, and with it the orange bar that used to stand beside the
 * thesis. The thesis is a DEK now — a standfirst under the headline — and a dek
 * is set, not annotated: it says what it is by being one size up from the prose
 * and one shade lighter than the title. The bar plus the label was the other
 * arrangement, and what it produced was a page whose first move was to point at
 * its own machinery. The bar survives in two places that are not this one: the
 * share poster (lib/share, POSTER.thesisRule — there is no type hierarchy to
 * lean on inside a 1080px image) and 「为什么值得关注」 below, where a mark IS
 * the information because that block is a different voice.
 *
 * `label` is gone for the same reason — nothing here is labelled any more.
 */
const SIZE = {
  hero: {
    /**
     * 18px, ONE STEP ABOVE THE PROSE, and `text-ink-mid` rather than `text-ink`.
     *
     * The three values are doing the whole job the label used to do. Bigger than
     * the body says "read this first"; lighter than the 30px `text-ink` headline
     * above it says "this is not the headline"; and `leading-[1.7]` is looser
     * than the prose's own 1.85 by less than it looks, because a two-line dek
     * packed at the body's rhythm reads as the first paragraph rather than as the
     * standfirst.
     */
    thesis: "text-lg leading-[1.7]",
    heading: "text-base",
    para: "text-base",
  },
  card: {
    // Body copy is 16px here too. It was 14px, which reads as a caption next to
    // the 16px headings it sits under. Nothing renders this variant today — the
    // list rows draw their own dek, see ArticleCards — and it is kept so that
    // `variant` stays a real choice rather than a parameter with one value.
    thesis: "text-base leading-[1.65]",
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
  lang,
  lede,
}: {
  summary: SummaryText;
  variant: "hero" | "card";
  /**
   * Only the LEAD'S LABEL needs it — everything else this component draws is
   * the take's own prose, already in one language by the time it gets here. The
   * prop is required rather than optional so that a future caller cannot
   * silently get a Chinese label over an English take; this component stays
   * language-BLIND about the body, which is the property the note above is
   * about, and language-aware about the one word it prints.
   */
  lang: Lang;
  /**
   * SOMETHING TO DRAW BETWEEN THE DEK AND THE PROSE — the article page passes
   * its hero band here.
   *
   * A SLOT RATHER THAN THE PAGE RENDERING THE THREE PARTS ITSELF, because the
   * dek's typography belongs to this component (it is in the SIZE table beside
   * the prose it has to sit against) and the image's does not. The page tried
   * the other split first: draw the dek on the page, hand this component the
   * prose alone. That works until the dek and the prose disagree about size or
   * colour, which they would within a couple of edits, and the pair is the whole
   * reason `SIZE` exists.
   */
  lede?: ReactNode;
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
      {/**
       * THE DEK — the thesis, set as a standfirst under the headline.
       *
       * IT IS THE THESIS AND NOT 「为什么值得关注」, and the two swapped places
       * for one round before the archive settled it. The reasoning that moved
       * `whyItMatters` up here was that the thesis often restates the headline —
       * measured, 6 of 22 overlap it by more than half — and that is true and is
       * not the point. A dek answers WHAT HAPPENED, which is the question a
       * reader still has after the headline and before the prose; 「所以呢」 is
       * a question they do not have yet. Three sentences of rising abstraction
       * before the first fact — headline, then implication, then prose — reads
       * as dense and advances nothing. Claim, then evidence, then implication.
       * See the note on `leadOf`'s absence in lib/take.
       *
       * NO LABEL AND NO RULE. It had `TL;DR` on an orange bar, and both are
       * gone: a reader does not need the field's name, and the one line under a
       * headline is the most expensive line on the page to spend on the word
       * "TL;DR". The typography says what this is — see SIZE above.
       *
       * `max-w-prose` because a dek is read in one pass and a 40-em measure is
       * where that stops being comfortable; the prose below it is already inside
       * the card's own column.
       */}
      {text.thesis ? (
        <p className={`max-w-prose font-medium text-ink-mid ${size.thesis}`}>
          {text.thesis}
        </p>
      ) : null}

      {/* The hero band, when a caller has one. `-mx-*` is NOT applied here: the
          band runs to the page column's own gutter, not past it, so that the
          image's left edge lines up with the dek above and the prose below.
          See the `lede` prop. */}
      {lede ? <div className="mt-2 mb-2">{lede}</div> : null}

      {/* `data-para` indexes the blocks in the order the poster route draws
          them, so a text selection can be mapped back to what to highlight.

          `-mb-1` on a heading eats part of the `gap-3` below it: a heading
          belongs to the paragraph under it, not to the one above. */}
      {blocks.map((block, i) => (
        <p
          data-para={i}
          className={
            block.kind === "heading"
              ? `-mb-1 font-bold text-ink ${size.heading}`
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

      {/**
       * 「为什么值得关注」 — THE SECOND READING LAYER, and the only labelled
       * block left on the page.
       *
       * THE LABEL STAYS HERE while every other one went, and that asymmetry is
       * the decision rather than an oversight. A dek needs no name because it is
       * obviously the piece's own opening; this block is NOT the piece. It is
       * our judgement about it, and without a word saying so it reads as a third
       * paragraph of summary — which is exactly what it must not be mistaken for.
       * The label is what turns it from repetition into a different voice.
       *
       * LAST, UNDER THE PROSE, so the page runs claim → evidence → implication.
       * An implication offered before the evidence is a verdict.
       *
       * A QUIET WELL WITH A 2px RULE DOWN ITS LEFT EDGE. `bg-page` is one step
       * off the column's own ground, so the block reads as something cut into
       * the page rather than stuck onto it, and the rule is what makes it a
       * pull-quote rather than a panel. The orange is the site's accent and it
       * appears exactly twice on this page now — here and nowhere else, since
       * the dek gave its bar up. No accent FILL, no yellow, no icon: this is an
       * editorial publication, and a tip-box with a lightbulb in it is a
       * different product.
       *
       * NOTHING AT ALL WHEN THE FIELD IS EMPTY — no heading, no rule, no box.
       * An absent field is the whole signal (see `SummaryText.whyItMatters`), so
       * a take without one renders byte-identically to a take written before the
       * field existed. 347 of the 369 archived takes are in exactly that state.
       */}
      {summary.whyItMatters ? (
        <>
          {/**
           * `· · ·` — a section break, and the only ornament on the page.
           *
           * It is here because the block under it is a CHANGE OF VOICE, not the
           * next paragraph, and a gap alone does not say that: the prose above
           * is already separated by `gap-3`, so one more gap reads as one more
           * paragraph boundary. Three dots is the oldest mark in publishing for
           * "the piece pauses here", and it costs one line.
           *
           * `aria-hidden` and `select-none`: it is punctuation between sections.
           * Read aloud it is "middle dot middle dot middle dot", and copied with
           * the article it is debris.
           */}
          <div
            aria-hidden
            className="mt-3 mb-1 flex select-none justify-center gap-2 text-sm text-ink-soft"
          >
            <span>·</span>
            <span>·</span>
            <span>·</span>
          </div>
          <div className="rounded-xl border-l-2 border-orange bg-page px-4 py-3.5">
            <p className="text-[11px] font-bold tracking-[0.08em] text-ink-soft">
              {strings(lang).whyItMatters}
            </p>
            <p className={`mt-1.5 font-medium text-ink ${size.para}`}>
              {summary.whyItMatters}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
