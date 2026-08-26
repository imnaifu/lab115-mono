import type { ReactNode } from "react";
import { InstallApp } from "./InstallApp";
import { ThemeToggle } from "./ThemeToggle";
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
    <div className="mx-auto w-full max-w-page overflow-x-clip bg-page pb-10">
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
 * The masthead: a row of controls, the lockup, and whatever meta the page passes
 * as children.
 *
 * The controls sit at the top right of the CONTENT column rather than of the page,
 * because the blobs own the literal corner and nothing readable can go there.
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
   * EVERY PAGE PASSES `t.tagline` HERE NOW. It used to carry the title's
   * other-language twin — 每日严选 above Daily Picks, 归档 above Archive — which
   * the one-language-at-a-time rule ruled out, and for a long time nothing passed
   * anything; the prop survived that stretch because a masthead tagline was a
   * plausible thing to want, and this is it. See the note in lib/i18n.ts for what
   * that sentence is now allowed to claim.
   *
   * Still optional, and the layout below branches on it — see the alignment note
   * on the lockup. A page that wants a bare title is one prop away.
   */
  subtitle?: string;
  lang: Lang;
  path: string;
  children: ReactNode;
}) {
  // Only the theme switch's label — the masthead's own words all arrive as props.
  const t = strings(lang);

  return (
    <header
      className={`relative isolate overflow-hidden pt-24 pb-8 sm:pt-28 ${PAD}`}
    >
      {/* Two organic shapes lifted from the template's onboarding screens.
          Real divs rather than ::before/::after — as pseudo-elements they
          needed a class in the stylesheet, and the whole point of that class
          was to hold these two offsets. The top padding above is what the
          wordmark needs to clear them. */}
      {/* `bg-blob`, NOT `bg-ink` — see the token in index.css for what inverting
          this one did to the dark page. */}
      <div className="absolute -top-26 -left-21 -z-10 h-50 w-65 rounded-blob bg-blob" />
      <div className="absolute -top-14 -right-11 -z-10 size-42 rounded-full bg-orange" />

      {/* The controls row: which language the site is in, and whether it lives on
          the home screen. Nothing else — this is as close to the top right of the
          page as anything readable can go, since the orange blob owns the literal
          corner.

          THE DOMAIN CHIP IS GONE, and it used to open this row. It was a second
          link home reading `daily.lab115.com`, and it was removed rather than
          merely hidden on phones: the wordmark directly below is the same link to
          the same page, the browser's address bar already shows the domain, and
          the image this site is actually shared as is the POSTER, which draws its
          own domain chip (see `posterDomain` in lib/share.ts) and is untouched by
          this. What the page loses is the domain appearing in a screenshot OF THE
          PAGE, which is not the artifact anyone shares.

          It is also what lets the install button keep its label. Measured rather
          than guessed: the chip was 137px, the language switch is 90px and the
          install button 95px in Chinese / 114px in English, against the 361px a
          393px phone leaves after `px-4`. All three never fit — it was 3px short,
          which is why the label used to vanish below `sm:` and leave a bare glyph
          nobody could read. The remaining pair needs 193px, so there is now 168px
          of slack instead of 3px, at every width and in both languages.

          `justify-end` rather than `justify-between`: with one child left,
          `justify-between` puts it on the LEFT.

          THE THEME SWITCH IS THE THIRD CHILD, and the budget above is why it is
          an icon with no label: 34px of button plus an 8px gap spends 42px of
          the 168px of slack, leaving 126px. A labelled pill — 「深色浅色切换」
          would be about 110px — would put the row back within a few pixels of
          the overflow that cost the install button its label once already. */}
      <div className="flex items-center justify-end gap-2">
        <LangSwitch lang={lang} path={path} />
        <ThemeToggle label={t.themeToggle} />
        <InstallApp lang={lang} />
      </div>

      {/* The mark and the wordmark, laid out the way the share poster lays them
          out — the two are the same lockup and should not drift apart.

          BOTH BRANCHES RENDER NOW, so the alignment is conditional rather than
          picked once. With a subtitle the `<h1>` is two lines tall and centring
          the row would drop the mark below the title's cap line — that is the
          `items-start` case, and the mark takes a 1.5 nudge back down onto the
          cap line. Without one the block is a single line of wordmark and
          `items-center` is what stops the mark sitting visibly low.

          The history is worth keeping: this was `items-start` + the nudge
          unconditionally, back when a subtitle was expected, and every page paid
          an optical correction for a case that never rendered. Then it was
          `items-center` unconditionally. Neither is right once both shapes ship. */}
      {/* The whole lockup is the link home — the mark and the wordmark read as
          one target, so making only one of them clickable would be a smaller
          hit area for no reason. On the home page it points at itself, which is
          what every masthead does and what a reader arriving from an article
          page or the archive expects to find here. */}
      <a
        href={href(lang, "/")}
        aria-label={
          lang === "en" ? "Daily Picks — home" : "每日严选 · 回到首页"
        }
        className="mt-5 flex items-center gap-3 sm:gap-4"
      >
        {/* The mark keeps the size it has always had. THE TEXT IS SIZED TO IT,
            not the other way round: with a subtitle the block beside it has to
            fit inside 44px on a phone and 56px from `sm:` up, which is what the
            `<h1>` below is measured against.

            Enlarging the mark instead was tried and rejected — it takes an 88px
            square to clear a two-line English subtitle, and at that size the
            mark stops introducing the wordmark and starts competing with it. */}
        {/* TWO FILES, ONE SHOWING. The mark has an ink tile on the cream page and
            a cream tile on the dark one, and neither `favicon.svg` nor a single
            file can do that job here: an `<img>` resolves `prefers-color-scheme`
            against the READER'S OS, while this page follows the switch in the row
            above — a reader on a light Mac who chose dark would get the ink tile
            on the dark page and watch its edges disappear.

            So the choice is made outside the image, by the `dark:` variant, which
            index.css defines to mean "the OS unless the reader overrode it". Both
            files are fetched; they are ~1.5KB each and the alternative is a third
            copy of the geometry inlined as JSX.

            `alt=""` on both: the link around them already carries the name. */}
        <img
          src="/mark.svg"
          alt=""
          className="size-11 flex-none sm:size-14 dark:hidden"
        />
        <img
          src="/mark-cream.svg"
          alt=""
          className="hidden size-11 flex-none sm:size-14 dark:block"
        />
        {/* `max-w-md` keeps the wordmark clear of the orange blob.

            TWO TYPE SCALES, PICKED BY WHETHER THERE IS A SUBTITLE. Alone, the
            wordmark is the masthead and is set at the size it always was. Above
            a subtitle it is one of two lines that together must not outgrow the
            mark, so it steps down and gives up its leading — `leading-none` is
            what buys the last few pixels, and a wordmark of two to four glyphs
            is the one string that can afford it. Measured, at the four
            combinations that ship:

                            phone (<sm)        sm and up
              Chinese      24+4+16 = 44/44    30+6+20 = 56/56
              English      24+4+16 = 44/44    30+6+20 = 56/56

            BOTH COLUMNS NOW LAND EXACTLY ON THE MARK, and the gap is what makes
            them: `mt-1` on the phone, `mt-1.5` from `sm:` up. The larger column
            used to run 54 against a 56 mark — two pixels short, which read as the
            text sitting slightly high against a mark that is optically centred on
            it. The gap is the only free variable here; the two type sizes are
            fixed by the scale and `leading-none` has already given up the leading.

            The English subtitle has to stay on ONE line for the phone column to
            hold — see the note on the tagline in lib/i18n.ts. */}
        <h1
          className={`max-w-md font-bold tracking-tight text-ink ${
            subtitle
              ? "text-2xl leading-none sm:text-3xl"
              : "text-4xl leading-tight sm:text-5xl"
          }`}
        >
          {title}
          {subtitle ? (
            /* NOT italic, and it used to be. Italic was right for the
               other-language twin this slot was built for — a single short
               title, set apart from the one above it. What it carries now is a
               whole sentence, and browsers have no italic for CJK: they synthesise
               one by slanting the upright glyphs, which is exactly the artefact a
               15-character Chinese line at 18px shows most. `text-pretty` for the
               English, which wraps to two lines on a phone and must not leave one
               word alone on the second. */
            <small className="mt-1 block text-xs font-medium text-pretty text-ink-mid sm:mt-1.5 sm:text-sm">
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
 * A plain site footer: who made this, and nothing else.
 *
 * Deliberately carries no navigation — that is `EndLink`'s job now — and no
 * longer the tagline either, which moved to the masthead's `subtitle`. The
 * argument is the same one that took navigation out: a line set in 12px grey
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
