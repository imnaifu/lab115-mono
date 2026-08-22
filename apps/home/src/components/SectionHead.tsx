/**
 * The eyebrow / headline / lede stack that opens every section below the hero.
 * Extracted because the type scale is the thing holding the page together — two
 * sections drifting apart by a couple of pixels is exactly the inconsistency
 * HIG's typography guidance is about.
 */
export function SectionHead({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="max-w-[34rem]">
      <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-accent">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
        {title}
      </h2>
      {lede && (
        <p className="mt-4 text-[17px] leading-[1.6] text-ink-mid">{lede}</p>
      )}
    </div>
  );
}
