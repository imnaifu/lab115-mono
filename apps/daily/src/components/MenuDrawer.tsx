"use client";

import { useEffect, useRef, useState } from "react";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

/**
 * THE PHONE'S NAVIGATION — a hamburger and the sheet it opens.
 *
 * WHY IT EXISTS. The bar's four destinations (今天 / 话题 / 归档 / 关于) are all
 * `sm:` and up, because the row cannot hold four words plus five controls at
 * 393px — the width budget in SiteHeader has the arithmetic. Below that they
 * were simply absent: a phone reader could reach a topic only by opening an
 * article first, and could not reach the archive or this page at all. That was
 * the same shape of hole the subscribe form had before `variant="inline"`.
 *
 * A `<dialog>` LIKE THE OTHER THREE SHEETS on this site (subscribe, install,
 * share), which is not a coincidence worth repeating three times: `showModal()`
 * gives the focus trap, the inert background, Escape and the backdrop for free,
 * and every one of those is a thing a hand-rolled drawer gets wrong.
 *
 * IT TAKES ITS ITEMS AS PROPS rather than building them. Which destinations
 * exist, what they are called and where they point are decisions the BAR makes —
 * it is a server component that knows the language and the current path — and a
 * drawer that assembled its own list would be a second place for the nav to be
 * defined. This file owns the sheet and nothing else.
 */
export function MenuDrawer({
  lang,
  items,
}: {
  lang: Lang;
  /** In the order they should read. `current` draws the same marker the bar's
   *  own row uses, so the two navigations agree about where the reader is. */
  items: { href: string; label: string; current: boolean }[];
}) {
  const t = strings(lang);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // The element's open state is imperative, so it is driven from the state
  // rather than duplicated — same as SubscribeDialog, InstallApp and ShareSheet.
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  /**
   * Every close reported back up, with a NATIVE listener: Escape and the
   * backdrop close the element without React hearing about it, and `close` does
   * not bubble, so `open` would stay stuck true and the next press would be a
   * no-op. The same bug, and the same fix, as in the other three sheets.
   */
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const sync = () => setOpen(false);
    node.addEventListener("close", sync);
    return () => node.removeEventListener("close", sync);
  }, []);

  return (
    <>
      {/* `sm:hidden` — the exact complement of the bar's own `hidden sm:block`
          links, so the two never show at once and neither is ever missing. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.menuOpen}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-mid transition duration-150 ease-out hover:text-ink active:opacity-70 sm:hidden"
      >
        <svg
          aria-hidden
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M2.5 5h13M2.5 9h13M2.5 13h13" />
        </svg>
      </button>

      <dialog
        ref={dialog}
        /* The backdrop is the dialog's own box, so a click that lands on the
           element rather than on the card inside it is a click outside. */
        onClick={(event) => {
          if (event.target === dialog.current) setOpen(false);
        }}
        aria-label={t.menuOpen}
        /* THE SAME BOX AS THE OTHER SHEETS, to the class — modals of different
           widths on one site read as an accident. */
        className="m-auto max-h-[90vh] w-[min(92vw,20rem)] overflow-y-auto rounded-card border border-line bg-paper p-0 shadow-soft backdrop:bg-black/40"
      >
        <div className="flex flex-col p-5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.menuClose}
            className="-mt-1 -mr-1 cursor-pointer self-end text-lg leading-none text-ink-soft transition duration-150 ease-out hover:text-ink active:opacity-70"
          >
            ✕
          </button>

          {/* ORDINARY ANCHORS. Pressing one navigates, which closes the sheet by
              leaving the document — there is nothing to wire up, and a handler
              that called `setOpen(false)` first would only add a frame between
              the press and the page. */}
          <nav className="mt-1 flex flex-col">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={item.current ? "page" : undefined}
                className={`border-b border-line py-3.5 text-lg font-bold transition duration-150 ease-out last:border-0 ${
                  item.current ? "text-ink" : "text-ink-mid hover:text-ink"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </dialog>
    </>
  );
}
