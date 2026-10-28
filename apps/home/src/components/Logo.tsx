/**
 * The LAB115 mark: 1 · 1 · 5 on a yellow tile.
 *
 * Three strokes of identical weight and height — two straight, the third
 * closing into a half-circle so the trio reads as the digits without spelling
 * them out — drawn in ink on a `brand` tile with an ink outline, the way
 * Sokosoko draws everything: one line colour over a flat fill. The outline is
 * what keeps the tile visible on a white page and on a dark browser tab alike.
 *
 * Geometry (viewBox 64×64): the tile is inset 2 with radius 16 and a 3-wide
 * outline. The strokes keep their original 46×28 drawing — weight 8, bars at
 * x=4 and x=18, the arc a true semicircle of r=10 centred at (32,14), every gap
 * 6 — scaled into the tile by MARK.transform. Change any of those numbers
 * together.
 *
 * public/favicon.svg, public/apple-touch-icon.png and the OG card (lib/og.tsx,
 * built from MARK below) all draw this. The favicon is a static file and cannot
 * import anything, so it repeats the numbers — keep it in step.
 */
export const MARK = {
  strokes: ["M4 4V24", "M18 4V24", "M32 4a10 10 0 0 1 0 20"],
  transform: "translate(12 19.83) scale(0.8696)",
} as const;

/** How the brand is written beside the mark. Lowercase on purpose; the name in
 *  titles and structured data stays `LAB115` (see lib/i18n.ts). */
export const WORDMARK = "lab115";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      // The wordmark next to it already names the brand; announcing it twice
      // would make a screen reader say "lab115 lab115".
      aria-hidden="true"
    >
      <rect
        x={2}
        y={2}
        width={60}
        height={60}
        rx={16}
        strokeWidth={3}
        className="fill-brand stroke-ink"
      />
      <g
        transform={MARK.transform}
        fill="none"
        strokeWidth={8}
        strokeLinecap="round"
        className="stroke-ink"
      >
        {MARK.strokes.map((path) => (
          <path key={path} d={path} />
        ))}
      </g>
    </svg>
  );
}
