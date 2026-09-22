import { InstallApp } from "./InstallApp";
import { MenuDrawer } from "./MenuDrawer";
import { SubscribeDialog } from "./SubscribeDialog";
import { ThemeToggle } from "./ThemeToggle";
import { MAIL_TOP_N } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href, otherLang, type Lang } from "@/lib/lang";
import { ABOUT_PATH, TODAY_PATH, TOPIC_PATH } from "@/lib/links";

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
      className="flex cursor-pointer items-center rounded-full border border-line bg-paper p-2 text-ink-mid transition duration-150 ease-out hover:border-ink-soft hover:text-ink active:opacity-80"
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
 * column below is 880px centred (see index.css); a bar whose contents were also
 * 880px wide would put the brand and the controls side by side in the middle of
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
 * below. It was measured off a bar that is FIXED on medium.com, and this one is
 * not any more, so the number is now inherited rather than argued for: it is a
 * height that reads right, and nothing has to clear it.
 *
 * IT NO LONGER STICKS, so it has no z-index and no place in that stacking
 * argument — see the note on the element itself. `PullToRefresh` at z-40 and
 * `BackToTop` at z-30 are unaffected: both are fixed to the viewport and this is
 * now in the flow.
 *
 * A SERVER COMPONENT, like the rest of the chrome — the two controls that hold
 * state are the client boundary and they were already drawing it themselves.
 */
