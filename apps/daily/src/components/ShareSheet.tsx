"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND, BrandIcon, ShareIcon, type BrandKey } from "./BrandIcons";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

/**
 * How long a click will wait for the poster before giving up on it.
 *
 * Measured against the route it waits on: a cold poster is ~830ms (four font
 * subsets from Google, the cover refetched, Satori) and a warm one ~200ms, since
 * `share.png` is `force-dynamic` and only the font cache is kept. Two seconds
 * clears the cold case with room to spare, and is short enough that a reader
 * whose network is worse than that gets the sheet instead of a spinner.
 *
 * It also has to fit inside whatever iOS still counts as a user gesture, which
 * is the harder constraint and the unstated one — see `systemShare`.
 */
const POSTER_WAIT_MS = 2000;

/**
 * The poster as a `File`, or null for anything at all going wrong.
 *
 * Null rather than a throw because every caller's answer to a failure is the
 * same — share the link instead — and a sheet that opens with less in it beats
 * a button that does nothing.
 */
async function posterFile(href: string, name: string): Promise<File | null> {
  try {
    const response = await fetch(href);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new File([blob], name, { type: blob.type || "image/png" });
  } catch {
    return null;
  }
}

/**
 * The platforms in the sheet, and the reason the list is this short.
 *
 * An intent URL IS the whole integration, so a platform without one cannot go
 * here at any price. 微信 and 小红书 have none — WeChat composes only from inside
 * its own webview through a JS-SDK call signed by a verified official account,
 * and Xiaohongshu does not even offer that — so showing them would mean showing
 * a button that cannot do what its icon promises. They are reachable through the
 * OS tile below instead, on the devices that have it.
 *
 * `pic` is Weibo's alone and wants an absolute URL: it drops the poster into the
 * composer next to the link. X, WhatsApp and Telegram all build their preview
 * from og:image, which is that same poster, so none of them needs telling.
 */
