"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND, BrandIcon, ShareIcon, type BrandKey } from "./BrandIcons";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import { posterPartUrl } from "@/lib/links";
import { track } from "@/lib/track";

/**
 * The images a share carries, in the order the reader should SEE them: the
 * identity card, then one page of prose after another.
 *
 * NOT A CONSTANT ANY MORE — the count is per article, because the prose is
 * paginated onto a fixed 1080x1440 canvas and a long summary needs more pages
 * than a short one. It arrives as the `parts` prop, computed server-side by
 * `posterParts`; see the note there for why the sheet cannot count for itself.
 *
 * 小红书 and WeChat both publish a SET of images, which is what makes this worth
 * doing at all.
 */
function displayOrder(parts: number): number[] {
  return Array.from({ length: parts }, (_, i) => i + 1);
}

/**
 * The order the set is handed to `navigator.share`. THE SAME as display order —
 * and it exists as its own function because it briefly was not.
 *
 * The history is worth keeping because it is the trap: an early two-image share
 * came back from a target with the prose first and the card second, so this
 * returned the list reversed to compensate. With four images it was still wrong,
 * and reversing a reversal cannot be — which means the target was never reversing
 * anything and the compensation was the whole of the bug. The likeliest reading of
 * the original observation is that it came from a different app; WeChat and 小红书
 * implement their share extensions separately and nothing says they agree.
 *
 * SO: DO NOT ADD A REVERSE HERE ON ONE OBSERVATION. If a target ever really does
 * reorder, the way to find out is the page counter drawn on every image — `1/4`,
 * `2/4` — which says what each image is regardless of where it landed. Read the
 * counters in the app, then change this one line, and note WHICH app it was for:
 * a single global order cannot satisfy two targets that disagree.
 */
function shareOrder(parts: number): number[] {
  return displayOrder(parts);
}

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
 *
 * IT DID NOT GO UP WHEN THE SHARE WENT TO TWO IMAGES, on purpose. Two posters is
 * two server renders, which would not fit here — so what changed instead is WHEN
 * the fetch starts: `warm` now runs the moment the sheet opens rather than on the
 * pointerdown of the share tile, and the two run concurrently. By the time
 * anything is awaited the reader has had a second or more to look at the preview,
 * so this budget is covering the tail, not the whole round trip.
 */
const POSTER_WAIT_MS = 2000;

/**
 * Milliseconds between the clicks that save a set of images.
 *
 * Not a guess at politeness: fired back to back, Chrome treats the burst as one
 * event and keeps only the first download. Spaced out, each click is its own. 400
 * is comfortably past where that starts working and still finishes a four-image
 * share inside a second and a half. See `saveAll`.
 */
const SAVE_GAP_MS = 400;

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
 * the longest label rather than by the marks: "WhatsApp" is 61px at this size and
 * the marks are 44px.
 *
 * 64px is that 61 plus the smallest margin worth having, and the 3px matters — at
 * 68px the row wrapped on a 393px phone, which is most of them. Five 64px tiles
 * with no gap need 320px, and 92vw of a 390px screen leaves 329px inside the card.
 * Below roughly a 380px screen they no longer fit and the fifth drops to a second
 * row, which is the point of laying this out as a wrapping row: it degrades
 * instead of overlapping.
 *
 * A `grid-cols-5` did overlap, and silently — equal columns just became narrower
 * than their contents, so the two long labels ran together and the row read as
 * four destinations and one long word. Shrinking the type is not the fix either,
 * because Chrome enforces a minimum font size (12px in some locales, which is
 * exactly where a 10px label lands): the stylesheet asks and the browser declines.
 */
