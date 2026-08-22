import { LogoMark } from "@/components/Logo";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

/**
 * The opening shot. A fixed dark canvas in both appearances — the way a product
 * page on apple.com opens — so its colours come from the `night` tokens rather
 * than the semantic ones, which would turn it white in light mode.
 *
 * The type here is the whole design: one display line at a size the rest of the
 * page never uses again, tight tracking, and nothing competing with it.
 */
export function Hero({ lang }: { lang: Lang }) {
  const text = strings(lang);

  return (
    <section className="relative isolate overflow-hidden bg-night">
      {/* Two decorative layers, both pointer-transparent and unannounced: a cool
          wash lifting the upper third off pure black, and the mark itself blown
          up as a watermark. Neither carries meaning, so neither is in the tree. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-1/3 -z-10 h-[80%] bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgb(41_151_255/0.18),transparent_70%)]"
      />
      {/* LogoMark is already aria-hidden internally. */}
      <LogoMark
        className="pointer-events-none absolute right-0 top-1/2 -z-10 hidden h-40 w-auto -translate-y-1/2 text-white/[0.05] lg:block"
      />

      <div className="mx-auto max-w-page px-5 py-24 sm:px-6 sm:py-32 lg:py-40">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-night-accent">
          {text.heroEyebrow}
        </p>

        {/* `whitespace-pre-line` honours the newline in the copy: where the
            headline breaks is an editorial decision, and both languages break
            it in a different place than a width-based wrap would. */}
        <h1 className="mt-5 whitespace-pre-line text-[clamp(2.75rem,8vw,5.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-night-ink">
          {text.heroTitle}
        </h1>

        <p className="mt-7 max-w-[36rem] text-[clamp(1.0625rem,2.2vw,1.3125rem)] leading-[1.55] text-night-soft">
          {text.heroLede}
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2">
          <a
            href="#products"
            className="flex h-11 items-center rounded-full bg-white px-6 text-[15px] font-medium text-night transition-opacity hover:opacity-85"
          >
            {text.heroPrimaryCta}
          </a>
          <a
            href="#method"
            className="flex h-11 items-center rounded-full px-4 text-[15px] font-medium text-night-accent transition-opacity hover:opacity-75"
          >
            {text.heroSecondaryCta}
            {/* Decorative: the label already says where this goes. */}
            <svg
              viewBox="0 0 16 16"
              className="ml-1 h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 3l5 5-5 5" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
