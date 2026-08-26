/**
 * Section and source colours, as values that resolve themselves per theme.
 *
 * `light-dark()` RATHER THAN A REACT-SIDE BRANCH, because every consumer applies
 * these through an inline `style` — a tab's background, a dot, the source line on
 * a card — and an inline style cannot answer a media query. Reading the theme in
 * JS instead would mean the colour arrives one paint after the rest of the page
 * and then flips under a reader who touches the switch.
 *
 * It resolves against `color-scheme`, which index.css sets on the root and
 * app/layout.tsx stamps before first paint. Nothing else is required at the call
 * site, which is the point: a colour goes through here and stops being a
 * per-theme problem.
 *
 * NOT FOR THE POSTER, THE OG CARD OR THE EMAIL. All three are drawn somewhere
 * that has no `color-scheme` to consult — Satori for the first two, a stranger's
 * mail client for the third — and all three are cream by decision. They read
 * `.accent` directly and must keep doing so; see lib/mail/render.ts.
 */

/** The dark side of the ink, and the target a derived accent leans toward. */
const DARK_INK = "#f3ede1";

/**
 * @param light  The hand-picked colour, chosen against the cream ground.
 * @param dark   The hand-picked dark counterpart, when there is one.
 *
 * With no `dark`, the light value is lightened toward the dark side's ink rather
 * than toward white, so a derived accent lands in the same warm family as the
 * hand-picked ones instead of going chalky. 62% is where the darkest accent in
 * config.json still separates from the page behind it.
 */
export function themedAccent(light: string, dark?: string): string {
  return `light-dark(${light}, ${dark ?? `color-mix(in srgb, ${light} 62%, ${DARK_INK})`})`;
}
