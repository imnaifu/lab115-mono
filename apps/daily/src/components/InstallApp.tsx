"use client";

import { useEffect, useRef, useState } from "react";
import { strings } from "@/lib/i18n";
import { guideKey, installGuide, type GuideKey } from "@/lib/install";
import type { Lang } from "@/lib/lang";
import { track } from "@/lib/track";

/**
 * Chrome's install offer, which is not in lib.dom.
 *
 * The event is fired at the window when the browser has decided the page is
 * installable — manifest present, service worker handling `fetch`, served over
 * https — and it is the ONLY way to open the native install dialog: there is no
 * method to call, so an event that was not caught is an install that cannot be
 * offered.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * The mark on the button: a rounded square with a plus in it.
 *
 * DELIBERATELY iOS's OWN "Add to Home Screen" GLYPH rather than a download
 * arrow, which is what this wanted to be at first. A tray-and-arrow says "a file
 * is about to land in your downloads folder", which is the wrong promise; the
 * square with the plus is the icon the reader is about to create.
 */
function AddIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 flex-none"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="2" y="2" width="12" height="12" rx="3.5" />
      <path d="M8 5.2v5.6M5.2 8h5.6" />
    </svg>
  );
}

/**
 * "Save as app": the masthead's install control, and the sheet of instructions
 * it opens.
 *
 * TWO DIFFERENT THINGS BEHIND ONE BUTTON, because the platforms genuinely differ:
 *
 *   - Chrome and Edge fire `beforeinstallprompt`, so there is a real one-tap
 *     install to offer and anything else would be busywork.
 *   - Safari — on both iOS and macOS — fires nothing and exposes no API at all.
 *     Installing is a menu item the reader has to find, so the only thing this
 *     can do is say which menu and what the item is called.
 *
 * The sheet handles both: the native button when there is one, the steps
 * underneath it either way. The steps stay even when the button is there because
 * the offer can be declined once and then not re-offered for a while, and a
 * reader who taps again deserves a route that still works.
 *
 * IT DISAPPEARS ONCE INSTALLED, and that is CSS rather than JavaScript — see the
 * `display-mode` variant on the button. A probe in an effect would render the
 * button, hydrate, and then remove it, which is a control that flickers in and
 * out on the most-used surface on the page.
 */
