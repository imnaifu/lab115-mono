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

/** A tile: the mark in a wash of its own colour, the name under it. */
const TILE =
  "flex cursor-pointer flex-col items-center gap-2 rounded-card px-1 py-3 text-center";
const TILE_MARK =
  "flex size-11 items-center justify-center rounded-full";
const TILE_LABEL = "text-[11px] font-bold text-ink-mid";

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
  hl,
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
  /** The `?hl=…` frozen when the sheet opened, or "" — see ArticleShare. */
  hl: string;
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
   * The poster fetch already in flight, keyed by the highlight it was started
   * for: the sheet outlives one opening, so a reader who closes it, marks a
   * different sentence and opens it again must not be handed the first image.
   */
  const warmed = useRef<{ hl: string; file: Promise<File | null> } | null>(null);

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
    if (!canShareFiles) return;
    // Same marks as the fetch already running: keep it rather than start again.
    if (warmed.current?.hl === hl) return;
    warmed.current = {
      hl,
      file: posterFile(`${poster}${hl}`, `${title.slice(0, 40)}.png`),
    };
  }

  /**
   * The OS share sheet — the tile that reaches the apps with no web composer at
   * all, 微信 and 小红书 among them.
   *
   * THE LINK GOES IN `text`, not only in `url`. iOS hands the sheet a string and
   * a URL as separate items, and an app whose share extension accepts text but
   * not URLs — 小红书 is one — receives the string alone. With `text: title` that
   * app got the headline and nothing else: no link, nothing to tap. `url` is
   * still sent, because the apps that do read it build a proper link card from it
   * (WeChat), and the cost of saying it twice is that a few apps that concatenate
   * both show the URL twice.
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
    const text = `${title}\n${page}`;

    const file = warmed.current
      ? await Promise.race([
          warmed.current.file,
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
      className="m-auto w-[min(92vw,22rem)] rounded-card border border-line bg-paper p-0 shadow-soft backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
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

        {/* Four across on purpose: it is exactly the platform count, so the row
            reads as a complete set rather than a wrapped list. */}
        <div className="grid grid-cols-4 gap-1">
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
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={ACTION} onClick={onCopy}>
              {copied ? t.copied : t.copyLink}
            </button>

            {/**
             * A plain download link, so a long press on a phone offers "save
             * image" the way it would for any picture.
             *
             * The highlight is the one FROZEN when the sheet opened, which is why
             * this can be a static href: on the page this same link had to rewrite
             * its own href on pointerdown, because pressing it was what cleared the
             * selection it needed to read. Inside the sheet that race is already
             * over.
             */}
            <a
              href={`${poster}${hl}`}
              download={`${title.slice(0, 40)}.png`}
              className={ACTION}
            >
              {t.saveImage}
            </a>

            {/* Last, and only where it exists: the one action whose destination is
                unknown until the OS asks. On a phone it is also the only route to
                微信 and 小红书, which have no web composer to link to. */}
            {canShare ? (
              <button
                type="button"
                onPointerDown={warmPoster}
                onClick={systemShare}
                className={ACTION}
              >
                <ShareIcon size={14} />
                {t.moreApps}
              </button>
            ) : null}
          </div>

          {/* Said once, under the row, rather than as a subtitle on the button:
              the poster travelling with the share is the part nobody would guess,
              and it is the reason "more" is worth pressing over "save image". */}
          {canShare ? (
            <div className="text-[11px] font-medium text-ink-soft">
              {t.moreAppsHint}
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
