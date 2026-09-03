import { InstallApp } from "./InstallApp";
import { SubscribeDialog } from "./SubscribeDialog";
import { ThemeToggle } from "./ThemeToggle";
import { strings } from "@/lib/i18n";
import { href, otherLang, type Lang } from "@/lib/lang";
import { archivePath } from "@/lib/paging";

/**
 * The translate mark: the glyph on the language switch.
 *
 * A SYMBOL RATHER THAN THE WORDS. The control used to spell both languages out —
 * 中文 / EN — which is the one thing an icon cannot do, and it is why the pair
 * survived as long as it did. What decided it is that the button now has exactly
 * one destination and the row it sits in is otherwise icons: see LangSwitch below
 * for the first, and the budget note on the masthead's control row for the second.
 *
 * The accessible name carries what the glyph cannot — see `langSwitch` in
 * lib/i18n.ts, which names the language it goes to in that language's own script.
 */
function TranslateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 flex-none" aria-hidden>
      <path
        fill="currentColor"
        d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"
      />
    </svg>
  );
}

/**
 * The language switch: ONE link to the other language.
 *
 * `path` is the BARE path of the page it sits on — `/d/2026-08-14`, or `/` for
 * the home page — and this points at the same page in the other language.
 *
 * STILL AN `<a>` AND NOT A BUTTON, for the reasons the pair had: the destination
 * shows on hover, right-click and open-in-new-tab work, and nothing here has to
 * cross a client boundary to know where it goes.
 *
 * WHAT THE PAIR COST is why it collapsed into one. Half of it was always a dead
 * control — the current language linking to the page you were already on — which
 * had to be excluded from the tracking by hand so that pressing it would not
 * inflate the one number the event exists to answer. With two languages there is
 * only ever one destination, so a toggle states it once and every press of it is
 * a real switch.
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
 *
 * FOLLOWING IT IS WHAT REMEMBERS THE CHOICE, and nothing in here knows that.
 * `proxy.ts` writes the language cookie from whatever URL the reader lands on, so
 * an ordinary navigation is the whole mechanism — there is no handler, no
 * `document.cookie`, and this stays a server component.
 */
export function LangSwitch({ lang, path }: { lang: Lang; path: string }) {
  const target = otherLang(lang);
  // The label is in the language being READ, naming the one it goes to.
  const label = strings(lang).langSwitch;

  return (
    <a
      href={href(target, path)}
      hrefLang={target}
      aria-label={label}
      title={label}
      data-track="lang_switch"
      data-track-to={target}
      /* ThemeToggle's shell, to the class. The two are the same size of control
         doing the same kind of job, and drifting apart would show — they sit
         side by side. */
      className="flex cursor-pointer items-center rounded-full border border-line bg-paper p-2 text-ink-mid"
    >
      <TranslateIcon />
    </a>
  );
}

/**
 * THE SITE BAR: the one thing on the page that spans the whole viewport, split
 * left and right — the brand at the page's left edge, everything you can do
 * from anywhere at its right.
 *
 * IT IS NOT CONSTRAINED TO THE READING COLUMN, and that is the point of it. The
 * column below is 750px centred (see index.css); a bar whose contents were also
 * 750px wide would put the brand and the controls side by side in the middle of
 * a wide screen with empty bar either side of them, which reads as a header that
 * has lost its ends. So the bar's gutter is the page's, not the column's.
 *
 * WHAT IT TOOK OVER, and where each piece came from. The lockup and the three
 * controls both lived in `Masthead` — the lockup as a 44/56px mark beside a
 * wordmark set at `text-4xl`, the controls as a row pinned to the top right of
 * the CONTENT column because the masthead's two blobs owned the literal corner.
 * Both were per-page furniture that repeated identically on all seven pages, and
 * a bar is where a reader looks for them. The blobs went with the move: they
 * were decoration around a lockup that is no longer there.
 *
 * STICKY, which the old masthead could not be — it was 200px of header. This one
 * is 76px, so it can stay on screen for the length of a digest without being the
 * page. `bg-page/85` + `backdrop-blur` rather than an opaque bar: the ground
 * behind it is the page's own cream/indigo, and a hard edge scrolling over the
 * content reads as a second window.
 *
 * THE 76 IS MEDIUM'S, measured rather than eyeballed — see the note on the row
 * below. Anything that has to clear this bar is sized off that number and is
 * listed there too.
 *
 * `z-30`, deliberately BELOW `PullToRefresh`'s z-40 and level with `BackToTop`.
 * The refresh indicator drops from the top of the screen and has to come over
 * this; the back-to-top button lives at the other end and never meets it.
 *
 * A SERVER COMPONENT, like the rest of the chrome — the two controls that hold
 * state are the client boundary and they were already drawing it themselves.
 */
