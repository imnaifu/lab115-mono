/**
 * The LAB115 mark: 1 · 1 · 5.
 *
 * Three strokes of identical weight and height — two straight, the third
 * closing into a half-circle so the trio reads as the digits without spelling
 * them out. Everything is drawn with `currentColor` and no fill, which is what
 * lets one file serve the dark hero, the light nav and the favicon; per HIG a
 * mark should stay recognisable at 16px, so there is no detail here that a
 * 16px raster would lose.
 *
 * Geometry (viewBox 46×28): stroke weight 8, bars centred at x=4 and x=18, the
 * arc a true semicircle of r=10 centred at (32,14). Every gap is 6. Changing
 * any one of those numbers breaks the even rhythm — change them together.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 46 28"
      fill="none"
      stroke="currentColor"
      strokeWidth={8}
      strokeLinecap="round"
      className={className}
      // The wordmark next to it already names the brand; announcing it twice
      // would make a screen reader say "LAB115 LAB115".
      aria-hidden="true"
    >
      <path d="M4 4V24" />
      <path d="M18 4V24" />
      <path d="M32 4a10 10 0 0 1 0 20" />
    </svg>
  );
}

/** The mark plus the wordmark, as used in the nav and the footer. */
export function Logo({
  brand,
  className,
}: {
  brand: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark className="h-3.5 w-auto" />
      <span className="text-[17px] font-semibold tracking-[-0.01em]">
        {brand}
      </span>
    </span>
  );
}
