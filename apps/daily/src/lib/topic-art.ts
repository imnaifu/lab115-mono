/**
 * One line icon per topic, drawn the way the Sokosoko design system draws its
 * icons: a 24 grid, 2px stroke, round caps and joins, in the text's colour
 * (`currentColor`), so the same glyph works in a chip, a heading and a well.
 *
 * KEYED BY CATEGORY ID — the eight in config.json. An id this table does not
 * know (a category added to the config later, or one retired from it that an
 * old digest still names) gets the bookmark rather than nothing: a missing
 * icon in a row of icons reads as a broken image.
 */
export const TOPIC_PATHS: Record<string, string[]> = {
  // Code brackets.
  tech: ["M8 8l-4 4 4 4", "M16 8l4 4-4 4", "M13.5 6l-3 12"],
  // A briefcase.
  business: [
    "M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z",
    "M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7",
    "M3 12.5h18",
  ],
  // A coin.
  investing: [
    "M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z",
    "M12 7.5v9",
    "M14.5 9.5c-.4-.9-1.3-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.2 0-2.1-.6-2.5-1.5",
  ],
  // A bar chart.
  economy: ["M4 20h16", "M7 16v-4", "M12 16V8", "M17 16v-6"],
  // A flask.
  science: [
    "M9 3h6",
    "M10 3v6l-5.2 8.6A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-3.4L14 9V3",
    "M7.5 15h9",
  ],
  // A pencil.
  design: ["M15.5 4.5l4 4L9 19H5v-4L15.5 4.5Z", "M13.5 6.5l4 4"],
  // A cup.
  living: [
    "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z",
    "M16 11h1.5a2.5 2.5 0 0 1 0 5H16",
    "M8 3.5v2M11 3.5v2",
  ],
  // An open book.
  culture: [
    "M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2Z",
    "M12 6.5v13",
  ],
};

/** The bookmark, for an id with no drawing of its own. */
export const TOPIC_FALLBACK = ["M6 3h12v18l-6-4-6 4V3Z"];

/**
 * Each topic's pastel, for the disc or well an icon sits on, by NAME — the
 * `fill-*` tokens in index.css. Illustration fills keep their light value in
 * dark mode, which is why the icon on one is drawn in `text-ink-fixed` rather
 * than `text-ink`.
 *
 * Five fills for eight topics, so some share. The pairs that share are never
 * adjacent in config.json's order, which is the order every topic list uses.
 */
export const TOPIC_FILLS: Record<string, keyof typeof FILL_HEX> = {
  tech: "sky",
  business: "yellow",
  investing: "mint",
  economy: "lilac",
  science: "sky",
  design: "pink",
  living: "mint",
  culture: "lilac",
};

/**
 * The same fills WRITTEN OUT, for the share poster: Satori has no cascade to
 * read a token from. These are the `--color-fill-*` values in index.css; if one
 * moves there it moves here.
 */
export const FILL_HEX = {
  sky: "#bcdcf2",
  mint: "#bfe3cf",
  pink: "#f6c6cf",
  lilac: "#d9d1f2",
  yellow: "#fdf1cc",
} as const;

/** The ground of a topic with no fill of its own: Sokosoko's paper-sunk. */
export const FILL_FALLBACK_HEX = "#f3efe6";

/** A topic's line icon as an SVG data URI, in `color` — for Satori, which draws
 *  `<img>` but not inline `<svg>`. Same drawing as `TopicIcon`. */
export function topicIconUri(id: string | undefined, color: string): string {
  const paths = (id && TOPIC_PATHS[id]) || TOPIC_FALLBACK;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    paths.map((d) => `<path d="${d}"/>`).join("") +
    `</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/** A topic's fill as hex, for the poster. */
export function topicFillHex(id: string | undefined): string {
  const name = id ? TOPIC_FILLS[id] : undefined;
  return name ? FILL_HEX[name] : FILL_FALLBACK_HEX;
}

