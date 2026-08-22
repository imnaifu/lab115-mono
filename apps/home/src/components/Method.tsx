import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import { SectionHead } from "@/components/SectionHead";

/**
 * The three rules. Numbered, because the order is the argument: the annoyance
 * comes first, the model second, shipping last.
 *
 * Set on `surface-2` so it reads as a distinct band between the two white
 * sections, without needing a border to say so.
 */
export function Method({ lang }: { lang: Lang }) {
  const text = strings(lang);

  return (
    <section
      id="method"
      className="scroll-mt-16 bg-surface-2 px-5 py-24 sm:px-6 sm:py-32"
    >
      <div className="mx-auto max-w-page">
        <SectionHead eyebrow={text.methodEyebrow} title={text.methodTitle} />

        <ol className="mt-14 grid gap-x-8 gap-y-12 md:grid-cols-3">
          {text.method.map((rule, index) => (
            <li key={rule.title}>
              {/* The numeral is the rule's index, which the ordered list already
                  conveys to a screen reader — so this copy of it is decorative. */}
              <span
                aria-hidden="true"
                className="block text-[15px] font-semibold tabular-nums text-accent"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-[21px] font-semibold leading-snug tracking-[-0.015em] text-ink">
                {rule.title}
              </h3>
              <p className="mt-3 text-[15px] leading-[1.65] text-ink-soft">
                {rule.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
