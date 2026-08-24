import { isOwnProperty, PRODUCTS } from "@/data/products";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import { SectionHead } from "@/components/SectionHead";

/**
 * The product shelf. Two cards, one row on desktop — a grid so a third product
 * later drops in without touching the layout.
 */
export function Products({ lang }: { lang: Lang }) {
  const text = strings(lang);

  return (
    <section
      id="products"
      className="scroll-mt-16 bg-surface px-5 py-24 sm:px-6 sm:py-32"
    >
      <div className="mx-auto max-w-page">
        <SectionHead
          eyebrow={text.productsEyebrow}
          title={text.productsTitle}
          lede={text.productsLede}
        />

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {PRODUCTS.map((product) => (
            <article
              key={product.id}
              className="group flex flex-col rounded-card border border-line bg-surface-3 p-8 shadow-card transition-shadow duration-300 hover:shadow-card-hover sm:p-10"
            >
              <h3 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">
                {product.name}
              </h3>
              <p className="mt-1.5 text-[17px] text-ink-mid">
                {product.tagline[lang]}
              </p>

              <p className="mt-6 text-[15px] leading-[1.65] text-ink-soft">
                {product.description[lang]}
              </p>

              {/* `mt-auto` pins the facts and the link to the bottom, so two
                  cards with unequal copy still line their buttons up. */}
              <ul className="mt-auto flex flex-wrap gap-x-2 gap-y-1 pt-8 text-[13px] text-ink-soft">
                {product.facts[lang].map((fact, index) => (
                  <li key={fact} className="flex items-center gap-2">
                    {/* A hairline between facts, never before the first one.
                        Decorative, so it is a border rather than a character a
                        screen reader would read out. */}
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className="h-3 w-px bg-line"
                      />
                    )}
                    {fact}
                  </li>
                ))}
              </ul>

              <a
                href={product.url}
                target="_blank"
                /* `noreferrer` for a genuinely OUTBOUND link only — see
                   `isOwnProperty`. Stripping the referrer on the way to our own
                   other site made every click from this shelf arrive there as
                   direct traffic, which is the one number this shelf exists to
                   move. `noopener` is unconditional. */
                rel={isOwnProperty(product) ? "noopener" : "noopener noreferrer"}
                className="mt-6 flex h-11 w-fit items-center rounded-full bg-ink px-5 text-[15px] font-medium text-surface transition-opacity hover:opacity-85"
              >
                {text.visit} {product.host[lang]}
                <svg
                  viewBox="0 0 16 16"
                  className="ml-1.5 h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 11L11 5M6 5h5v5" />
                </svg>
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
