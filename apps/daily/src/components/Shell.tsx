import type { ReactNode } from "react";
import { InstallApp } from "./InstallApp";
import { strings } from "@/lib/i18n";
import { href, LANGS, otherLang, type Lang } from "@/lib/lang";
import type { TrackEvent } from "@/lib/track";

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
 *
 * IT WAS HIDDEN, by an early `return null` right here, for as long as the
 * summaries were Chinese only — a switch that offers a second language and then
 * renders the same text is a control that does nothing. The English half is back
 * (see `summaryFor` in lib/take.ts), so the switch is too, and the note is kept
 * because it says what would have to be true to hide it again.
 *
 * One thing it does NOT promise: that every page has both languages. An archived
 * digest written before the English half returned falls back to Chinese under
 * /en. The switch still belongs there — it changes the chrome, the headline
 * choice and the poster, and on every new digest it changes the prose as well.
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
          /* Only the half that would CHANGE the language: the current one is a
             link for the reasons in the note above, but pressing it is a no-op
             and counting it as a switch would inflate the one number this event
             exists to answer — whether anyone uses the switch at all. */
          data-track={code === lang ? undefined : "lang_switch"}
          data-track-to={code === lang ? undefined : code}
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
  /**
   * A second line under the title, in the SAME language.
   *
   * Nothing passes one today. It used to carry the title's other-language twin —
   * 每日干货 above Daily Takes, 归档 above Archive — which the one-language-at-a-
   * time rule ruled out; see the note in lib/i18n.ts. Kept optional rather than
   * deleted because a masthead tagline is a plausible thing to want here, and a
   * caller adding one now has no way to reintroduce the pair by accident.
   */
  subtitle?: string;
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
        {/* The domain chip goes home too, same destination as the lockup below.
            Two links to the same page is what a masthead normally is — the chip
            is what a reader who has scrolled to an article page reaches for
            first, and its text already names the destination, so it needs no
            aria-label of its own. */}
        <a
          href={href(lang, "/")}
          /* No `uppercase`: a domain is written lowercase, and the poster's chip
             prints it that way too — see posterDomain in lib/share.ts. The
             literal below is already the form that renders. */
          className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-xs font-bold tracking-widest text-cream"
        >
          daily.lab115.com
        </a>
        {/* The top-right corner of the CONTENT column, which is as close to the
            top right of the page as anything readable can go — the orange blob
            owns the literal corner. Two controls now, both of them about the
            frame rather than the text: which language the site is in, and whether
            it lives on the home screen.

            `gap-2` between them and `gap-3` to the chip: the pair reads as one
            group of controls, which is what keeps a three-item row from looking
            like three unrelated things. The install button is the mark alone on a
            phone — see the width note there for the arithmetic. */}
        <div className="flex flex-none items-center gap-2">
          <InstallApp lang={lang} />
          <LangSwitch lang={lang} path={path} />
        </div>
      </div>

      {/* The mark and the wordmark, laid out the way the share poster lays them
          out — the two are the same lockup and should not drift apart.

          `mt-1.5` rather than `items-center`: centring on the whole block would
          drop the mark below the cap line of the title, because the subtitle is
          part of the block's height. */}
      {/* The whole lockup is the link home — the mark and the wordmark read as
          one target, so making only one of them clickable would be a smaller
          hit area for no reason. On the home page it points at itself, which is
          what every masthead does and what a reader arriving from an article
          page or the archive expects to find here. */}
      <a
        href={href(lang, "/")}
        aria-label={lang === "en" ? "Daily Takes — home" : "每日干货 · 回到首页"}
        className="mt-5 flex items-start gap-3 sm:gap-4"
      >
        <img
          src="/favicon.svg"
          alt=""
          className="mt-1.5 size-11 flex-none sm:size-14"
        />
        {/* `max-w-md` keeps the wordmark clear of the orange blob. */}
        <h1 className="max-w-md text-4xl leading-tight font-bold tracking-tight text-ink sm:text-5xl">
          {title}
          {subtitle ? (
            <small className="mt-1.5 block text-lg font-medium italic text-ink-mid sm:text-xl">
              {subtitle}
            </small>
          ) : null}
        </h1>
      </a>

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
  track: event,
  trackFrom,
}: {
  href: string;
  label: string;
  sub: string;
  /**
   * Which event this one counts as. NAMED BY THE CALLER rather than derived from
   * the href, because the same component is the way to the list of every day and
   * the way to a single day — two different things a reader wants,
   * and a regex over a path is a fragile way to tell them apart.
   */
  track?: TrackEvent;
  /** Which page it was pressed on, when the same event exists on two. */
  trackFrom?: string;
}) {
  return (
    <a
      href={to}
      className={`${SECTION} flex items-center justify-between gap-4 rounded-card border border-line bg-paper px-6 py-5`}
      data-track={event}
      data-track-from={trackFrom}
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
        {/* Same single name as the masthead, so the switch changes both. */}
        <div className="text-lg font-bold text-ink">{t.brand}</div>
        {/* `text-pretty` so the last line never ends up holding one orphaned
            character, which is what this sentence did at `max-w-xs`. */}
        <p className="mt-1 max-w-sm text-xs font-medium text-pretty text-ink-soft">
          {t.tagline}
        </p>
      </div>

      <div className="flex flex-col gap-1 text-xs font-medium text-ink-soft sm:items-end sm:text-right">
        {/**
         * THE LINK BACK TO THE LAB, and it is the only outbound link in the
         * footer.
         *
         * It was missing entirely: lab115.com links here from its product shelf
         * and its footer, and nothing here pointed back — so two properties on the
         * same brand had a one-way relationship, which is the shape a crawler
         * reads as "this site was linked to" rather than "these two are the same
         * publisher". The `Organization` markup on both sides says so now; a link
         * a reader can actually follow is what makes that claim checkable.
         *
         * No `target="_blank"`: this is the same brand, not an outbound trip, and
         * a new tab for it is the kind of thing that leaves a reader with nine of
         * them. No `noreferrer` either, for the reason spelled out on the other
         * side of this link — see Products.tsx over there.
         *
         * And NO `data-track`: `TrackEvent` in lib/track.ts is a closed union and
         * TRACKING.md documents every member of it, so counting this click is a
         * change to the analytics contract rather than to the markup. Worth doing
         * on its own; not worth smuggling in behind an SEO fix.
         */}
        <a className="transition-colors hover:text-ink" href="https://lab115.com">
          lab115.com
        </a>
        <div>© {year} daily.lab115.com</div>
      </div>
    </footer>
  );
}

/**
 * A section heading with its count on the right.
 *
 * `dot` is optional because the folded-updates section and 全部 are not
 * categories, so they have no accent colour.
 *
 * There used to be a `sub` beside the title carrying the category's other name —
 * 技术 with Tech next to it. Gone with the rest of the side-by-side pairs; the
 * heading now says the category once, in the reader's language. See i18n.ts.
 */
export function SectionHead({
  title,
  count,
  dot,
}: {
  title: string;
  count: string;
  dot?: string;
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
      </h2>
      <span className="text-sm font-bold whitespace-nowrap text-ink-soft">
        {count}
      </span>
    </div>
  );
}
