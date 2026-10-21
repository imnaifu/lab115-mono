/**
 * The shapes that cross the server/client boundary.
 *
 * Kept apart from `data/templates.ts` on purpose: that file is `server-only`
 * because it holds the story text, and a client component importing even a type
 * from it would be one refactor away from importing a value too.
 */

/** One fill-in question. `label` must not hint at where the word lands. */
export type Blank = {
  key: string;
  label: string;
  /** A few ready answers — the placeholder shows the first, the dice picks any. */
  examples: string[];
};

/** Everything the player may see before the reveal. No story text. */
export type Theme = {
  id: string;
  title: string;
  teaser: string;
  blanks: Blank[];
};

/** The story split at every filled word, so the client can highlight them. */
export type Segment = { text: string; filled: boolean };

export type RevealResult =
  | { ok: true; segments: Segment[] }
  | { ok: false; error: string };

/** Longest answer accepted. A blank is a word or a short phrase, not a paragraph. */
export const MAX_ANSWER_LENGTH = 20;
