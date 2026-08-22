import Link from "next/link";
import { Logo } from "@/components/Logo";
import { strings } from "@/lib/i18n";
import { href, otherLang, type Lang } from "@/lib/lang";

/**
 * The global bar. Sticky, and the only surface on the page that is translucent
 * — HIG reserves materials for the layer floating above content, so nothing
 * below uses blur.
 *
 * It sits ABOVE the hero rather than over it: the hero is a fixed dark canvas
 * in both appearances, so a bar that tried to float on top of it would need one
 * colour over the hero and another over the light sections below, and would be
 * illegible during the transition between them.
 */
export function Nav({ lang }: { lang: Lang }) {
  const text = strings(lang);
  const other = otherLang(lang);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/72 backdrop-blur-xl backdrop-saturate-180">
      <nav
        className="mx-auto flex h-12 max-w-page items-center justify-between px-5 sm:px-6"
        aria-label={text.brand}
      >
        <Link
          href={href(lang, "/")}
          className="text-ink transition-opacity hover:opacity-70"
        >
          <Logo brand={text.brand} />
        </Link>

        <div className="flex items-center gap-1">
          {/* Section links are noise on a phone, where the whole page is two
              swipes long; the language toggle is not, so only it survives. */}
          <div className="hidden sm:flex sm:items-center sm:gap-1">
            <NavLink href="#products">{text.navProducts}</NavLink>
            <NavLink href="#method">{text.navMethod}</NavLink>
          </div>

          <Link
            href={href(other, "/")}
            hrefLang={other}
            className="ml-1 flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-[13px] font-medium text-ink-mid transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {text.langSwitch}
          </Link>
        </div>
      </nav>
    </header>
  );
}

/**
 * 44px minimum touch target (HIG — Layout), which is why the padding is
 * vertical space the label does not need: the bar is 48px tall, so the target
 * fills it rather than being the height of 13px text.
 */
function NavLink({
  href: target,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={target}
      className="flex h-11 items-center rounded-full px-3 text-[13px] font-medium text-ink-mid transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </a>
  );
}
