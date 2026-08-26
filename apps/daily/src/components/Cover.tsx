import { sourceOf } from "@/lib/sources";

/** A deterministic gradient angle from the article id, so a given article's
 *  cover looks the same on every render. */
function gradientFor(id: string, accent: string): string {
  const seed = parseInt(id.slice(0, 4), 16) || 0;
  const tilt = 120 + (seed % 90);
  // The far end of the ramp used to be a flat `#1d1a33`. That value is now the
  // dark theme's PAGE colour, so on a dark page the cover faded into the ground
  // it was supposed to sit on. It leans toward the ink of whichever side is
  // showing instead: still darker than the accent on cream, now lighter than it
  // on the dark page, and in both cases a step AWAY from the background.
  const far = "light-dark(#1d1a33, #f3ede1)";
  return (
    `linear-gradient(${tilt}deg, ${accent} 0%, ${accent} 42%, ` +
    `color-mix(in srgb, ${accent} 55%, ${far}) 100%)`
  );
}

/**
 * Cover size is a prop, not a descendant selector.
 *
 * It used to come from `.hero .cover` / `.card .cover` — the parent reaching in
 * to size its child, which utilities cannot express. The hero cover is a full
 * width band on a phone and a book spine beside the text on a wider screen.
 *
 * The CARD cover is a SQUARE, and one size at every width.
 *
 * It was 88×120 (120 past `sm:`), sized for when it stood beside the whole card.
 * Beside the headline block alone — 52px for a one-line title, 80px for two —
 * that left 40–68px of empty column under the title. Matching the text block
 * exactly, via `self-stretch` and no height, closed the gap but made the box a
 * landscape sliver: at 88×52 a wide source banner center-crops to a ~169px slice
 * of the original and catches whatever letters sit beside the logo, which looked
 * worse than the gap did.
 *
 * 80×80 is the answer to both. A square is the forgiving crop for the logos and
 * hero shots these actually are, and 80 is within a line of the header block, so
 * what remains is 28px at worst — spent as breathing room by the `items-center`
 * on the row in ArticleCards rather than dumped under the title.
 */
const SIZE = {
  /**
   * The article page's cover, and a square on the left for the same reason the
   * card's is.
   *
   * It was `h-42 w-full sm:h-50 sm:w-36` — a full-width band on a phone, a book
   * spine to the RIGHT of the text above `sm`, and hidden outright below it. That
   * made the one page devoted to a single article the one place whose layout did
   * not match the list it was reached from. Bigger than the card's 80px because
   * the headline beside it is `text-3xl` rather than `text-lg`, so the header
   * block it has to balance is taller.
   */
  hero: "size-24 sm:size-28",
  card: "size-20",
} as const;

/**
 * The placeholder's source name, sized for the box that has to hold it.
 *
 * `text-xs` on the card, because it is 80px wide and the longest source names are
 * long: "the singularity is nearer" needs four lines, which is 64px plus padding
 * at this size and would not fit at all one step up. The hero cover is 112px and
 * gets one step more, not the display size it had as a 144px band.
 */
const LABEL = {
  hero: "p-2.5 text-sm",
  card: "p-2 text-xs",
} as const;

/**
 * The gradient + source name are ALWAYS rendered, with the photo layered on
 * top when there is one. That way a cover that 404s or times out — XDA's CDN
 * does both intermittently — degrades to a designed placeholder instead of an
 * empty box, with no client-side JS involved.
 *
 * The <img> is `alt=""` on purpose: it is decorative (the headline sits right
 * beside it, and the layer underneath already names the source), and an empty
 * alt is also what stops browsers drawing a broken-image glyph on failure.
 */
export function Cover({
  id,
  sourceId,
  image,
  variant,
}: {
  id: string;
  sourceId: string;
  image: string | null;
  variant: keyof typeof SIZE;
}) {
  const source = sourceOf(sourceId);

  return (
    <div
      className={`relative flex-none overflow-hidden rounded-xl bg-page-deep shadow-cover ${SIZE[variant]}`}
    >
      {/* The text size lives on the wrapper beside its padding — the two are one
          decision per variant — and the span inherits it. */}
      <div
        className={`absolute inset-0 flex items-end ${LABEL[variant]}`}
        style={{ background: gradientFor(id, source.accent) }}
      >
        <span className="font-bold text-paper/95">{source.name}</span>
      </div>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="absolute inset-0 size-full object-cover"
          src={image}
          alt=""
          loading="lazy"
        />
      ) : null}
    </div>
  );
}
