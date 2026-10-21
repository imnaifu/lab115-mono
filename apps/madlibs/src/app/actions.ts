"use server";

import { revealStory } from "@/lib/game";
import type { RevealResult } from "@/lib/types";

/**
 * The one server round trip in the game. The story text lives only on the
 * server, so filling it has to happen here; see lib/game.ts.
 */
export async function reveal(themeId: string, answers: Record<string, string>): Promise<RevealResult> {
  return revealStory(themeId, answers ?? {});
}