function intents(page: string, poster: string, title: string, weibo: string) {
  const url = encodeURIComponent(page);
  const text = encodeURIComponent(title);
  // Both fields in one string, because these three put the whole message in
  // `text` rather than taking a link apart from it.
  const message = encodeURIComponent(`${title}\n${page}`);

  return [
    {
      brand: "weibo" as BrandKey,
      label: weibo,
      href:
        `https://service.weibo.com/share/share.php?url=${url}&title=${text}` +
        (/^https?:\/\//.test(poster) ? `&pic=${encodeURIComponent(poster)}` : ""),
    },
    {
      brand: "x" as BrandKey,
      label: "X",
      href: `https://x.com/intent/post?url=${url}&text=${text}`,
    },
    {
      brand: "whatsapp" as BrandKey,
      label: "WhatsApp",
      href: `https://wa.me/?text=${message}`,
    },
    {
      brand: "telegram" as BrandKey,
      label: "Telegram",
      href: `https://t.me/share/url?url=${url}&text=${text}`,
    },
  ];
}

/**
 * The actions under the tiles: same pill as the page's, one size down.
 *
 * They are pills rather than tiles because they are not destinations — nothing
 * here names an app. Copy, save and "more" all finish on this device, and the
 * divider above them says so.
 */
const ACTION =
  "flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs font-bold text-ink-mid";

/**
 * A tile: the mark in a wash of its own colour, the name under it.
 *
 * A FIXED-WIDTH FLEX ITEM THAT WRAPS, not a grid column, and the width is set by
 * the longest label rather than by the marks. "WhatsApp" is 61px at this size and
 * the marks are 44px, so the label is the constraint; five 68px tiles fit the card
 * at its full 24rem, and on a phone narrow enough that they do not — 92vw of a
 * 360px screen leaves room for four — the fifth drops to a second row.
 *
 * A `grid-cols-5` did break there, and silently: equal columns simply became
 * narrower than their contents, so the two long labels ran together and the row
 * read as four destinations and one long word. Shrinking the type is not the fix
 * either, because Chrome enforces a minimum font size (12px in some locales,
 * which is exactly where a 10px label lands) — the stylesheet asks and the browser
 * declines. Wrapping degrades instead of overlapping.
 */
const TILE =
  "flex w-17 cursor-pointer flex-col items-center gap-2 rounded-card py-3 text-center";
const TILE_MARK =
  "flex size-11 items-center justify-center rounded-full";
const TILE_LABEL = "text-[10px] font-bold text-ink-mid";

/**
 * The share sheet: one tile per destination, opened by the button on the page.
 *
 * A dialog rather than a dropdown, and the NATIVE one: `showModal` brings the
 * focus trap, the Escape key, the inert background and the top layer with it, all
 * of which a div would have to reimplement to be usable by keyboard.
 *
 * It is rendered whether or not it is open — `showModal()` is called from an
 * effect — so the dialog element is a stable node React never has to recreate.
 */
export function ShareSheet({
  open,
  onClose,
  page,
  poster,
  title,
  thesis,
  onCopy,
  copied,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  /** The permalink, already absolute: it is handed to another origin. */
  page: string;
  /** The poster route, absolute and WITHOUT a query. */
  poster: string;
  title: string;
  /** The summary's opening sentence — see `systemShare`. */
  thesis: string;
  /**
   * The clipboard write, and whether it just happened. Both come from the page
   * rather than being done here: `copied` is a two-second state that outlives the
   * sheet, so the page has to own it or closing the sheet would swallow the only
   * confirmation the reader gets.
   */
  onCopy: () => void;
  copied: boolean;
  lang: Lang;
}) {
  const t = strings(lang);
  const dialog = useRef<HTMLDialogElement>(null);

  /**
   * Whether this browser has a share sheet of its own, and whether it takes
   * files. Both read after mount: the server has no `navigator`, and a tile
   * present in the HTML and absent from the hydrated tree is a mismatch React
   * will complain about — correctly, since it would flicker.
   *
   * The file probe uses an empty `File` because `canShare` only looks at the
   * type; asking with the real poster would mean fetching 206KB to find out
   * whether it could ever be used.
   */
  const [canShare, setCanShare] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  /**
   * The poster fetch already in flight, so the click that follows a pointerdown
   * has something to await. One article, one poster — nothing varies per press
   * any more, so the first fetch is good for every later one.
   */
  const warmed = useRef<Promise<File | null> | null>(null);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
    setCanShareFiles(
      typeof navigator.canShare === "function" &&
        navigator.canShare({
          files: [new File([], "probe.png", { type: "image/png" })],
        }),
    );
  }, []);

  // The element's open state is imperative, so it is driven from the prop rather
  // than duplicated.
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  /**
   * Report every close back up, with a NATIVE listener rather than React's
   * `onClose`.
   *
   * The dialog can close without React being told: Escape and the close button
   * inside the top layer both go straight to the element. `close` does not
   * bubble, so it never reaches the delegated listener at the root, and the prop
   * silently does nothing — which left `open` stuck true, so the next press of
   * the page's button set it to true again, changed nothing, and the sheet never
   * came back. A dead button after one Escape.
   *
   * Firing on our own `node.close()` too is harmless: that only happens when
   * `open` is already false, and setting it false again is a no-op.
   */
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const sync = () => onClose();
    node.addEventListener("close", sync);
    return () => node.removeEventListener("close", sync);
  }, [onClose]);

  /**
   * Start fetching the poster on POINTERDOWN, before the click that shares it.
   *
   * The poster takes a round trip and a server-side render, and iOS only honours
   * `share()` while it still counts the gesture as live — so the fetch has to be
   * most of the way done before the handler starts awaiting it.
   */
  function warmPoster() {
    if (!canShareFiles || warmed.current) return;
    warmed.current = posterFile(poster, `${title.slice(0, 40)}.png`);
  }

  /**
   * The OS share sheet — the tile that reaches the apps with no web composer at
   * all, 微信 and 小红书 among them.
   *
   * `text` CARRIES THE WHOLE MESSAGE — headline, thesis, link — rather than
   * leaving any of it to be fetched.
   *
   * Both halves of that were learned the hard way. iOS hands the sheet a string
   * and a URL as separate items, so an app whose share extension accepts text but
   * not URLs — 小红书 is one — receives the string alone; with `text: title` it got
   * the headline and nothing to tap. And once the poster was attached, `url` had
   * to go (see below), which silently took the SUMMARY with it: WeChat was never
   * reading `text`, it was building a link card and pulling og:description off the
   * page, so dropping the URL dropped the only sentence describing the article.
   *
   * Putting the thesis in `text` fixes both at once, and stops depending on the
   * receiving app to go and fetch anything. It also means a target that truncates
   * — 小红书 caps a note title at 20 characters — cuts a heading that is repeated
   * in full at the top of the body.
   *
   * The POSTER goes too, when the browser takes files and `warmPoster` got one in
   * time. 小红书 cannot publish a note without an image at all, so for that target
   * the file is the difference between a share that can be posted and one that
   * cannot.
   *
   * Both fallbacks are one-way on purpose: a late file, or an iOS that has
   * decided the gesture is stale, leaves the reader with the link-only sheet
   * rather than an error. `save image` on the page is the path that cannot fail.
   */
  async function systemShare() {
    // Blank lines between the three parts: a composer that pastes this whole
    // string is writing a post, and a headline running into its own summary is
    // the reader's problem to untangle.
    const text = `${title}\n\n${thesis}\n\n${page}`;

    const file = warmed.current
      ? await Promise.race([
          warmed.current,
          // Not `AbortSignal.timeout` on the fetch: a slow poster is still worth
          // having for the NEXT click, so it is left running and merely stopped
          // being waited on.
          new Promise<null>((resolve) => setTimeout(resolve, POSTER_WAIT_MS, null)),
        ])
      : null;

    if (file) {
      try {
        // No `url` beside `files`: Safari has been unreliable with both at once,
        // and `text` already carries the link for anything that reads it.
        await navigator.share({ title, text, files: [file] });
        onClose();
        return;
      } catch (error) {
        // Dismissing the sheet is not a failure to retry — reopening it on the
        // reader who just closed it would be the actual bug.
        if ((error as Error).name === "AbortError") return;
      }
    }

    try {
      await navigator.share({ title, text, url: page });
      onClose();
    } catch {
      // AbortError again, or the gesture expired while the poster was awaited.
      // Neither is worth reporting: the buttons on the page still work.
    }
  }

  return (
    <dialog
      ref={dialog}
      /**
       * The backdrop is the dialog's own box, so a click that lands on the
       * element itself — rather than on the card inside it — is a click outside.
       */
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      aria-label={t.shareTo}
      /**
       * 24rem, up from 22rem, and the padding inside is a step down — both to fit
       * five tiles in one row.
       *
       * The label is what needs the width, not the mark: "WhatsApp" set at the
       * row's type size is 61px, and five columns of that plus gaps is what the
       * card has to clear. Shrinking the type instead is not an option that
       * works — Chrome enforces a minimum font size (12px by default in some
       * locales, which is where this row's 10px lands), so a smaller number in
       * the stylesheet buys nothing on the browsers that most need the room.
       */
      className="m-auto w-[min(92vw,24rem)] rounded-card border border-line bg-paper p-0 shadow-soft backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-sm font-bold text-ink">{t.shareTo}</div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-xs font-bold text-ink-soft"
          >
            {t.close}
          </button>
        </div>

        {/* One row of destinations, and the OS handover is FIRST among them rather
            than a footnote under them. It belongs at this level: on a phone it is
            the only route to 微信 and 小红书, so treating it as the fallback for the
            four named ones had it backwards — for most readers it is the one that
            reaches the app they actually use. */}
        <div className="flex flex-wrap gap-x-0.5 gap-y-1">
          {canShare ? (
            <button type="button" onPointerDown={warmPoster} onClick={systemShare} className={TILE}>
              {/* Ink rather than a brand colour, in the same 12% wash as the
                  marks beside it: this tile has no brand, and inventing one for
                  it would make it look like a fifth platform. */}
              <span
                className={TILE_MARK}
                style={{ color: "#3b3563", background: "#3b35631f" }}
              >
                <ShareIcon size={20} />
              </span>
              <span className={TILE_LABEL}>{t.moreApps}</span>
            </button>
          ) : null}

          {intents(page, poster, title, t.weibo).map((intent) => (
            <a
              key={intent.label}
              href={intent.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className={TILE}
            >
              <span
                className={TILE_MARK}
                /* The brand's own colour, and a wash of it behind the mark. `1f`
                   is that hex at 12% — enough to seat the icon on the cream
                   without competing with it. */
                style={{
                  color: BRAND[intent.brand].color,
                  background: `${BRAND[intent.brand].color}1f`,
                }}
              >
                <BrandIcon brand={intent.brand} />
              </span>
              <span className={TILE_LABEL}>{intent.label}</span>
            </a>
          ))}
        </div>

        {/* Everything that finishes on this device, below a rule that separates
            it from the named destinations above. */}
        <div className="border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={ACTION} onClick={onCopy}>
              {copied ? t.copied : t.copyLink}
            </button>

            {/* A plain download link, so a long press on a phone offers "save
                image" the way it would for any picture. */}
            <a
              href={poster}
              download={`${title.slice(0, 40)}.png`}
              className={ACTION}
            >
              {t.saveImage}
            </a>

          </div>
        </div>
      </div>
    </dialog>
  );
}
