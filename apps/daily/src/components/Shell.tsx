import type { ReactNode } from "react";

/**
 * The chrome both pages wear: the column, the masthead, the footer.
 *
 * These were seven exported class-name strings and a `styles.ts` module, which
 * is what you end up with when two pages share a look but not a component. The
 * strings are gone — the archive page and the digest page now render the same
 * `<Masthead>` with different words in it.
 *
 * Sizing is mobile-first, the way Tailwind means it: the bare classes are the
 * phone and `sm:` opens things up. It used to be the other way round — desktop
 * base with a custom `narrow:` variant overriding it — which needed a
 * `@custom-variant` declaration and stated every responsive value twice.
 */

/** The fixed screenshot column. `overflow-x-clip` because the masthead blobs
 *  bleed past its edges and must not widen the document. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-page overflow-x-clip bg-cream pb-10">
      {children}
    </div>
  );
}

/** The page gutter, on every full-width block. */
export const PAD = "px-4 sm:px-7";

/** Vertical rhythm between the page's stacked blocks. */
export const SECTION = "mt-8";

export function Masthead({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <header
      className={`relative isolate overflow-hidden pt-24 pb-8 sm:pt-28 ${PAD}`}
    >
      {/* Two organic shapes lifted from the template's onboarding screens.
          Real divs rather than ::before/::after — as pseudo-elements they
          needed a class in the stylesheet, and the whole point of that class
          was to hold these two offsets. The top padding above is what the
          wordmark needs to clear them. */}
      <div className="absolute -top-26 -left-21 -z-10 h-50 w-65 rounded-blob bg-ink" />
      <div className="absolute -top-14 -right-11 -z-10 size-42 rounded-full bg-orange" />

      <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-xs font-bold tracking-widest text-cream uppercase">
        daily.lab115.com
      </span>

      {/* `max-w-md` keeps the wordmark clear of the orange blob. */}
      <h1 className="mt-5 max-w-md text-4xl leading-tight font-bold tracking-tight text-ink sm:text-5xl">
        {title}
        <small className="mt-1.5 block text-lg font-medium italic text-ink-mid sm:text-xl">
          {subtitle}
        </small>
      </h1>

      <div className="mt-6 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-sm font-semibold text-ink-mid">
        {children}
      </div>
    </header>
  );
}

/** The orange separator between masthead meta items. */
export function MastheadDot() {
  return <span className="size-1 rounded-full bg-orange" />;
}

export function Footer({ left, link }: { left: string; link: ReactNode }) {
  return (
    <footer
      className={`mt-10 flex flex-wrap items-center justify-between gap-2.5 border-t border-line pt-5 text-xs font-semibold text-ink-soft ${PAD}`}
    >
      <span>{left}</span>
      <span className="flex gap-3.5">{link}</span>
    </footer>
  );
}

/**
 * A section heading with its count on the right.
 *
 * `dot` and `sub` are optional because the folded-updates section has neither —
 * it is not a category, so it has no accent colour and no English name.
 */
export function SectionHead({
  title,
  count,
  dot,
  sub,
}: {
  title: string;
  count: string;
  dot?: string;
  sub?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="flex items-baseline gap-2 text-2xl font-bold tracking-tight text-ink">
        {/* Carries the category's colour, so sections stay distinguishable at a
            glance in a long screenshot without tinting the headings. The nudge
            up is optical: a baseline-aligned circle sits too low. */}
        {dot ? (
          <span
            className="size-2 flex-none -translate-y-0.5 rounded-full"
            style={{ background: dot }}
          />
        ) : null}
        {title}
        {sub ? (
          <small className="text-sm font-medium italic text-ink-soft">
            {sub}
          </small>
        ) : null}
      </h2>
      <span className="text-sm font-bold whitespace-nowrap text-ink-soft">
        {count}
      </span>
    </div>
  );
}
