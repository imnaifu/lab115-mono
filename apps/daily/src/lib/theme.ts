/**
 * The two facts the theme switch and the pre-paint script have to agree on.
 *
 * They live here because the script in app/layout.tsx is a STRING — it runs
 * before React, so it cannot import anything, and the values get interpolated
 * into it. A literal typed twice in two files is a literal that will disagree
 * with itself eventually; this is the cheapest way to make that impossible.
 */

/** localStorage key. Only ever holds "light" or "dark" — never "system": the
 *  absence of the key IS "follow the OS", and that is what a reader who has
 *  never touched the switch has. */
export const THEME_KEY = "theme";

/**
 * What the browser paints AROUND the page — Android's address bar, the notch
 * area on iOS. It has to be the page colour of the theme actually showing, so
 * the switch rewrites the meta tags on every flip.
 *
 * Same values as `--color-page` in index.css. There is no way to make the
 * browser read the CSS token, so this is the one duplication the design leaves
 * behind; if the page colour changes, it changes in both places.
 */
export const THEME_COLOR = { light: "#fbf3e9", dark: "#1d1a33" } as const;

export type Theme = keyof typeof THEME_COLOR;

/**
 * The pre-paint stamp, as source text for the inline `<script>` in
 * app/layout.tsx. See the note at that call site for why it cannot be a module.
 *
 * Built from the constants above rather than typed out, so the key and the two
 * colours exist once. It is minified by hand because it ships on every page and
 * nothing else compiles it, and it swallows every error: a private window can
 * refuse the localStorage read, and the correct outcome there is a page in the
 * OS's theme, not a page that failed.
 */
export const THEME_SCRIPT = [
  "try{",
  `var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});`,
  'if(t==="dark"||t==="light"){',
  "document.documentElement.dataset.theme=t;",
  // The theme-color tags are rendered by Next, so they are not in the document
  // yet when this runs. The colour of the browser's own chrome is not worth
  // blocking the paint for, so it waits for the parser instead.
  `var c=${JSON.stringify(THEME_COLOR)};`,
  'addEventListener("DOMContentLoaded",function(){',
  "document.querySelectorAll('meta[name=\"theme-color\"]')",
  '.forEach(function(m){m.setAttribute("content",c[t])})',
  "})}",
  "}catch(e){}",
].join("");
