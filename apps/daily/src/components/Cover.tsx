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
}: {
  id: string;
  sourceId: string;
  image: string | null;
}) {
  const source = sourceOf(sourceId);

  return (
    <div className="cover">
      <div
        className="cover__fallback"
        style={{ background: gradientFor(id, source.accent) }}
      >
        <span className="cover__initial">{source.name}</span>
      </div>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" />
      ) : null}
    </div>
  );
}
