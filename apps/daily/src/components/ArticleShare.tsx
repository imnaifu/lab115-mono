"use client";

import { useState } from "react";

/**
 * The share row on a single-article page.
 *
 * Three affordances, because "share" means three different things depending on
 * where you are: the OS sheet on a phone, a copied link on a desktop, and the
 * poster when the destination is somewhere that shows pictures rather than
 * link previews (a group chat, a timeline).
 *
 * `navigator.share` is progressive: it does not exist on most desktop browsers,
 * so the button is only rendered once the client has confirmed it. Rendering it
 * unconditionally would put a dead button on every desktop.
 */
export function ArticleShare({
  url,
  imageUrl,
  title,
}: {
  url: string;
  imageUrl: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // A ref callback rather than useEffect: it runs on mount, and the only thing
  // being asked is whether an API exists.
  //
  // `"share" in navigator` rather than `navigator.share &&` — the DOM lib types
  // it as always present, so the truthiness check is a compile error, and it is
  // absent on most desktop browsers at runtime.
  const detect = (node: HTMLDivElement | null) => {
    if (node && typeof navigator !== "undefined" && "share" in navigator) {
      setCanShare(true);
    }
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard needs a secure context; on http the button simply does
      // nothing rather than throwing into the console.
    }
  }

  return (
    <div ref={detect} className="flex flex-wrap items-center gap-2.5">
      {canShare ? (
        <button
          type="button"
          className="cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper"
          onClick={() => navigator.share({ title, url }).catch(() => {})}
        >
          分享
        </button>
      ) : null}

      <button
        type="button"
        className="cursor-pointer rounded-full border border-line bg-paper px-4 py-2 text-sm font-bold text-ink-mid"
        onClick={copy}
      >
        {copied ? "已复制链接" : "复制链接"}
      </button>

      {/* A plain download link, so long-press on a phone offers "save image"
          the way it would for any picture. */}
      <a
        href={imageUrl}
        download={`${title.slice(0, 40)}.png`}
        className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-bold text-ink-mid"
      >
        保存图片
      </a>
    </div>
  );
}