export function InstallApp({ lang }: { lang: Lang }) {
  const t = strings(lang);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  /**
   * Which steps to show. `unknown` until mount on purpose: the user agent is a
   * browser fact, and picking a platform on the server would mean either reading
   * the request's UA header — which puts a per-device value into a document this
   * app caches and shares — or rendering one platform's steps and swapping them
   * during hydration. The dialog's contents are not in the first paint anyway.
   */
  const [key, setKey] = useState<GuideKey>("unknown");
  /** The caught offer, and whether there is one. A ref for the call, state for
   *  the render — the button cannot appear until React knows about it. */
  const offer = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  /**
   * Whether the app got installed while this tab was open.
   *
   * The `display-mode` media query cannot cover this case: it becomes true in the
   * INSTALLED window, while the tab the reader pressed the button in is still an
   * ordinary tab and would go on advertising an install that has happened.
   */
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setKey(guideKey(navigator.userAgent, navigator.maxTouchPoints));

    /**
     * ALREADY RUNNING AS AN INSTALLED APP? Then there is nothing to offer.
     *
     * The button also carries `[@media(display-mode:standalone)]:hidden`, and the
     * two are not redundant — they cover different moments and different browsers.
     * The CSS applies before this component has hydrated, so on a cold start of the
     * installed app there is no frame in which an install button is painted. This
     * check is what makes the answer RIGHT rather than merely early.
     *
     * `navigator.standalone` is the iOS half and it is the reason this exists at
     * all. Safari shipped `display-mode` media queries late, so on older iOS a
     * page added to the home screen does NOT match the CSS above and would go on
     * advertising an install that already happened — on the platform where the
     * manual add-to-home-screen flow is the only route and the button is therefore
     * most prominent. It is non-standard and absent from lib.dom, hence the cast.
     *
     * Not watched for changes: `display-mode` cannot change within a document's
     * lifetime — a window is standalone or it is a tab — and the one transition
     * that matters, installing from this very tab, is what `appinstalled` below is
     * for.
     */
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    const catchOffer = (event: Event) => {
      /**
       * `preventDefault` stops Chrome's own mini-infobar so that this button is
       * the only place the offer appears. The event is then kept: it stays usable
       * until it is consumed, and `prompt()` may only be called from a real user
       * gesture, which is why it is stashed rather than acted on here.
       */
      event.preventDefault();
      offer.current = event as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };

    const done = () => {
      setInstalled(true);
      offer.current = null;
    };

    /**
     * The listener attaches at hydration, and the event may already have fired by
     * then — it is not replayed for a late listener. THAT IS ACCEPTABLE AND NOT
     * WORTH AN INLINE SCRIPT IN THE DOCUMENT HEAD to catch it earlier: missing it
     * costs the one-tap button and nothing else, because the manual steps for
     * Chrome and Edge (the address-bar icon, the ⋮ menu) are real routes that work
     * regardless. A script tag in every page's head to shave one tap off one
     * browser's install is the wrong trade for a site whose whole point is
     * arriving fast.
     */
    window.addEventListener("beforeinstallprompt", catchOffer);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", catchOffer);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  // The element's open state is imperative, so it is driven from the prop rather
  // than duplicated — same as ShareSheet next door.
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  /**
   * Every close reported back up, with a NATIVE listener: Escape and the backdrop
   * close the element without React hearing about it, and `close` does not bubble,
   * so `open` would stay stuck true and the next press would be a no-op. The
   * same bug, and the same fix, as in ShareSheet.
   */
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const sync = () => setOpen(false);
    node.addEventListener("close", sync);
    return () => node.removeEventListener("close", sync);
  }, []);

  async function install() {
    const event = offer.current;
    if (!event) return;
    // Consumed: the event is good for one call, so the button goes with it rather
    // than staying there to do nothing on a second press.
    offer.current = null;
    setCanPrompt(false);
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      track("install_prompt", { outcome, platform: key });
      if (outcome === "accepted") setOpen(false);
    } catch {
      // A rejected `prompt()` means the browser declined to show the dialog — an
      // offer already consumed elsewhere, or a gesture it did not count. The steps
      // are still on screen, which is the whole fallback.
      track("install_prompt", { outcome: "failed", platform: key });
    }
  }

  if (installed) return null;

  const guide = installGuide(key, lang);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          track("install_open", { platform: key, can_prompt: canPrompt });
        }}
        /**
         * THE LABEL SHOWS AT EVERY SIZE, and it took a layout change to afford it.
         *
         * It used to be `hidden sm:inline`, and the arithmetic was real: the
         * masthead row held the domain chip (~154px at `text-xs` with that
         * tracking) and the language switch (~92px), so on a 393px screen with
         * `px-4` of gutter — 361px — two `gap-3`s left about 99px, and "存成 App"
         * with its mark needs ~96px. Three pixels is not a margin worth shipping,
         * so the control shrank to a bare glyph on exactly the devices where
         * installing is the point.
         *
         * The fix was not to squeeze the text but to stop sharing the line: the
         * install button sits UNDER the language switch now (see Masthead in
         * Shell.tsx), where the only width it competes for is its own. The glyph
         * stays — it is iOS's own add-to-home-screen square and it reads faster
         * than the words do — but it no longer has to carry the meaning alone.
         *
         * `aria-label` stays too, and is not redundant: it keeps the accessible
         * name stable and stops it being read as the glyph plus the text.
         */
        aria-label={t.saveApp}
        /* Hidden once installed, in CSS: an installed app showing an install
           button is the same page telling the reader to do what they did. The
           `appinstalled` listener above covers the tab it was pressed in, which
           this query cannot see. */
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-2 text-xs font-bold text-ink-mid [@media(display-mode:standalone)]:hidden"
      >
        <AddIcon />
        <span>{t.saveApp}</span>
      </button>

      <dialog
        ref={dialog}
        /* The backdrop is the dialog's own box, so a click that lands on the
           element rather than on the card inside it is a click outside. */
        onClick={(event) => {
          if (event.target === dialog.current) setOpen(false);
        }}
        aria-label={t.saveAppTitle}
        /* The same box as the share sheet: this is the site's second modal and
           two modals of different widths on one page read as an accident. */
        className="m-auto max-h-[90vh] w-[min(92vw,24rem)] overflow-y-auto rounded-card border border-line bg-paper p-0 shadow-soft backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-sm font-bold text-ink">{t.saveAppTitle}</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-none cursor-pointer text-xs font-bold text-ink-soft"
            >
              {t.close}
            </button>
          </div>

          {/* The one-tap install, when the browser gave us one. Full width and
              ink-on-cream: it is the only thing in here that finishes the job by
              itself, so it should not look like a peer of the steps below it. */}
          {canPrompt ? (
            <button
              type="button"
              onClick={install}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-paper"
            >
              <AddIcon />
              {t.installNow}
            </button>
          ) : null}

          {guide.unsupported ? (
            /* No steps at all: this browser cannot do it, and the honest answer is
               a sentence rather than a list that ends in a menu item that is not
               there. */
            <p className="text-sm leading-relaxed font-medium text-ink-mid">
              {guide.unsupported}
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {/* "Or add it by hand" only when there IS a button above to be an
                  alternative to. */}
              {canPrompt ? (
                <div className="text-xs font-bold text-ink-soft">
                  {t.installManual}
                </div>
              ) : null}

              {/* Which platform these steps are for, said out loud — a reader who
                  has been handed the wrong ones can see that immediately, which
                  matters because the detection behind them is user-agent
                  sniffing and can be wrong. */}
              <div className="text-xs font-bold text-ink-soft">
                {guide.title}
              </div>

              {/* A real `<ol>`: these are ordered and a screen reader should say
                  so. The numbers are drawn as counters in their own circles
                  rather than left to the list marker, which cannot be styled
                  into a badge and would sit outside the padding box. */}
              <ol className="flex list-none flex-col gap-2.5">
                {guide.steps.map((step, i) => (
                  <li
                    key={step}
                    className="flex items-start gap-2.5 text-sm leading-relaxed font-medium text-ink"
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full bg-cream-deep text-[11px] font-bold text-ink-mid"
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">{step}</span>
                  </li>
                ))}
              </ol>

              {guide.note ? (
                <p className="text-xs leading-relaxed font-medium text-ink-soft">
                  {guide.note}
                </p>
              ) : null}
            </div>
          )}

          {/* What installing actually buys, on the far side of a hairline: it is
              the reason to bother, not part of the procedure. */}
          <p className="border-t border-line pt-3 text-xs leading-relaxed font-medium text-ink-soft">
            {t.installWhy}
          </p>
        </div>
      </dialog>
    </>
  );
}
