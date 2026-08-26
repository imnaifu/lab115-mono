"use client";

import { useCallback } from "react";
import { THEME_COLOR, THEME_KEY, type Theme } from "@/lib/theme";

/**
 * A circle with one half filled — the contrast mark, and the one icon here that
 * does NOT change with the theme.
 *
 * That is deliberate. A sun/moon pair has to know which theme is showing, which
 * on a server-rendered page means either a hydration mismatch or a flicker as
 * React corrects the first paint. A symbol that means "light and dark" rather
 * than "the theme you will get" sidesteps the question, and the button's
 * accessible name carries the rest.
 */
function ContrastIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 flex-none" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor" />
    </svg>
  );
}

/**
 * The masthead's light/dark switch.
 *
 * TWO STATES, NOT THREE. The reader arrives following their OS — no stored
 * preference, no `data-theme`, the media query in index.css decides — and the
 * first press replaces that with a choice which then outranks the OS in both
 * directions and survives navigation. There is no way back to "follow the OS"
 * short of clearing site data, which is the trade a two-state switch makes and
 * was asked for.
 *
 * IT READS THE DOM, NOT REACT STATE. The current theme lives in one place —
 * `data-theme` on <html>, stamped before first paint by the script in
 * app/layout.tsx — and a `useState` mirror of it would be a second copy that is
 * wrong on the first render of every page. Nothing here re-renders; the flip is
 * an attribute change and CSS does the rest.
 */
export function ThemeToggle({ label }: { label: string }) {
  const flip = useCallback(() => {
    const root = document.documentElement;
    const current: Theme =
      root.dataset.theme === "dark" || root.dataset.theme === "light"
        ? root.dataset.theme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    const next: Theme = current === "dark" ? "light" : "dark";

    root.dataset.theme = next;

    // A private window can throw on write, and a theme that fails to persist is
    // still a theme that applied — the attribute above already took effect.
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}

    // Both of the tags Next renders from `viewport.themeColor`, because the one
    // carrying `media` no longer describes what is showing once the reader has
    // overridden the OS.
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute("content", THEME_COLOR[next]);
    }
  }, []);

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={label}
      title={label}
      /* The install control's shape, minus the words: two labelled pills side by
         side would make the masthead's top row a toolbar, and only one of the two
         is worth a sentence. */
      className="flex cursor-pointer items-center rounded-full border border-line bg-paper p-2 text-ink-mid"
    >
      <ContrastIcon />
    </button>
  );
}
