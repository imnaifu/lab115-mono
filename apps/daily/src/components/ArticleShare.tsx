"use client";

import { useEffect, useState } from "react";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

/** The same pill the list's action row uses, so the two read as one control set. */
const PILL =
  "cursor-pointer rounded-full border border-line bg-paper px-4 py-2 text-sm font-bold text-ink-mid";

/**
 * The platform row: secondary to the two actions above it, so smaller and
 * quieter, but still a pill so the whole block reads as one control set.
 */
const PILL_SMALL =
  "rounded-full border border-line px-3.5 py-1.5 text-xs font-bold text-ink-soft";

/**
 * The platforms that accept a shared link as a plain URL.
 *
 * Three, and the shortness of the list is the finding rather than a shortcut: an
 * intent URL IS the whole integration, so a platform without one cannot be added
 * here at any price. 微信, 小红书 and Instagram have none — WeChat composes only
 * from inside its own webview, through a JS-SDK call signed by a verified
 * official account — which is why the poster download beside these is not the
 * lesser path for them but the only one.
 *
 * `pic` is Weibo's alone and wants an absolute URL: it drops the poster into the
 * composer next to the link, the closest any of the three comes to what the
 * download does by hand. X and Telegram both build their preview from og:image,
 * which is that same poster, so neither needs telling.
 */
function intents(page: string, poster: string, title: string, weibo: string) {
  const url = encodeURIComponent(page);
  const text = encodeURIComponent(title);
  return [
    { label: "X", href: `https://x.com/intent/post?url=${url}&text=${text}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${url}&text=${text}` },
    {
      label: weibo,
      // `pic` is dropped unless the poster URL has already been absolutised —
      // before hydration it has not, and a relative one means nothing to Weibo.
      href:
        `https://service.weibo.com/share/share.php?url=${url}&title=${text}` +
        (/^https?:\/\//.test(poster) ? `&pic=${encodeURIComponent(poster)}` : ""),
    },
  ];
}

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
 * The share block: hand the link to the OS share sheet, copy it, save the poster —
 * with whatever the reader has marked in the summary above — or open one platform's
 * composer directly.
 *
 * Two rows, because the controls are not peers. The top row acts on THIS device:
 * the sheet, the clipboard, the file. The bottom row leaves for a named platform,
 * which is a smaller and more specific thing to want.
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
  /**
   * Whether to offer the OS share sheet at all. Read after mount rather than
   * during render: the server has no `navigator`, and a button present in the
   * HTML and absent from the hydrated tree is a mismatch React will complain
   * about — correctly, since it would flicker.
   */
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setLinks({
      page: new URL(url, location.href).href,
      poster: new URL(imageUrl, location.href).href,
    });
  }, [url, imageUrl]);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

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

  /**
   * The OS share sheet: on a phone the shortest route to any app at all, and the
   * only route to 微信 and 小红书 that is not a manual screenshot.
   *
   * It shares the LINK, not the poster, and that is deliberate. `navigator.share`
   * does take files, but the poster would have to be fetched first and it is
   * rendered on demand — fonts subsetted per article, cover refetched — so a cold
   * one takes seconds, and iOS withdraws the user activation that `share()`
   * requires while a fetch that long is in flight. A sheet that fails half the
   * time is worse than one that passes a link whose og:image is that same poster;
   * the reader who wants the file itself has the button next to this one.
   */
  async function systemShare() {
    try {
      await navigator.share({ title, text: title, url: links.page });
    } catch {
      // Dismissing the sheet throws AbortError, so a rejection here is the
      // ordinary outcome as often as it is a failure. Neither is worth a report.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* First when it exists, because on the device that has it it is the
            fastest thing in the row — and it is absent on every desktop browser
            but Safari, where the two buttons after it are the whole story. */}
        {canShare ? (
          <button type="button" className={PILL} onClick={systemShare}>
            {t.shareVia}
          </button>
        ) : null}

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

      {/* A row of plain links — no JS, no SDK, nothing to fail. Each opens that
          platform's own composer with the permalink and the headline in it. */}
      <div className="flex flex-wrap items-center gap-2">
        {intents(links.page, links.poster, title, t.weibo).map((intent) => (
          <a
            key={intent.label}
            href={intent.href}
            target="_blank"
            rel="noopener noreferrer"
            className={PILL_SMALL}
          >
            {intent.label}
          </a>
        ))}
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
