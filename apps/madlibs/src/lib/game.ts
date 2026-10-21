import "server-only";
import { TEMPLATES, type Template } from "@/data/templates";
import { MAX_ANSWER_LENGTH, type RevealResult, type Segment, type Theme } from "@/lib/types";

/**
 * The game, as plain functions with no web framework in them.
 *
 * They line up with the MCP tool draft in README.md — `listThemes`/`startGame`
 * are `start_game`, `revealStory` is `submit_answers` + `reveal_story` in one
 * step — so a ChatGPT app can wrap these later instead of re-implementing them.
 *
 * STATELESS: there is no game id and nothing is stored. The client holds the
 * template id and the answers, and sends both at reveal time. The story stays
 * secret all the same, because only this module can read it.
 */

/** The public half of a template — what the player may see before the reveal. */
function toTheme(template: Template): Theme {
  return {
    id: template.id,
    title: template.title,
    teaser: template.teaser,
    blanks: template.blanks,
  };
}

export function listThemes(): Theme[] {
  return TEMPLATES.map(toTheme);
}

export function startGame(themeId: string): Theme | null {
  const template = TEMPLATES.find((candidate) => candidate.id === themeId);
  return template ? toTheme(template) : null;
}

/**
 * Validates the answers and fills the story.
 *
 * `answers` is untrusted input from a server action, so it is checked against
 * the template's own blanks: unknown keys are ignored, missing or overlong ones
 * reject the whole reveal.
 */
export function revealStory(themeId: string, answers: Record<string, unknown>): RevealResult {
  const template = TEMPLATES.find((candidate) => candidate.id === themeId);
  if (!template) return { ok: false, error: "这个故事不存在了，换一个试试。" };

  const filled: Record<string, string> = {};
  for (const blank of template.blanks) {
    const raw = answers[blank.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return { ok: false, error: `「${blank.label}」还没填。` };
    // Array.from counts characters, not UTF-16 units, so an emoji counts as one.
    if (Array.from(value).length > MAX_ANSWER_LENGTH) {
      return { ok: false, error: `「${blank.label}」最多 ${MAX_ANSWER_LENGTH} 个字。` };
    }
    filled[blank.key] = value;
  }

  return { ok: true, segments: fillStory(template.story, filled) };
}

/** Splits the story at each `{key}` and marks the substituted parts. */
function fillStory(story: string, filled: Record<string, string>): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of story.matchAll(/\{(\w+)\}/g)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ text: story.slice(cursor, start), filled: false });
    // A placeholder with no matching blank is a template typo; leave it visible
    // rather than silently dropping part of a sentence.
    const word = filled[match[1]];
    segments.push(word === undefined ? { text: match[0], filled: false } : { text: word, filled: true });
    cursor = start + match[0].length;
  }
  if (cursor < story.length) segments.push({ text: story.slice(cursor), filled: false });
  return segments;
}
