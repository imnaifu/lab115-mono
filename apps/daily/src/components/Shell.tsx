import type { ReactNode } from "react";
import { strings } from "@/lib/i18n";
import { type Lang } from "@/lib/lang";
import type { TrackEvent } from "@/lib/track";

/**
 * The chrome every page wears: the page head, the trail, the end links, the
 * footer — and the two or three constants they are all measured with.
 *
 * Sizing is mobile-first, the way Tailwind means it: the bare classes are the
 * phone and `sm:` opens things up.
 *
 * Everything here is a server component. The language is a route parameter, so
 * there is no state to hold and no client boundary to cross — a page arrives
 * already written in the language its URL names.
 *
 * THE LANGUAGE SWITCH MOVED OUT, to SiteHeader.tsx, which is now its only
 * caller.
 *
 * NOTHING IN THIS FILE MAY IMPORT A SERVER-ONLY MODULE, and that is a hard
 * constraint rather than a preference: `DigestBody.tsx` is a `"use client"` file
 * and it imports `PAD`, `SECTION` and `SectionHead` from here, which drags this
 * whole module into the browser bundle. An `fs` import anywhere in it is then a
 * build failure — "the chunking context does not support external modules
 * (request: node:fs/promises)" — which is exactly what putting `PageShell` here
 * cost, and why the page's own composition lives in PageShell.tsx instead.
 * BackToTop.tsx inlines `PAD` rather than importing it for the same reason from
 * the other direction.
 *
 * `Subscribe.tsx` was the client importer this note was originally written
 * against. It is gone — the subscribe form is `SubscribeDialog.tsx` now and
 * imports nothing from here — but the constraint is not, because DigestBody
 * still crosses the same boundary.
 */

/** The page gutter, on every full-width block. */
export const PAD = "px-4 sm:px-7";

/** Vertical rhythm between the page's stacked blocks. */
export const SECTION = "mt-8";


/**
 * The masthead: WHAT THIS PAGE IS, and whatever meta it passes as children.
 *
 * IT IS NO LONGER THE SITE'S LOCKUP, AND NO LONGER THE SITE'S NAME EITHER. Two
 * rounds took it apart. First the furniture went up into `SiteHeader` — two
 * organic blobs, 24 units of top padding to clear them, a row of three controls
 * pinned to the top right of the CONTENT column, and the mark beside the
 * wordmark at `text-4xl`. Then the words did: the brand and the tagline are the
 * bar's lockup now, on all seven pages at once.
 *
 * WHICH FINALLY MAKES THE `<h1>` SAY SOMETHING. Every page passed `t.brand` as
 * its title, so all seven had the same heading — 每日严选 over a date, over the
 * archive, over a blog's directory entry — and the two pages with a real
 * heading of their own (the article page and a source page) had TWO `<h1>`
 * elements, the site's name and then the actual subject. Each page now passes
 * what it is: the day's date, 归档, 订阅源, the run of days on the front page.
 * The two that already had one pass NO title and keep theirs.
 *
 * `subtitle` IS GONE WITH THE BRAND. It carried `t.tagline` on every page and
 * the tagline is in the bar; before that it carried the title's other-language
 * twin — 每日严选 above Daily Picks — which the one-language-at-a-time rule
 * ruled out. Nothing has wanted it since. A page that needs a sentence under
 * its heading has `children`, which is where the mail confirmation puts its
 * one line.
 */
export function Masthead({
  title,
  crumb,
  children,
}: {
  /**
   * This page's heading, or nothing.
   *
   * OPTIONAL FOR THE TWO PAGES THAT DRAW THEIR OWN. An article page's heading
   * is the headline, set beside the cover in its own plate; a source page's is
   * the blog's name with its accent dot. Both sit below this block and neither
   * can be lifted into it without taking its layout along, so those two pass no
   * title and this renders the trail and the meta row around the gap.
   */
  title?: string;
  /**
   * A trail above the title, for a page that is part of something — see
   * `Breadcrumb`, which is the only thing passed here.
   *
   * A SLOT rather than something the page renders itself, because this block
   * owns its own vertical rhythm: the trail sits above the title and under the
   * bar, and a trail rendered above `<Masthead>` by the page would be a second
   * arrangement of the same three things. It mattered more when the padding it
   * had to fit inside was clearing two blobs; it is still one place rather than
   * seven.
   *
   * THE LAST CRUMB OFTEN REPEATS THE TITLE NOW — 首页 › 归档 over an `<h1>`
   * reading 归档 — and that is accepted rather than overlooked. An older note in
   * ArchiveView argued the opposite, that "the word twice in one header is once
   * too many", and it was right about the arrangement it was written for: the
   * heading then was the BRAND, so 归档 in the crumb was the only thing naming
   * the page and a second copy in the meta row was redundancy. With the heading
   * saying what the page is, a trail that ends where it ends is just a trail —
   * which is what every breadcrumb does and what `aria-current="page"` is for.
   */
  crumb?: ReactNode;
  children?: ReactNode;
}) {
  return (
    /* `pt-10` where there used to be `pt-24`: that padding existed to clear the
       blobs, and what is above this now is a 56/64px bar. The bottom padding is
       untouched — the rhythm between this block and the first thing under it was
       never about the header's own furniture. */
    <header className={`pt-10 pb-8 sm:pt-12 ${PAD}`}>
      {crumb}

      {/* ONE TYPE SCALE. There were two, picked by whether there was a subtitle,
          which is what remained of measuring this text against a 44/56px mark;
          with no mark and no subtitle there is one heading to set. `text-3xl`
          rather than the `text-4xl` the brand had alone, because what goes here
          is now a date, a category name or a blog's title rather than four
          display glyphs — 「2026年9月2日 · 星期三」 at 48px is a heading that
          wraps on a phone and shouts on a desktop.

          `mt-6` when there is a trail above it and nothing when there is not —
          the trail carries its own `mt-6` off the bar, so a second gap between
          the two would be twice the space inside the block that is between the
          block and the page. */}
      {title ? (
        <h1
          className={`max-w-2xl text-3xl leading-tight font-bold tracking-tight text-ink sm:text-4xl ${
            crumb ? "mt-6" : ""
          }`}
        >
          {title}
        </h1>
      ) : null}

      {/* The meta row, and it is skipped rather than rendered empty: the front
          page's only meta was the run of days, which is its heading now. An
          empty flex row here would be `mt-6` of nothing between the title and
          the first card. */}
      {children ? (
        <div
          className={`flex flex-wrap items-center gap-x-3.5 gap-y-2 text-sm font-semibold text-ink-mid ${
            title || crumb ? "mt-6" : ""
          }`}
        >
          {children}
        </div>
      ) : null}
    </header>
  );
}

