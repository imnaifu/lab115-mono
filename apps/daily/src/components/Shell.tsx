import type { ReactNode } from "react";
import { strings } from "@/lib/i18n";
import { href, LANGS, otherLang, type Lang } from "@/lib/lang";

/**
 * The chrome both pages wear: the column, the masthead, the footer.
 *
 * Sizing is mobile-first, the way Tailwind means it: the bare classes are the
 * phone and `sm:` opens things up.
 *
 * Everything here is a server component. The language is a route parameter, so
 * there is no state to hold and no client boundary to cross — a page arrives
 * already written in the language its URL names.
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

/**
 * The language switch: two links, not a toggle.
 *
 * `path` is the BARE path of the page it sits on — `/d/2026-08-14`, or `/` for
 * the home page — and each half points at the same page under the other
 * prefix. Making it a pair of `<a>`s rather than one button means the
 * destination is visible on hover, right-click works, and the current language
 * has a real href instead of being a dead control.
 */
export function LangSwitch({ lang, path }: { lang: Lang; path: string }) {
  return (
    <div
      className="flex overflow-hidden rounded-full border border-line bg-paper"
      role="group"
      aria-label={lang === "en" ? "Language" : "语言"}
    >
      {LANGS.map((code) => (
        <a
          key={code}
          href={href(code, path)}
          aria-current={code === lang ? "true" : undefined}
          hrefLang={code}
          className={`px-3 py-2 text-xs font-bold ${
            code === lang ? "bg-ink text-paper" : "text-ink-soft"
          }`}
        >
          {code === "zh" ? "中文" : "EN"}
        </a>
      ))}
    </div>
  );
}

/**
 * The masthead. The language switch lives in the top row beside the domain
 * chip, which is the top-right of the content column — the blobs own the
 * literal top-right corner of the page and nothing readable can go there.
 */
export function Masthead({
  title,
  subtitle,
  lang,
  path,
  children,
}: {
  title: string;
  subtitle: string;
  lang: Lang;
  path: string;
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

      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-xs font-bold tracking-widest text-cream uppercase">
          daily.lab115.com
        </span>
        <LangSwitch lang={lang} path={path} />
      </div>

      {/* The mark and the wordmark, laid out the way the share poster lays them
          out — the two are the same lockup and should not drift apart.

          `mt-1.5` rather than `items-center`: centring on the whole block would
          drop the mark below the cap line of the title, because the subtitle is
          part of the block's height. */}
      <div className="mt-5 flex items-start gap-3 sm:gap-4">
        <img
          src="/favicon.svg"
          alt=""
          className="mt-1.5 size-11 flex-none sm:size-14"
        />
        {/* `max-w-md` keeps the wordmark clear of the orange blob. */}
        <h1 className="max-w-md text-4xl leading-tight font-bold tracking-tight text-ink sm:text-5xl">
          {title}
          <small className="mt-1.5 block text-lg font-medium italic text-ink-mid sm:text-xl">
            {subtitle}
          </small>
        </h1>
      </div>

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

/**
 * The end-of-page destination: one card-sized target, not a line of small type.
 *
 * Navigation used to live in the footer, where it read as fine print — the same
 * weight as the copyright beside it. A reader who has just finished the last
 * card is at the moment of deciding what to do next, so the answer gets a whole
 * block at exactly that point, and the footer goes back to being a footer.
 */
export function EndLink({
  href: to,
  label,
  sub,
}: {
  href: string;
  label: string;
  sub: string;
}) {
  return (
    <a
      href={to}
      className={`${SECTION} flex items-center justify-between gap-4 rounded-card border border-line bg-paper px-6 py-5`}
    >
      <span className="min-w-0">
        <span className="block text-xl font-bold text-ink">{label}</span>
        <span className="mt-1 block text-sm font-medium text-ink-soft">
          {sub}
        </span>
      </span>
      {/* aria-hidden: the anchor's own text already names the destination. */}
      <span
        aria-hidden
        className="flex size-10 flex-none items-center justify-center rounded-full bg-ink text-lg text-paper"
      >
        →
      </span>
    </a>
  );
}

/**
 * A plain site footer: who made this and what it is.
 *
 * Deliberately carries no navigation — that is `EndLink`'s job now.
 */
export function Footer({ year, lang }: { year: string; lang: Lang }) {
  const t = strings(lang);
  return (
    <footer
      className={`mt-10 border-t border-line pt-6 ${PAD} flex flex-wrap items-start justify-between gap-x-8 gap-y-4`}
    >
      <div className="min-w-0">
        <div className="text-lg font-bold text-ink">
          每日干货{" "}
          <span className="font-medium text-ink-mid italic">Daily Takes</span>
        </div>
        {/* `text-pretty` so the last line never ends up holding one orphaned
            character, which is what this sentence did at `max-w-xs`. */}
        <p className="mt-1 max-w-sm text-xs font-medium text-pretty text-ink-soft">
          {t.tagline}
        </p>
      </div>

      <div className="text-xs font-medium text-ink-soft sm:text-right">
        © {year} daily.lab115.com
      </div>
    </footer>
  );
}

/**
 * A section heading with its count on the right.
 *
 * `dot` and `sub` are optional because the folded-updates section has neither —
 * it is not a category, so it has no accent colour and no second name.
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
