"use client";

import { useEffect, useState } from "react";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

/** The same pill the list's action row uses, so the two read as one control set. */
const PILL =
  "cursor-pointer rounded-full border border-line bg-paper px-4 py-2 text-sm font-bold text-ink-mid";

interface Marked {
  /** `<paragraph>.<start>-<end>` per run, in the order they appear. */
  runs: string[];
  /** How many characters they cover, for the line that reports it. */
  chars: number;
}

const NOTHING: Marked = { runs: [], chars: 0 };

/**
 * The exact characters the reader has selected, as `<paragraph>.<start>-<end>`.
 *
 * Character offsets, not whole paragraphs: the poster marks the run itself, so
 * selecting half a sentence marks half a sentence.
 *
 * Each paragraph is rendered from a plain string, so it holds exactly ONE text
 * node and the selection's own offsets are already the character offsets wanted.
 * A selection spanning several paragraphs gives its real bounds on the first and
 * last and covers the ones between whole — which is what the two fallbacks below
 * compute: the container only matches for the paragraph an endpoint lands in.
 *
 * Scoped to the document, which is exact here: the article page renders one
 * summary, so every `[data-para]` on it belongs to this article.
 */
function selectedRuns(): Marked {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    return NOTHING;
  }
  const range = selection.getRangeAt(0);

  const runs: string[] = [];
  let chars = 0;
  for (const element of document.querySelectorAll<HTMLElement>("[data-para]")) {
    // PARTIAL containment counts, so a run inside one paragraph is found.
    if (!selection.containsNode(element, true)) continue;

    const index = Number(element.dataset.para);
    const text = element.firstChild;
    if (!Number.isInteger(index) || !text || text.nodeType !== Node.TEXT_NODE) {
      continue;
    }

    const length = text.textContent?.length ?? 0;
    const start = range.startContainer === text ? range.startOffset : 0;
    const end = range.endContainer === text ? range.endOffset : length;
    if (end <= start) continue;

    runs.push(`${index}.${start}-${end}`);
    chars += end - start;
  }
  return { runs, chars };
}

/** `?hl=1.12-40` for a set of marked runs, or "" for none. */
function highlightQuery(marked: Marked): string {
  return marked.runs.length ? `?hl=${marked.runs.join(",")}` : "";
}

/**
 * The share row: copy the link, or save the poster — with whatever the reader has
 * marked in the summary above.
 *
 * Highlighting lives here rather than on the list because this is the page the
 * 分享 button leads to: the reader arrives, selects the passage worth passing on,
 * and saves an image with it washed in. Nothing carries a selection across the
 * navigation, so nothing has to.
 */
export function ArticleShare({
  url,
  imageUrl,
  title,
  lang,
}: {
  /**
   * The permalink, absolute or root-relative. Relative is resolved against the
   * current page at click time, so a caller never has to import SITE from
   * lib/config — that module also holds DEEPSEEK_API_KEY and GIT_TOKEN, and a
   * client component importing it drags the whole thing into the browser bundle.
   */
  url: string;
  /** The poster route WITHOUT a query; the highlight is appended here. */
  imageUrl: string;
  /** Only for the downloaded file's name — the buttons are labelled from i18n. */
  title: string;
  lang: Lang;
}) {
  const t = strings(lang);
  const [copied, setCopied] = useState(false);
  const [marked, setMarked] = useState<Marked>(NOTHING);

  // Tracked live so the line below can say what will happen BEFORE the reader
  // commits to a click. One listener on a page holding one article.
  useEffect(() => {
    const sync = () => setMarked(selectedRuns());
    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, []);

  async function copy() {
    try {
      // Absolute in, absolute out; relative in, absolute against this page. A
      // relative link on the clipboard would be useless to whoever receives it.
      await navigator.clipboard.writeText(new URL(url, location.href).href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard needs a secure context; on http the button simply does
      // nothing rather than throwing into the console.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={PILL} onClick={copy}>
          {copied ? t.copied : t.copyLink}
        </button>

        {/* A plain download link, so long-press on a phone offers "save image"
            the way it would for any picture. */}
        <a
          href={`${imageUrl}${highlightQuery(marked)}`}
          download={`${title.slice(0, 40)}.png`}
          className={PILL}
          /**
           * The href is rewritten from the DOM on POINTER DOWN as well as from
           * state, and the redundancy is the point: pressing the link is itself
           * what clears the selection, so a `selectionchange` fires and React may
           * re-render with an empty set before the click's default action reads
           * the attribute. The handler runs BEFORE that clearing, so what it
           * writes is what the browser downloads.
           */
          onPointerDown={(event) => {
            event.currentTarget.setAttribute(
              "href",
              `${imageUrl}${highlightQuery(selectedRuns())}`,
            );
          }}
        >
          {t.saveImage}
        </a>
      </div>

      {/* Tells the reader the affordance exists — a highlight nobody knows about
          is a highlight nobody uses — and then confirms it once they have made
          one, because the poster is not visible until after it downloads. */}
      <div className="text-xs font-medium text-ink-soft">
        {marked.chars ? t.highlighted(marked.chars) : t.highlightHint}
      </div>
    </div>
  );
}