/**
 * A breadcrumb trail, for a page that is a part of something rather than a place
 * of its own.
 *
 * A REAL `<nav>` WITH AN `<ol>`, not a line of links with a chevron between them:
 * the trail is a list, its order is its meaning, and a screen reader announcing
 * "list, 2 items" is what tells someone where they are without seeing the page.
 * `aria-current="page"` marks the last crumb, which is also why it is NOT a link —
 * a link to the page you are on is a control that does nothing.
 *
 * THE SEPARATOR IS `aria-hidden`. It is punctuation between list items, and read
 * aloud it is noise ("每日严选 greater-than 归档").
 *
 * WHERE IT GOES: above the lockup, passed to `Masthead` as `crumb` — see the prop.
 * It is deliberately small and quiet. The page it sits on has the brand set in
 * 30px directly underneath, and a trail competing with that would be a second
 * masthead.
 */
export function Breadcrumb({
  items,
  label,
}: {
  /** Innermost LAST. Every item but the last needs an `href`; the last is where
   *  the reader already is. */
  items: { label: string; href?: string }[];
  /** What the nav is called, for a reader who cannot see it is a trail. */
  label: string;
}) {
  return (
    <nav aria-label={label} className="mt-6 text-sm font-medium text-ink-soft">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, at) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {at > 0 ? (
              <span aria-hidden className="text-line">
                ›
              </span>
            ) : null}
            {item.href ? (
              <a className="transition-colors hover:text-ink" href={item.href}>
                {item.label}
              </a>
            ) : (
              /* TRUNCATED, because the last crumb on an article page is a
                 headline: 「AI 成了新的推责工具：把锅甩给算法，人类就清白了？」 is 24
                 characters and the trail in front of it is another 14. Wrapping it
                 turns a one-line trail into three lines of grey text above a
                 lockup; the full string stays in the DOM and in the `title`, and
                 the page's own H1 is 40px below it either way. */
              <span
                aria-current="page"
                title={item.label}
                className="max-w-[14rem] truncate text-ink-mid sm:max-w-sm"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
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
 * A plain site footer: who made this, and nothing else.
 *
 * Deliberately carries no navigation — that is `EndLink`'s job now — and no
 * longer the tagline either. That line went to the masthead's `subtitle` first
 * and is in the site bar's lockup now, beside the wordmark on every page; see
 * SiteHeader. The argument that got it out of here is the same one that took
 * navigation out: a line set in 12px grey
 * below a rule, under everything the reader has already stopped reading, is
 * fine print whatever it says. The site's one claim about itself was the worst
 * possible thing to leave there.
 *
 * What is left is genuinely fine print — a name, a link back to the lab, a
 * copyright — so the footer is finally the size of its job.
 */
export function Footer({ year, lang }: { year: string; lang: Lang }) {
  const t = strings(lang);
  return (
    <footer
      className={`mt-10 border-t border-line pt-6 ${PAD} flex flex-wrap items-start justify-between gap-x-8 gap-y-4`}
    >
      {/* Same single name as the masthead, so the switch changes both. */}
      <div className="min-w-0 text-lg font-bold text-ink">{t.brand}</div>

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
        <a
          className="transition-colors hover:text-ink"
          href="https://lab115.com"
        >
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
 * `dot` is optional because 全部 is not a category, so it has no accent colour.
 * (The other caller without one used to be the folded-updates section, which no
 * longer exists.)
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
