"use client";

import { useEffect, useState } from "react";
import { ShareSheet } from "./ShareSheet";
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
 * The share block: ONE button, and the sheet it opens.
 *
 * Every destination lives in the sheet — the platforms, the clipboard, the file,
 * the OS handover. It was split across both surfaces for a while, pills on the
 * page and platforms in the sheet, and the split had no rule behind it: "copy
 * link" and "save image" are the same kind of thing as the sheet's own fallbacks,
 * so a reader deciding where to press had to check two places to find out they
 * were the same place.
 *
 * What stays here is the sentence under the button, because it has to be read
 * BEFORE the button: the highlight comes from a text selection, and the press is
 * what ends it.
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
  /**
   * Absolute forms of both props, for the places a relative URL is not merely
   * inconvenient but wrong: an intent link hands the URL to ANOTHER origin, and
   * `navigator.share` rejects a relative one outright.
   *
   * Seeded with the props so the first paint has real hrefs — the article page
   * passes an absolute permalink already — and resolved against the document
   * after mount, which is the earliest `location` exists. Nothing here can run
   * on the server, so nothing tries.
   */
  const [links, setLinks] = useState({ page: url, poster: imageUrl });
  /** Whether the sheet is up. It renders either way — see ShareSheet. */
  const [sheetOpen, setSheetOpen] = useState(false);
  /**
   * The highlight the sheet will use, FROZEN when it opens.
   *
   * It has to be frozen, and this is the only place that can do it: pressing the
   * button is itself what clears the selection, so by the time the sheet renders
   * there is nothing left to read. Captured on pointerdown, which runs before the
   * clearing — the same trick, and the same reason, as the download link below.
   */
  const [sheetHl, setSheetHl] = useState("");

  useEffect(() => {
    setLinks({
      page: new URL(url, location.href).href,
      poster: new URL(imageUrl, location.href).href,
    });
  }, [url, imageUrl]);

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
    <div className="flex flex-col items-start gap-2">
      {/* Always here, unlike the version that called `navigator.share` directly:
          that one vanished on any browser without a share sheet — every desktop
          browser but Safari, and any http origin, since Web Share needs a secure
          context. A button that is sometimes absent is indistinguishable from a
          feature that was never built. */}
      <button
        type="button"
        className={PILL}
        onPointerDown={() => setSheetHl(highlightQuery(selectedRuns()))}
        onClick={() => setSheetOpen(true)}
      >
        {t.shareVia}
      </button>

      {/* Tells the reader the affordance exists — a highlight nobody knows about
          is a highlight nobody uses — and then confirms it once they have made
          one, because the poster is not visible until after it downloads. */}
      <div className="text-xs font-medium text-ink-soft">
        {marked.chars ? t.highlighted(marked.chars) : t.highlightHint}
      </div>

      <ShareSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        page={links.page}
        poster={links.poster}
        title={title}
        hl={sheetHl}
        onCopy={copy}
        copied={copied}
        lang={lang}
      />
    </div>
  );
}
