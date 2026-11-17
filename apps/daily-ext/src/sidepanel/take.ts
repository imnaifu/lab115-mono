/**
 * Pull the two things a card shows out of one entry's `<content>` markup: the
 * one-sentence take and the source's name.
 *
 * The markup comes from `contentHtml` in apps/daily/src/lib/feed.ts and has a
 * fixed shape: the thesis as the first `<p>`, then body `<p>`s and `<h3>`
 * section headings, then a last `<p>` holding `<a href=original>看原文 →</a> —
 * Source name`. The body is not shown in the panel — a card links to the
 * article's page on the site, where the full summary lives.
 *
 * NOTHING HERE IS EVER INSERTED AS HTML. The markup is parsed in an inert
 * document (DOMParser runs no scripts and loads nothing) and only `textContent`
 * leaves this function, so the panel renders plain text nodes through React.
 */

export interface Take {
  thesis: string;
  sourceName: string;
}

export function parseTake(html: string): Take {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const elements = [...doc.body.querySelectorAll(":scope > p, :scope > h3")];

  // The footer is the last paragraph that contains the outbound link.
  let sourceName = "";
  const last = elements[elements.length - 1];
  const link = last?.tagName === "P" ? last.querySelector("a") : null;
  if (last && link) {
    // Everything after the link is ` — Source name`.
    sourceName = (last.textContent ?? "")
      .slice((link.textContent ?? "").length)
      .replace(/^\s*[—-]\s*/, "")
      .trim();
    elements.pop();
  }

  // The thesis is the first paragraph — unless the take opens with a heading,
  // in which case there is no thesis to show and the card goes without one.
  const first = elements[0];
  const thesis = first?.tagName === "P" ? (first.textContent ?? "").trim() : "";
  return { thesis, sourceName };
}