export function SiteHeader({
  lang,
  path,
  archiveReady,
  signupOpen,
}: {
  lang: Lang;
  /** The BARE path of the page this sits on — what `LangSwitch` needs. */
  path: string;
  /**
   * Whether `/archive` is a page yet. It 404s until the site holds more days
   * than the front page shows (see `hasArchive` in lib/paging), so this link has
   * to be able to not exist — the same condition the front page's end-of-page
   * card has always carried.
   *
   * A BOOLEAN RATHER THAN THE DATES, because that is the whole of what the bar
   * needs to know; `PageShell` does the one read and answers the question.
   */
  archiveReady: boolean;
  /**
   * Whether this deployment can take a signup at all — `signupOpen()` in
   * lib/mail/resend, asked on the server by `PageShell` and passed down.
   *
   * False on a deployment with no Resend key, where the form's POST would fail,
   * so the control is not rendered rather than rendered and broken. It arrives
   * as a boolean because the answer is an environment question and this
   * component's one child that could ask it is a `"use client"` file — which
   * would mean shipping the shape of the key check to every reader.
   */
  signupOpen: boolean;
}) {
  const t = strings(lang);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur">
      {/* THE PAGE'S GUTTER, WIDENING WITH THE SCREEN: `px-4` on a phone is the
          same 16px every block in the column uses (`PAD`), `sm:px-7` matches
          that gutter's own step, and `lg:px-10` is the one place this layout
          spends width the column does not have — on a desktop the bar's ends
          belong at the page's ends. */}
      {/* 75px, WHICH IS MEDIUM'S BAR — measured on medium.com rather than
          guessed: its fixed top bar is 76px, made of 75px of content box and the
          same 1px bottom border this one has, with 25px of padding above and
          below the row inside it. So `h-[75px]` here plus the border on the
          `<header>` above comes to the same 76.

          ONE HEIGHT AT EVERY WIDTH, where this was `h-14 sm:h-16` (56/64px).
          The bar's contents change with the viewport — the tagline appears at
          `md:`, the two links at `sm:` — but its height no longer does, which is
          what "the same height as Medium" has to mean if it is to mean anything
          at the width someone is actually reading at.

          AN ARBITRARY VALUE, deliberately. 75px is not on the spacing scale
          (`h-19` would be 76px and would swallow the border, coming to 76 total
          only by accident of `box-sizing`), and rounding it to a scale step to
          avoid the brackets would be losing the one property this class exists
          to state. */}
      <div className="flex h-[75px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
        {/* LEFT: THE WHOLE LOCKUP — the mark, the wordmark and the line that
            says what the site is. All three used to be the page's masthead; the
            bar is where they live now, so a reader learns what they have landed
            on from the chrome rather than from whichever page they arrived at.

            STILL THE POSTER'S ARRANGEMENT, mark then wordmark, and still one
            target: the mark and the words read as one thing, so making only
            part of it clickable would be a smaller hit area for no reason.

            THE MARK IS SMALLER THAN THE BLOCK BESIDE IT, which is a reversal.
            The masthead sized its 44/56px mark TO the text and the old note here
            recorded why enlarging it instead was rejected — at 88px it "stops
            introducing the wordmark and starts competing with it". At 24/28px it
            is now smaller than the two lines it introduces (roughly 38px of
            wordmark over tagline), which is the normal proportion for a lockup
            this size and was asked for directly. The bar has room for more since
            it went to 76px; that is not a reason to spend it. */}
        <a
          href={href(lang, "/")}
          aria-label={
            lang === "en" ? "Daily Picks — home" : "每日严选 · 回到首页"
          }
          className="flex min-w-0 items-center gap-2.5"
        >
          {/* TWO FILES, ONE SHOWING, for the reason spelled out where this
              lockup came from: an `<img>` resolves `prefers-color-scheme`
              against the READER'S OS, and this page follows the switch three
              controls to the right. `dark:` is redefined in index.css to mean
              "the OS unless the reader overrode it". */}
          {/* `width`/`height` ATTRIBUTES, not just the size utility, and they are
              load-bearing rather than tidiness. Neither mark file declares a
              width or a height — both are a bare `viewBox="0 0 64 64"` — so an
              `<img>` of one has NO intrinsic size, and a browser that has the
              markup but not yet the matching CSS rule falls back to the default
              size for a replaced element. With `flex-none` beside it that image
              takes the whole row and squeezes the `min-w-0` text block next to
              it to zero width: the bar renders as a giant mark and no wordmark
              at all. Which is not hypothetical — renaming this class from
              `size-7` to `size-6 sm:size-7` produced exactly that in a tab
              holding the previous stylesheet.

              The attributes also give the browser the aspect ratio before the
              CSS arrives, which is what stops the bar reflowing on a cold load.
              The utilities still decide the rendered size; these two only decide
              what happens when they are missing. */}
          <img
            src="/mark.svg"
            alt=""
            width={28}
            height={28}
            className="size-6 flex-none sm:size-7 dark:hidden"
          />
          <img
            src="/mark-cream.svg"
            alt=""
            width={28}
            height={28}
            className="hidden size-6 flex-none sm:size-7 dark:block"
          />
          <span className="min-w-0">
            <span className="block truncate text-base leading-tight font-bold tracking-tight text-ink sm:text-lg">
              {t.brand}
            </span>
            {/* THE TAGLINE, FROM `md:` UP — see the width budget on the controls
                below. It is the first thing this site claims about itself and it
                belongs beside the name, but it is also the longest string in the
                bar by a factor of three, and a phone has no room for it at any
                weight. Nothing is lost there: it is still the
                `<meta name="description">` and the feed's subtitle on every page
                (see `tagline` in lib/i18n.ts).

                `md:` AND NOT `lg:`, WHICH IS A CORRECTION. It was gated at
                `lg:` on the grounds that 768px leaves the row only 2px of slack
                — true, and the wrong thing to protect against, because
                `truncate` plus the `min-w-0` above means the squeeze ends in an
                ellipsis rather than in an overflow. Gating on the width where
                the sentence fits UNCUT hid it from every window between 768 and
                1024, which is a common size to read at and the one this was
                tested in.

                `truncate` rather than a wrap, because a bar that grows a second
                line of tagline at some awkward width is a bar whose height
                depends on the translation. */}
            <span className="hidden truncate text-xs leading-tight font-medium text-ink-mid md:block">
              {t.tagline}
            </span>
          </span>
        </a>

        {/* RIGHT: where the reader can go from any page, then the three controls
            in the order they had in the masthead's row.

            THE WIDTH BUDGET DECIDES WHAT SHOWS AT EACH SIZE, and there are
            three sizes because the bar holds two things that grow — a lockup
            with a whole sentence in it and a row of up to five controls. Every
            number below was read off the rendered bar in ENGLISH, which is the
            wider language for every item in it (its tagline is 278px against
            the Chinese 204):

              mark 28   wordmark 88   tagline 278
              Archive 67   Subscribe 101
              lang 34   theme 34   install 114

            THE 72px `Sources` LINK IS OUT OF THESE SUMS, because the section is
            hidden — see SOURCE_PAGES_LIVE in lib/sources. Every total below is
            72 + 8 lighter than it was; putting the link back means adding 80 to
            each of them, and the `sm:` line is the one that then stops working.

            So the lockup is 28 + 10 + 278 = 316px with the tagline and 126px
            without, and the nav is 382px with both links (its four 8px gaps
            included), 307px with only Subscribe, or 198px with none.

            `md:` AND UP — everything shows. 382 + 12 + 316 = 710px against the
            944px a 1024px viewport leaves after `lg:px-10`. At the bottom of the
            range a 768px viewport leaves 712px, so the lockup gives up about
            40px of tagline to an ellipsis — which is what it is built to do: it
            is `truncate` inside `min-w-0`, so the sentence yields before
            anything overflows. Gating instead on the width where the tagline
            fits UNCUT is what hid it from every window between 768 and 1024,
            and that was the wrong thing to protect.

            `sm:` TO `md:` — Subscribe stays; Archive and the tagline do not.
            307 + 12 + 126 = 445px against the 584px a 640px viewport leaves.
            Archive could in fact join it here now that Sources is gone (382 + 12
            + 126 = 520px, inside 584px) and is deliberately left at `md:`: with
            the section restored the three of them want 600px against 584px, and
            a breakpoint that has to move back and forth with a feature flag is
            worse than one that is right in both states.

            BELOW `sm:` — the icons only. 112 + 12 + 198 = 322px against the
            361px a 393px phone leaves after `px-4` (the lockup is 112 rather
            than 126 there: a 24px mark and the wordmark a type step down).

            NOTHING IS LOST BY HIDING ANY OF THEM. The tagline is still the
            `<meta name="description">` and the feed's subtitle on every page;
            the archive and the directory both still have their end-of-page card
            on the front page; and the subscribe card the button scrolls to is on
            the page already. */}
        <nav className="flex items-center gap-2">
          {archiveReady ? (
            <a
              href={href(lang, archivePath(1))}
              className="hidden rounded-full px-2 py-1 text-sm font-bold text-ink-mid md:block"
              /* `from` separates the three ways into the archive: the front
                 page's card, the archive's own pager, and this bar — which is
                 the only one of them that exists on every page. See
                 TRACKING.md. */
              data-track="archive_open"
              data-track-from="header"
            >
              {t.archiveTitle}
            </a>
          ) : null}

          {/* THE BLOG DIRECTORY WAS HERE, and it is gone with the section — see
              SOURCE_PAGES_LIVE in lib/sources. Removed rather than gated on the
              flag: a hidden section should not leave a conditional `null` in a
              nav row, and the row's width budget below is measured on what
              actually renders. Putting it back is this element plus its entry in
              that budget. */}

          {/* THE SUBSCRIBE CONTROL, which is a whole component rather than a
              link because pressing it now opens a sheet instead of scrolling to
              a card. Its own file carries the button's styling and the budget
              note's `hidden sm:block`, since the two have to agree. */}
          {signupOpen ? <SubscribeDialog lang={lang} /> : null}

          <LangSwitch lang={lang} path={path} />
          <ThemeToggle label={t.themeToggle} />
          <InstallApp lang={lang} />
        </nav>
      </div>
    </header>
  );
}
