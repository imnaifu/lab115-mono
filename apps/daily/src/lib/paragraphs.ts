/**
 * How `SummaryText.text` becomes blocks on screen.
 *
 * One place, imported by every renderer — the page, the share poster and its
 * height arithmetic. The poster's height is computed from the same split the
 * poster draws, so two different notions of "where the breaks are" would show up
 * as a clipped or a padded image rather than as an error.
 *
 * A BLANK LINE IS THE BREAK. A single newline is not: the model wraps lines
 * inside a thought often enough that treating one as a break chopped sentences
 * apart, so it is folded to a space instead. Runs of three or more newlines
 * collapse to one break, because "extra air" is not a thing this format has.
 */

/** The kind decides the styling; the text is what gets drawn. */
export interface Block {
  kind: "heading" | "body";
  text: string;
}

/**
 * A MARKDOWN ATX HEADING — `## 子标题` — and it is the ONE piece of markdown the
 * body may contain. The model declares a heading; this does not guess at one.
 *
 * IT REPLACED A HEURISTIC, and the heuristic is why. Headings used to be
 * detected by a leading `1.` `2.` — the only marker plain text offers — and on
 * the run of 2026-08-20 that read a translated listicle as 21 consecutive
 * headings: the article was 21 etiquette rules, the model rendered each as its
 * own numbered block, and all 21 came out bold. Those blocks ran 49–144
 * characters where a real heading in this digest runs 12–17, so a length gate
 * would also have separated them — but only by measuring the writing against a
 * number, which is the same class of guess. `##` is a declaration, so a
 * numbered line is now just a numbered line.
 *
 * Any level 1–6 is accepted and they all render identically: there is one
 * heading style here, and rejecting `###` would only turn a heading the model
 * meant into body copy. The marker is stripped — every renderer draws
 * `block.text`, so the `#` characters must never reach a canvas — and the space
 * after it is optional, because `##标题` is how it often arrives in Chinese.
 */
const HEADING = /^#{1,6}[ \t]*(?=\S)/;

/** Blocks in the order they were written, with their kinds. */
export function blocksOf(text: string): Block[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .map((paragraph) =>
      HEADING.test(paragraph)
        ? { kind: "heading" as const, text: paragraph.replace(HEADING, "") }
        : { kind: "body" as const, text: paragraph },
    );
}

/** Just the drawable strings, for anything that does not care about kind —
 *  reading time, the font subsetter, the poster's line count. Markers are
 *  already stripped, so these are exactly what a reader sees. */
export function paragraphsOf(text: string): string[] {
  return blocksOf(text).map((block) => block.text);
}
