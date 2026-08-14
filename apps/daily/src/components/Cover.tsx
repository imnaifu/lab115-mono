import { sourceOf } from "@/lib/sources";

/** A deterministic gradient angle from the article id, so a given article's
 *  cover looks the same on every render. */
function gradientFor(id: string, accent: string): string {
  const seed = parseInt(id.slice(0, 4), 16) || 0;
  const tilt = 120 + (seed % 90);
  return (
    `linear-gradient(${tilt}deg, ${accent} 0%, ${accent} 42%, ` +
    `color-mix(in srgb, ${accent} 55%, #1d1a33) 100%)`
  );
}

/**
 * Cover size is a prop, not a descendant selector.
 *
 * It used to come from `.hero .cover` / `.card .cover` — the parent reaching in
 * to size its child, which utilities cannot express. The hero cover is a full
 * width band on a phone and a book spine beside the text on a wider screen.
 */
const SIZE = {
  hero: "h-42 w-full sm:h-50 sm:w-36",
  card: "h-22 w-16 sm:h-30 sm:w-22",
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
      className={`relative flex-none overflow-hidden rounded-xl bg-cream-deep shadow-cover ${SIZE[variant]}`}
    >
      <div
        className="absolute inset-0 flex items-end p-2.5"
        style={{ background: gradientFor(id, source.accent) }}
      >
        <span
          className={`font-bold text-paper/95 ${variant === "hero" ? "text-xl" : "text-sm"}`}
        >
          {source.name}
        </span>
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
