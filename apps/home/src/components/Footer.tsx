import { Logo } from "@/components/Logo";
import { CONTACT_EMAIL } from "@/lib/config";
import { isOwnProperty, PRODUCTS } from "@/data/products";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

/**
 * Deliberately almost empty: the mark, the positioning line, links to the two
 * products, one contact address, and the notice.
 *
 * THE ADDRESS IS NEW, and it reverses what this note used to say — "no contact
 * details of any kind". That held while the domain had no MX and any address
 * printed here would have bounced. `help@` now forwards through Cloudflare Email
 * Routing, so it is printed: plain `mailto:`, unobfuscated, because Cloudflare's
 * Email Obfuscation rewrites the HTML and React then fails to hydrate it.
 *
 * Dark in both appearances, closing the page on the same canvas the hero opened
 * it with.
 */
export function Footer({ lang }: { lang: Lang }) {
  const text = strings(lang);
  const year = new Date().getFullYear();

  return (
    <footer className="bg-night px-5 py-14 text-night-soft sm:px-6">
      <div className="mx-auto flex max-w-page flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo brand={text.brand} className="text-night-ink" />
          <p className="mt-3 text-[13px]">{text.footerNote}</p>
        </div>

        <nav className="flex flex-col gap-2" aria-label={text.productsTitle}>
          {PRODUCTS.map((product) => (
            <a
              key={product.id}
              href={product.url}
              target="_blank"
              /* Same split as the shelf above — see `isOwnProperty`. */
              rel={isOwnProperty(product) ? "noopener" : "noopener noreferrer"}
              className="text-[13px] transition-colors hover:text-night-ink"
            >
              {product.name}
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto mt-10 max-w-page border-t border-night-line pt-6 text-[12px]">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mb-2 inline-block transition-colors hover:text-night-ink"
        >
          {CONTACT_EMAIL}
        </a>
        {/* Taken from the server's clock at render time rather than typed in,
            so there is no literal to remember to bump each January. */}
        <div>
          © {year} {text.brand}. {text.footerRights}
        </div>
      </div>
    </footer>
  );
}