export function SiteHeader({
  lang,
  path,
  signupOpen,
}: {
  lang: Lang;
  /** The BARE path of the page this sits on — what `LangSwitch` needs. */
  path: string;
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
  /**
   * WHICH OF THE TWO NAV ITEMS IS THE PAGE WE ARE ON.
   *
   * `path` is the BARE path — no language prefix, see the prop — so these are
   * compared against the unprefixed forms and are right on both sides of the
   * site with no branch.
   *
   * 今天 IS THE FRONT PAGE ONLY, not "anything dated". A day page and an
   * article page are under the dates, and marking 今天 as current on
   * `/2026/09/21` would be claiming the reader is on the front page when they
   * are two levels below it — the trail and the `← 返回` link are what say where
   * they are there. 话题 covers the hub AND every topic page beneath it, because
   * those genuinely are that section.
   */
  /**
   * THE NAVIGATION, DEFINED ONCE AND RENDERED TWICE — as a row from `sm:` up and
   * inside `MenuDrawer` below it.
   *
   * A drawer that built its own list would be a second place for "which
   * destinations exist" to be decided, and the two would drift within a couple
   * of edits — the phone is exactly where nobody notices.
   *
   * `path` is the BARE path — no language prefix, see the prop — so these
   * comparisons are right on both sides of the site with no branch.
   *
   * 今天 IS THE FRONT PAGE ONLY, not "anything dated". A day page and an article
   * page are under the dates, and marking 今天 as current on `/2026/09/21` would
   * claim the reader is on the front page when they are two levels below it. The
   * other three cover their whole section, because those genuinely are sections.
   */
  const nav = [
    /**
     * 「今天」 → `/today`, WHICH IS A REDIRECT to the newest edition's own URL.
     * It used to point at `/`.
     *
     * THE LABEL DID NOT CHANGE AND THAT IS THE POINT. It was briefly 「今天列表」
     * on the reasoning that the word should say it leads to the list rather than
     * to the front page — which is an explanation, and a nav item that needs one
     * is the wrong fix. 「今天」 is what the destination IS now; the front page
     * was what did not match it.
     *
     * THE HREF IS A CONSTANT ON PURPOSE — see `TODAY_PATH` in lib/links for why
     * the lookup happens on the press rather than in this component. Nothing
     * here reads the filesystem, which is what keeps `PageShell` synchronous.
     *
     * `current` MATCHES A DATED DAY PATH, not `/`. The bare `\d{4}/\d{2}/\d{2}`
     * shape is a day page and nothing else — an article is one segment longer
     * and the archive's months are `/archive/2026-09`. So the item underlines
     * where it actually leads, and the FRONT PAGE now underlines nothing: it is
     * reached from the lockup beside this row, which is where a masthead's home
     * link belongs.
     */
    {
      href: href(lang, TODAY_PATH),
      label: t.navToday,
      current: /^\/\d{4}\/\d{2}\/\d{2}$/.test(path),
    },
    {
      href: href(lang, TOPIC_PATH),
      label: t.navTopics,
      current: path === TOPIC_PATH || path.startsWith(`${TOPIC_PATH}/`),
      topic: true,
    },
    {
      href: href(lang, "/archive"),
      label: t.navArchive,
      current: path === "/archive" || path.startsWith("/archive/"),
    },
    {
      href: href(lang, ABOUT_PATH),
      label: t.navAbout,
      current: path === ABOUT_PATH,
    },
  ];


  return (
    /**
     * NOT STICKY, and it was — `sticky top-0 z-30 bg-page/85 backdrop-blur`.
     *
     * The translucent ground and the blur went with the pinning, because that is
     * the only thing they were for: keeping content legible as it scrolled
     * underneath. On a bar that scrolls away with the page there is never
     * anything behind it, so `bg-page` is the whole background and the blur was
     * a filter applied to nothing.
     *
     * WHAT IT COSTS, and it is worth being plain about it: the four controls in
     * this bar — subscribe, language, theme, install — are now only reachable at
     * the top of the document. On an article page that is a scroll back up.
     * `BackToTop` is fixed at the other end of the screen and shortens that trip
     * to one press, which is the mitigation rather than a coincidence.
     *
     * `z-30` GOES WITH IT. The note above about sitting below `PullToRefresh`'s
     * z-40 and level with `BackToTop` described a bar that shared a stacking
     * context with them; an unpinned header is in the flow and meets neither.
     */
    <header className="border-b border-line bg-page">
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
            {/* THE TAGLINE USED TO BE HERE, on a second line under the
                wordmark from `md:` up, and it is gone by request. The lockup is
                the mark and the name now — nothing else.

                WHAT IT COST WHILE IT EXISTED: it was the longest string in the
                bar by a factor of three, so it decided both breakpoints below,
                and at 768px it was already giving ~166px of itself to an
                ellipsis. A sentence that is cut in half at the width most
                people read at is not making its claim; it is furniture that
                happens to contain words.

                IT IS NOT DELETED, only unhung. `t.tagline` is still the
                `<meta name="description">` on every page and the feed's
                `<subtitle>` — see lib/i18n. What replaced it in the places it
                was DRAWN (the poster, the OG card, the mail masthead) is
                `homeHeading`, which says how many pieces a day rather than what
                the site filters out. */}
          </span>
        </a>

        {/* RIGHT: where the reader can go from any page, then the three controls
            in the order they had in the masthead's row.

            THE WIDTH BUDGET DECIDES WHAT SHOWS AT EACH SIZE. It used to have
            two things that grow in it — a lockup with a whole sentence in it
            and a row of up to five controls — and the sentence is gone (see the
            note in the lockup above), so the lockup is now a CONSTANT:

              mark 28   wordmark 88   →   126px, at every width from `sm:` up
                                          (112px below it: a 24px mark and the
                                          wordmark a type step down)

            THAT REMOVAL ONLY EVER ADDS SLACK, which is why no breakpoint below
            had to be re-derived and none can newly overflow. The tagline was
            278px in English against the Chinese 204 — the widest item in the
            bar by a factor of three — and every sum it appeared in was the
            binding one. The `md:` line was 508 + 12 + 316 = 836px against the
            944px a 1024px viewport leaves after `lg:px-10`, and at the bottom of
            the range a 768px viewport left 712px, so the lockup was handing back
            about 166px to an ellipsis just to fit. It is 508 + 12 + 126 = 646px
            now, inside 712 with room to spare — which is the same floor the old
            note already called "THE FLOOR THAT MATTERS", because it was computed
            for exactly this case: the tagline cut away entirely.

            THE PER-ITEM WIDTHS FOR THE NAV WERE MEASURED IN ENGLISH, which is
            the wider language for every item in the bar, and they were measured
            when the row held a different set of links (Archive, Explore topics,
            Subscribe — 67 / 118 / 101, plus lang 34, theme 34, install 114).
            The row is four named links from `sm:` up now, built from `nav`. Do
            NOT trust those three numbers for a new arithmetic; re-measure if
            something is added. What they still support is the claim above, that
            every current sum is strictly smaller than a sum that already fit.

            THE 72px `Sources` LINK IS OUT OF THESE SUMS, because the section is
            hidden — see SOURCE_PAGES_LIVE in lib/sources. Putting the link back
            means adding 80 to each of them.

            `sm:` IS WHERE THE NAMED LINKS APPEAR. Below it the row is the icons
            only and the four destinations move into `MenuDrawer` — the exact
            complement, so nothing is unreachable at any width.

            NOTHING IS LOST BY HIDING ANY OF THEM. The drawer has the four
            destinations, and the subscribe sheet is a control rather than a
            place. */}
        <nav className="flex items-center gap-2">
          {/**
           * TWO DESTINATIONS, NAMED, AND THE CURRENT ONE IS UNDERLINED.
           *
           * 今天 (`/`) and 话题 (`/topic`) — the site's two axes, which is the
           * whole navigation it needs: everything else is reached from one of
           * them. The topic hub is what keeps the eight subjects out of this row
           * (see `TOPIC_PATH` in lib/links); the front page is what keeps the
           * dates out of it.
           *
           * THE ARCHIVE LINK WAS HERE AND IS GONE. It was the bar's only
           * destination for a long time, gated on `archiveReady`, and what it
           * cost was a nav item that blinks in and out with a content count. The
           * archive is one press further on — the front page's list ends in
           * 「更多文章……」 — and it is in the sitemap, so nothing is orphaned.
           * `archiveReady` WAS A PROP OF THIS COMPONENT and is gone with the
           * link: an unused boolean threaded down from `PageShell` is a question
           * being asked on every page for nobody. Putting the link back means
           * putting the prop back, which is three lines and a `listDates` call
           * `PageShell` already makes.
           *
           * `aria-current="page"` rather than only the underline: a reader who
           * cannot see the rule still gets told which of the two they are on.
           */}
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={`hidden rounded-none px-2 py-1 text-sm font-bold transition duration-150 ease-out hover:text-ink active:opacity-70 sm:block ${
                item.current
                  ? "border-b-2 border-ink text-ink"
                  : "border-b-2 border-transparent text-ink-mid"
              }`}
              /* Only the topic hub carries an event. `TrackEvent` in lib/track is
                 a closed union and TRACKING.md documents every member, so giving
                 the other three one is a change to the analytics contract rather
                 than to the markup — worth doing deliberately, not worth
                 smuggling in behind a nav change. */
              data-track={item.topic ? "topic_open" : undefined}
              data-track-from={item.topic ? "header" : undefined}
              data-track-lang={item.topic ? lang : undefined}
            >
              {item.label}
            </a>
          ))}

          {/**
           * THE SEARCH CONTROL IS GONE, and this note is what is left of it.
           *
           * It was a magnifier linking to `google.com/search?q=site:…` — Google's
           * own box, pre-scoped to this domain — because there is no index here
           * to search: 369 takes in two languages behind a `force-dynamic` server
           * reading JSON off a git clone is not something a `LIKE` walks, and
           * building one is a project (index at publish time, ship a client
           * bundle to query it, own Chinese segmentation for the half of the
           * corpus with no spaces in it).
           *
           * WHAT IT COST while it was here: a control in this site's own chrome
           * that leaves the site. A reader pressing a magnifier in a header
           * expects to search the thing they are looking at, and what they got
           * was google.com — with results limited to whatever Google has
           * crawled, which for the Chinese half of this site has been the
           * standing problem (see the `/zh/…` redirect note in proxy.ts), and
           * nothing at all for a reader without Google.
           *
           * If real search is ever built it belongs here. A link to somebody
           * else's is not a smaller version of it.
           */}

          {/* THE SUBSCRIBE CONTROL, which is a whole component rather than a
              link because pressing it now opens a sheet instead of scrolling to
              a card. Its own file carries the button's styling and the budget
              note's `hidden sm:block`, since the two have to agree. */}
          {signupOpen ? (
            /* `picks` is MAIL_TOP_N, handed down rather than imported by the sheet:
               that file is a client component and lib/config is server-side. See
               the prop's note in SubscribeDialog. */
            <SubscribeDialog lang={lang} picks={MAIL_TOP_N} />
          ) : null}

          {/* THE PHONE'S COPY OF THE FOUR LINKS ABOVE. `sm:hidden` on the
              trigger is the exact complement of their `hidden sm:block`, so
              exactly one of the two is on screen at any width. */}
          <MenuDrawer lang={lang} items={nav} />

          <LangSwitch lang={lang} path={path} />
          <ThemeToggle label={t.themeToggle} />
          <InstallApp lang={lang} />
        </nav>
      </div>
    </header>
  );
}
