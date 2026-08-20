"use client";

import { useEffect, useState } from "react";
import { ShareSheet } from "./ShareSheet";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

/**
 * The card's share control: the pill, and the sheet it opens.
 *
 * It lives on the LIST, one per card, which is where a reader decides to pass
 * something on — they have just read the summary, and the thing they want is the
 * sheet, not another page. It used to be a plain link to the article page, and
 * the whole share block lived down there; that cost a navigation to reach the
 * one action the pill was named after.
 *
 * WHAT GETS SHARED IS STILL THE ARTICLE PAGE. Sharing from the list does not mean
 * sharing the list: `url` is the permalink for this one article, so a link opens
 * on the piece it came from and the poster is that piece's poster.
 */
export function ShareButton({
  url,
  imageUrl,
  title,
  thesis,
  lang,
}: {
  /**
   * This article's permalink, absolute or root-relative. Relative is resolved
   * against the current page after mount, so a caller never has to import SITE
   * from lib/config — that module also holds DEEPSEEK_API_KEY and GIT_TOKEN, and
   * a client component importing it drags the whole thing into the browser
   * bundle.
   */
  url: string;
  /** The poster route for this article. */
  imageUrl: string;
  title: string;
  /** The summary's opening sentence — see ShareSheet's `systemShare`. */
  thesis: string;
  lang: Lang;
}) {
  const t = strings(lang);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  /**
   * Absolute forms of both props, for the places a relative URL is not merely
   * inconvenient but wrong: an intent link hands the URL to ANOTHER origin, and
   * `navigator.share` rejects a relative one outright.
   *
   * Seeded with the props so the first paint has real hrefs, then resolved
   * against the document after mount, which is the earliest `location` exists.
   */
  const [links, setLinks] = useState({ page: url, poster: imageUrl });

  useEffect(() => {
    setLinks({
      page: new URL(url, location.href).href,
      poster: new URL(imageUrl, location.href).href,
    });
  }, [url, imageUrl]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(url, location.href).href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard needs a secure context; on http the button simply does
      // nothing rather than throwing into the console.
    }
  }

  return (
    <>
      {/* Primary, and rightmost in the card's action row: passing a piece on is
          the action worth making obvious. */}
      <button
        type="button"
        className="cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper"
        onClick={() => setOpen(true)}
      >
        {t.share}
      </button>

      <ShareSheet
        open={open}
        onClose={() => setOpen(false)}
        page={links.page}
        poster={links.poster}
        title={title}
        thesis={thesis}
        onCopy={copy}
        copied={copied}
        lang={lang}
      />
    </>
  );
}