const TILE =
  "flex w-16 cursor-pointer flex-col items-center gap-2 rounded-card py-3 text-center";
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
  parts,
  title,
  thesis,
  tags,
  onCopy,
  copied,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  /** The permalink, already absolute: it is handed to another origin. */
  page: string;
  /** The poster base, absolute and WITHOUT a part or an extension. Each image is
   *  this plus `/<part>.png`; see `posterPartUrl`. */
  poster: string;
  /**
   * How many images this article's share carries — the identity card plus one per
   * page of prose.
   *
   * Passed in rather than derived, because deriving it needs the summary text and
   * `posterPages`' whole layout table, and this is a client component. See
   * `posterParts` in lib/share.ts.
   */
  parts: number;
  title: string;
  /** The summary's opening sentence — see `systemShare`. */
  thesis: string;
  /** This take's hashtags, WITHOUT their `#` — see `systemShare`. */
  tags: string[];
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
  const shown = displayOrder(parts);
  /**
   * Whether `saveAll` is walking the list. TWO OF THEM, and they are not
   * redundant.
   *
   * The REF is the guard. A second click has to be rejected synchronously, and
   * state cannot do that: `setSaving(true)` does not change the `saving` the
   * running handler closed over, so a double click inside one render passed the
   * check and started every download twice — which is the surest way to trip the
   * very blocker the gap between clicks exists to avoid. Measured: the button read
   * `disabled === false` immediately after its own click.
   *
   * The STATE is the appearance. `disabled` has to come from something React
   * renders, and a ref does not trigger a render.
   */
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  /**
   * Whether this browser has a share sheet of its own, and whether it takes
   * files. Both read after mount: the server has no `navigator`, and a tile
   * present in the HTML and absent from the hydrated tree is a mismatch React
   * will complain about — correctly, since it would flicker.
   *
   * The file probe uses an empty `File` on purpose: `canShare` only looks at the
   * TYPE, so asking with the real poster would mean fetching 210KB to learn
   * nothing more. Measured — on desktop Chrome it returns true for the real file,
   * the empty one, and every combination of fields, and the share still arrives
   * without an image.
   *
   * So this is a floor, not a promise: false means the browser has no file support
   * at all and there is no point fetching a poster, true means it might work.
   * `systemShare` is where that uncertainty is absorbed.
   */
  const [canShare, setCanShare] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  /**
   * Whether the poster has been asked for yet, latched on the first open.
   *
   * The dialog is in the tree from the start and a list page holds one per card,
   * so an unconditional `<img src={poster}>` would fetch sixteen ~210KB posters on
   * page load for a reader who shares nothing. Latched rather than tied to `open`
   * so closing and reopening does not fetch it again.
   */
  const [asked, setAsked] = useState(false);
  /**
   * Each preview's load attempts: 0 is the first, 1 the retry, 2 means it failed.
   *
   * The poster is generated per request and arrives over whatever connection the
   * phone has, so a load can fail transiently — a dropped chunk leaves the broken
   * image glyph sitting where the picture should be, and long-pressing it works
   * because that re-requests the URL. One retry turns that into a picture; a
   * second failure means the image is not coming and the sheet should stop
   * pretending, which is what `previewFailed` below is for.
   *
   * ONE COUNTER PER PART, not one for the pair. The two are separate requests and
   * fail separately, and a shared counter would reload the good image every time
   * the other one stumbled — a visible flash on the picture that was already
   * there. Indexed by position in display order.
   */
  const [attempts, setAttempts] = useState<number[]>(() =>
    displayOrder(parts).map(() => 0),
  );
  const failed = attempts.map((n) => n > 1);
  /** Both gone. The sheet's fallbacks key off this — see the download below. */
  const previewFailed = failed.every(Boolean);
  /**
   * Whether this is a touch screen, which SPLITS THE TWO WAYS TO SAVE THE POSTER:
   * a long press on the preview here, a download link there, never both. Each is
   * useless on the other's platform — see the hint and the download below.
   *
   * `pointer: coarse` rather than a user-agent test: the gesture is a property of
   * the input device, not of the OS name.
   */
  const [touch, setTouch] = useState(false);
  /**
   * Both poster fetches already in flight, so the click has something to await.
   * One article, one pair of posters — nothing varies per press, so the first
   * fetch is good for every later one.
   *
   * Resolves to the files that ARRIVED, in part order, so a `null` from one leg
   * does not take the other down with it.
   */
  const warmed = useRef<Promise<Array<File | null>> | null>(null);

  /**
   * Start fetching both posters, and do it FROM THE OPEN EFFECT below rather than
   * from the share tile's pointerdown.
   *
   * Two renders cannot be started inside a live gesture and still land inside
   * POSTER_WAIT_MS — a cold poster is most of a second on its own. Opening the
   * sheet is the earliest honest signal that a share is coming, and the preview
   * is fetching these same URLs at that moment anyway, so the pair costs two
   * renders whether or not this ref exists. `canShareFiles` still gates it: a
   * browser that cannot carry a file has no reason to hold two Files in memory.
   */
  function warm() {
    if (!canShareFiles || warmed.current) return;
    // Through `shareOrder` rather than `shown` directly — see the note there. The
    // two agree today; the seam is what makes a future disagreement one line.
    warmed.current = Promise.all(
      shareOrder(parts).map((part) =>
        posterFile(
          posterPartUrl(poster, part),
          `${title.slice(0, 40)}-${part}.png`,
        ),
      ),
    );
  }

  /**
   * `canShareFiles` is a dependency, not just `open`: it is set by the probe in
   * the effect below, and `warm` returns early while it is still false. Without it
   * a sheet that opened before the probe landed would never warm anything and
   * every share would fall through to link-only. `warm` is idempotent — it latches
   * on `warmed.current` — so running it twice costs nothing.
   */
  useEffect(() => {
    if (!open) return;
    setAsked(true);
    warm();
  }, [open, canShareFiles]);

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    setCanShare(typeof navigator.share === "function");
    setCanShareFiles(
      typeof navigator.canShare === "function" &&
        navigator.canShare({
          // As many empty files as the share will send. `canShare` only validates
          // types, so this cannot tell us the platform will carry a set — but an
          // implementation that caps the COUNT would say no here, and a four-image
          // article is exactly where that would bite. Worth asking before holding
          // four Files in memory.
          files: shown.map(
            (part) => new File([], `probe-${part}.png`, { type: "image/png" }),
          ),
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
   * THE TWO POSTERS go too, when the browser takes files and `warm` got them in
   * time. 小红书 cannot publish a note without an image at all, so for that target
   * the files are the difference between a share that can be posted and one that
   * cannot — and a note is a SET of images there, which is why there are two.
   *
   * Whatever arrived is sent, one or both: a pair is what the layout is designed
   * for, but part 1 alone is still a complete card — cover, headline, thesis — so
   * a failed part 2 should not demote the share to a bare link.
   *
   * `url` NOW TRAVELS WITH THE FILE, which it briefly did not, on a guess that
   * Safari was unreliable with both at once. That guess was wrong in the one
   * direction that mattered: Safari is the browser where files work. Chrome is the
   * one where they do not — `navigator.canShare({files})` returns true for a real
   * 213KB PNG on desktop Chrome, and then the share arrives with no image, because
   * `canShare` only validates the TYPE and says nothing about whether the platform
   * will actually carry a file. There is no predicate for that, so the fix is not
   * to detect it: send the link alongside, and a target that dropped the file can
   * still unfurl og:image — which is that same poster. The cost is that an app
   * taking both shows the image and a link card for it; that beats an image that
   * silently never arrives.
   *
   * Both fallbacks are one-way on purpose: a late file, or an iOS that has
   * decided the gesture is stale, leaves the reader with the link-only sheet
   * rather than an error.
   */
  async function systemShare() {
    // Blank lines between the parts: a composer that pastes this whole string
    // is writing a post, and a headline running into its own summary is the
    // reader's problem to untangle.
    //
    // THE HASHTAGS GO LAST, on their own line, and the `#` is added here rather
    // than stored — see `tags` in lib/types.ts. Last because that is where a
    // 小红书 note carries them and because it is the one position where a target
    // that does not understand them leaves the rest of the message readable.
    // Absent when the take has none, and then the trailing blank line goes too:
    // an empty tag line is a composer opening with the cursor two rows below
    // the text.
    const note = tags.length ? `\n\n${tags.map((tag) => `#${tag}`).join(" ")}` : "";
    const text = `${title}\n\n${thesis}\n\n${page}${note}`;

    const ready = warmed.current
      ? await Promise.race([
          warmed.current,
          // Not `AbortSignal.timeout` on the fetch: a slow poster is still worth
          // having for the NEXT click, so it is left running and merely stopped
          // being waited on.
          new Promise<null>((resolve) => setTimeout(resolve, POSTER_WAIT_MS, null)),
        ])
      : null;
    // Already in send order — `warm` fetched them that way — so this only drops
    // whichever leg failed. Never re-sort here: the order is decided once, in
    // `shareOrder`, and a second opinion about it in this function is how the two
    // would drift apart.
    const files = (ready ?? []).filter((file): file is File => file !== null);

    /**
     * WHAT THE HANDOVER ACTUALLY DID, which nothing here could previously tell.
     *
     * The whole uncertainty this function is built around — `canShare` returns
     * true for a file the platform then silently drops — is invisible from the
     * inside, and it stays invisible: no API reports it. What CAN be counted is
     * everything around it, and together those bound the problem. `files` says
     * how many posters were in hand when the sheet opened; `waited` says whether
     * the fetch was still running when the reader pressed (the case where a
     * share degrades to link-only through no fault of the platform).
     */
    const shape = { files: files.length, parts, waited: ready === null };

    if (files.length) {
      try {
        await navigator.share({ title, text, url: page, files });
        track("share_result", { ...shape, outcome: "with_files" });
        onClose();
        return;
      } catch (error) {
        // Dismissing the sheet is not a failure to retry — reopening it on the
        // reader who just closed it would be the actual bug.
        if ((error as Error).name === "AbortError") {
          track("share_result", { ...shape, outcome: "aborted" });
          return;
        }
        // Anything else and the link-only attempt below is a real fallback
        // rather than the first try, which is worth telling apart.
        track("share_result", { ...shape, outcome: "files_rejected" });
      }
    }

    try {
      await navigator.share({ title, text, url: page });
      track("share_result", { ...shape, outcome: "link_only" });
      onClose();
    } catch {
      // AbortError again, or the gesture expired while the poster was awaited.
      // Neither is worth reporting: the buttons on the page still work.
      track("share_result", { ...shape, outcome: "failed" });
    }
  }

  /**
   * Save every image, from one click, DESKTOP ONLY.
   *
   * One synthetic `<a download>` per part, clicked in turn. There is no browser
   * API for "save these four files", and the two alternatives were worse: a
   * numbered link per image is what this replaces — five pills over two rows
   * under a thumbnail strip that had just been compacted to fit — and a server
   * side archive hands back a container the reader then has to open.
   *
   * THE BROWSER WILL INTERRUPT THIS, and that is expected rather than a bug.
   * Chrome treats a second programmatic download from one gesture as something to
   * ask about: it shows a "download multiple files" prompt, and once the reader
   * allows it for the origin every later share saves silently. Firefox allows it;
   * Safari is the least predictable. What matters is that the failure mode is a
   * VISIBLE prompt rather than files that quietly never arrive.
   *
   * The gap between clicks is what makes them all land. Fired in a tight loop,
   * Chrome coalesces the burst and drops most of it; a few hundred milliseconds
   * apart, each is its own download. The anchor has to be in the document before
   * it is clicked — Firefox ignores a click on a detached one.
   */
  async function saveAll() {
    // The ref, not the state — see the note on both.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      for (const [at, part] of shown.entries()) {
        if (failed[at]) continue;
        const link = document.createElement("a");
        link.href = posterPartUrl(poster, part);
        link.download = `${title.slice(0, 40)}-${part}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        if (at < shown.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, SAVE_GAP_MS));
        }
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
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
      className="m-auto max-h-[90vh] w-[min(92vw,24rem)] overflow-y-auto rounded-card border border-line bg-paper p-0 shadow-soft backdrop:bg-black/40"
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

        {/**
         * The poster itself, and the reason it is a real `<img>`.
         *
         * A LONG PRESS ON AN IMAGE IS THE ONLY WAY INTO THE PHOTO LIBRARY on iOS.
         * "Save image" below is an `<a download>`, and a same-origin download on
         * iOS Safari lands in Files → Downloads, not in Photos; long-pressing that
         * link offers the link menu — open, copy, share — because it is a link, not
         * a picture. Rendering the bytes gives the platform's own "Save to Photos",
         * and it costs nothing extra: `warmPoster` was fetching this URL anyway,
         * and the route now caches for an hour so the two share one response.
         *
         * It doubles as the preview this sheet never had. The poster is generated
         * server-side and was, until now, sent unseen.
         *
         * `object-contain` inside a capped height, so what the reader sees is the
         * whole poster rather than a crop of its top — the point of a preview is
         * that it is not a different picture from the one that gets sent. The
         * saved file is the full-resolution source either way; CSS sizing does not
         * reach it.
         */}
        {asked && !previewFailed ? (
          <div className="flex flex-col gap-2">
            {/**
             * EVERY image, in display order, as a ROW OF THUMBNAILS.
             *
             * They were stacked full-width at 30vh each, which was fine for one
             * and impossible for four: a share is three to five images now, and
             * four of them plus the destination tiles and the action pills ran
             * well past the dialog's 90vh, so the reader had to scroll to reach
             * the button they opened the sheet for.
             *
             * A thumbnail this size cannot be read, and that is the trade being
             * made deliberately. What a preview owes the reader here is the SHAPE
             * of what is about to leave the device — how many images, in what
             * order, roughly what they look like — not a legible copy of it. The
             * full-resolution file is what gets shared and what a long press saves
             * either way; CSS sizing does not reach it.
             *
             * FOUR TO A ROW, wrapping — not a scroller. Four is what the dialog's
             * width holds at a readable-enough size, and it is also what most
             * shares have, so the common case is exactly one row.
             *
             * `flex-wrap` with a computed basis rather than `grid-cols-4`, because
             * a grid's four tracks are always four tracks: three thumbnails would
             * sit left-aligned with a visible hole where the fourth would be, and
             * three is the most common count of all. Wrapping items plus
             * `justify-center` centre whatever there are, and a fifth drops to a
             * second row centred under them.
             *
             * The basis is the row minus its three gaps, quartered — `gap-2` is
             * 0.5rem, so that is 1.5rem of gap to take out. Only the WIDTH is set:
             * height follows from the poster's own 3:4, so nothing is stretched and
             * a change to the canvas ratio needs no change here.
             *
             * A part that failed twice is dropped and its neighbours stay: each is
             * a separate request, and hiding a good image because the one after it
             * never arrived would throw away the half that works.
             */}
            <div className="flex flex-wrap justify-center gap-2">
              {shown.map((part, i) =>
                failed[i] ? null : (
                  <img
                    key={part}
                    /**
                     * `?retry=1` on the second attempt, because without it the
                     * reload would be served the same failed entry out of the
                     * HTTP cache. The route ignores the parameter entirely; it
                     * exists only to miss that cache.
                     *
                     * `?` AND NOT `&`, which is what it used to be. The part was a
                     * query parameter then, so a `?` was already guaranteed to be
                     * in the URL and appending with `&` was correct. The part is a
                     * path segment now — see `posterPartUrl` — so this is the
                     * first parameter on the URL and has to open the query itself.
                     */
                    src={
                      attempts[i] === 0
                        ? posterPartUrl(poster, part)
                        : `${posterPartUrl(poster, part)}?retry=${attempts[i]}`
                    }
                    alt={title}
                    className="w-[calc((100%-1.5rem)/4)] flex-none rounded-[10px] shadow-soft"
                    onError={() => {
                      /**
                       * Reported on the SECOND failure only — the first is
                       * retried and usually succeeds, so counting it would turn
                       * an ordinary dropped chunk into an alarm.
                       *
                       * Read off `attempts` before the update rather than inside
                       * it: a state updater has to stay pure, and firing a
                       * beacon from one would send it twice under StrictMode.
                       */
                      if (attempts[i] >= 1) {
                        track("poster_failed", { part, parts });
                      }
                      setAttempts((was) =>
                        was.map((n, at) => (at === i ? n + 1 : n)),
                      );
                    }}
                  />
                ),
              )}
            </div>
            {/* Said only where the gesture exists, and said at all because a
                long press is invisible: nothing about an image announces that
                holding it will file it away. */}
            {touch ? (
              <div className="text-center text-[11px] font-medium text-ink-soft">
                {t.pressToSave}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* One row of destinations, and the OS handover is FIRST among them rather
            than a footnote under them. It belongs at this level: on a phone it is
            the only route to 微信 and 小红书, so treating it as the fallback for the
            four named ones had it backwards — for most readers it is the one that
            reaches the app they actually use. */}
        <div className="flex flex-wrap gap-y-1">
          {/* No `onPointerDown` warmer on this button any more: two posters cannot
              be started inside the gesture, so `warm` runs when the sheet opens. */}
          {canShare ? (
            <button
              type="button"
              onClick={() => {
                track("share_target", { target: "system" });
                systemShare();
              }}
              className={TILE}
            >
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
              onClick={() => {
                track("share_target", { target: intent.brand });
                onClose();
              }}
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

            {/**
             * A download, DESKTOP ONLY — and the two halves of that pair with the
             * long-press hint above, which is touch only. One route to a saved
             * image per platform, and each platform gets the one that works.
             *
             * On a phone this button was the wrong answer offered next to the right
             * one. A download is not the photo library: this is an anchor, so a long
             * press on it gets the link menu — open, copy, share — and the download
             * itself lands in Files → Downloads on iOS, or Downloads on Android.
             * Someone looking for their picture would take the button that says
             * "save image" over an unlabelled gesture on the image, and end up with
             * a PNG filed where they will not look for it.
             *
             * It stays on the desktop because there it is the only path at all: no
             * OS share sheet worth the name, and no long press.
             *
             * And it comes BACK on a phone when the preview failed to load, because
             * the long press it was hidden in favour of needs an image to press.
             * Exactly one route to a saved file, always — never both, never none.
             *
             * ONE CONTROL, whatever the share holds.
             *
             * It was one numbered link per image — "保存图片 1", "保存图片 2" … —
             * which worked and read as clutter: four parts meant five pills over
             * two rows, directly under a thumbnail strip that had just been
             * compacted to fit one.
             *
             * A SET IS A BUTTON, a single image is still a link. The distinction is
             * not cosmetic: one file needs no script, and an anchor is the element
             * that means "this saves a file" — middle-click, copy-link and the
             * context menu all keep working. Only the many-file case needs the loop
             * in `saveAll`, and only because no browser offers anything better.
             */}
            {touch && !previewFailed ? null : parts > 1 ? (
              <button
                type="button"
                onClick={() => {
                  // `shape` tells the two controls apart: a set is a scripted
                  // loop the browser can interrupt, a single image is an anchor
                  // that cannot fail. They are not the same act.
                  track("save_image", { parts, shape: "set" });
                  saveAll();
                }}
                disabled={saving}
                className={`${ACTION} disabled:opacity-50`}
              >
                {t.saveAll}
              </button>
            ) : (
              <a
                href={posterPartUrl(poster, 1)}
                download={`${title.slice(0, 40)}.png`}
                className={ACTION}
                onClick={() => track("save_image", { parts, shape: "single" })}
              >
                {t.saveImage}
              </a>
            )}

          </div>
        </div>
      </div>
    </dialog>
  );
}
