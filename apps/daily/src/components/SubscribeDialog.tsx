"use client";

import { useEffect, useRef, useState } from "react";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import { track } from "@/lib/track";

/**
 * The subscribe control and the sheet it opens: one input, one button, and
 * whatever the server said.
 *
 * IT USED TO BE A CARD ON THE PAGE — `Subscribe` inside `SubscribeSection`,
 * rendered near the end of all six list pages, with the bar's 订阅 button as an
 * `<a href="#subscribe">` that scrolled to it. That arrangement is gone in both
 * halves: the form is a modal now, and the cards it used to be are removed, so
 * subscribing has exactly one surface and the bar's button is the whole of it.
 *
 * WHY A MODAL. The card had to sit somewhere on a page whose subject is
 * something else, so it was always an interruption placed by guessing where the
 * reader would tolerate one — the note that used to live in SubscribeSection
 * spent three paragraphs on that guess, and the answer differed per page. A
 * sheet has no such position: it appears when it is asked for and it is the only
 * thing on screen while it is open.
 *
 * WHAT IT LOSES, and it is worth being honest about: the card at the end of a
 * digest caught readers at the moment they had just finished reading, which is
 * the moment they might want tomorrow's. Nothing replaces that. The bar is on
 * screen for the whole page instead, which is a different and weaker kind of
 * always-available.
 *
 * THE SHAPE IS GHOST'S PORTAL, which is what was asked for — a centred mark, the
 * publication's name, its one line about itself, a labelled field and one
 * full-width button. What is NOT taken from it is everything that only makes
 * sense for a paid newsletter: the Monthly/Yearly switch, the two pricing tiers,
 * "Already a member? Sign in", "Gift a membership". This is one free list, so a
 * tier card reading $0 would be a choice with one option.
 *
 * A CLIENT COMPONENT, which on this site needs a reason: it holds the four
 * submit states, the dialog's open state, and it has to show the outcome without
 * navigating away — which a plain `<form action>` cannot do without turning the
 * whole page into a POST target.
 *
 * The success message keeps the address on screen. "Check your email" is the
 * moment a reader wonders whether they typed it right, and the answer is a
 * string we already have.
 */
type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

/** The field's id, so the visible label can point at it. A constant because a
 *  label whose `htmlFor` misses its input is a label that silently does
 *  nothing — the same failure the `#subscribe` anchor this replaces had. */
const FIELD_ID = "subscribe-email";

/**
 * WHERE THE TRIGGER IS, which is the only thing that varies — one sheet, two
 * ways in.
 *
 *   `bar`     the pill in the site header. Unchanged, including `hidden
 *             sm:block`: the width budget in SiteHeader has the arithmetic.
 *   `inline`  a block at the end of an article: the pitch, the sub-line and one
 *             button. Visible at EVERY width.
 *
 * THE `inline` VARIANT IS WHAT MAKES THIS SITE SUBSCRIBABLE ON A PHONE AT ALL.
 * The note at the top of this file recorded that cost plainly — "below 640px
 * this site cannot be subscribed to" — as the price of moving the form into a
 * modal and deleting the cards. That trade was about WHERE a form sits on a
 * page whose subject is something else; it was never an argument for having no
 * entry point, and on a site where most readers arrive on a phone from a shared
 * link it was the more expensive half of the change.
 *
 * AND IT PUTS THE ASK BACK AT THE MOMENT IT WORKS. The other thing that note
 * gives up — "the card at the end of a digest caught readers at the moment they
 * had just finished reading, which is the moment they might want tomorrow's" —
 * is exactly this position, on the one page where finishing is unambiguous. A
 * reader at the foot of an article page has read one whole take.
 *
 * NOT A POPUP, and never on a timer or an exit intent. It is a block in the
 * document flow, below the summary and below the related reading, and a reader
 * who does not want it scrolls past it once.
 */
export type SubscribeVariant = "bar" | "inline";

export function SubscribeDialog({
  lang,
  variant = "bar",
  picks,
}: {
  lang: Lang;
  variant?: SubscribeVariant;
  /**
   * How many pieces the mail carries — `MAIL_TOP_N`, PASSED IN rather than
   * imported.
   *
   * This is a client component, and lib/config is a server-side module holding
   * (among a hundred literals) the values read out of `process.env`. Importing
   * it here to read one number would pull that whole module into the browser
   * bundle. Both call sites are server components and already have it.
   *
   * Optional, and the pitch falls back to the site's tagline without it — which
   * is what the sheet said before this copy existed. A number is a promise, and
   * a promise nobody handed us is one this component must not invent.
   */
  picks?: number;
}) {
  const t = strings(lang);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  // The element's open state is imperative, so it is driven from the state
  // rather than duplicated — same as InstallApp and ShareSheet next door.
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  /**
   * Every close reported back up, with a NATIVE listener: Escape and the
   * backdrop close the element without React hearing about it, and `close` does
   * not bubble, so `open` would stay stuck true and the next press would be a
   * no-op. The same bug, and the same fix, as in InstallApp and ShareSheet.
   */
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const sync = () => setOpen(false);
    node.addEventListener("close", sync);
    return () => node.removeEventListener("close", sync);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending" });

    let outcome = "error";
    try {
      const response = await fetch("/api/mail/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lang, hp: honeypot }),
      });
      const body = (await response.json()) as { ok?: boolean; reason?: string };

      if (body.ok) {
        outcome = "ok";
        setState({ kind: "sent", email });
      } else {
        outcome = body.reason ?? "error";
        setState({
          kind: "error",
          message:
            outcome === "email"
              ? t.subscribeBadEmail
              : outcome === "rate"
                ? t.subscribeTooMany
                : t.subscribeError,
        });
      }
    } catch {
      // A dropped connection reads the same as a server error from here, and the
      // reader's move is the same either way: try again in a minute.
      setState({ kind: "error", message: t.subscribeError });
    }

    track("mail_subscribe", { outcome, lang });
  }

  return (
    <>
      {/* THE TRIGGER, and the one filled control on the page's chrome — `bg-ink`
          because it is the only thing in that row which is not navigation.

          `subscribeGo` (订阅 / Subscribe), not `subscribe` (订阅邮件 / Subscribe
          by email): the long one is 44px more bar in English than the row can
          spare, and it is the sheet's accessible name below instead.

          `hidden sm:block` — the width budget in SiteHeader has the arithmetic.
          A phone gets no subscribe control at all now that the page carries no
          card either, which is the one real cost of this change and is recorded
          here rather than buried: below 640px this site cannot be subscribed to.

          NO `data-track` ON THE OPEN. `TrackEvent` in lib/track.ts is a closed
          union and TRACKING.md documents every member, so counting a press here
          is a change to the analytics contract rather than to the markup. It is
          now a more interesting number than it was — an open with no submit
          after it is a reader who looked at the form and left, which the old
          scroll-to-card could never distinguish — so it is worth doing
          deliberately rather than smuggling in behind a layout change. */}
      {variant === "bar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hidden cursor-pointer rounded-full bg-ink px-4 py-1.5 text-sm font-bold text-paper sm:block transition duration-150 ease-out hover:bg-ink-mid active:bg-ink-mid"
        >
          {t.subscribeGo}
        </button>
      ) : (
        /**
         * THE END-OF-ARTICLE BLOCK. Hairlines and the page's own ground, not a
         * raised card: the article above it is a `bg-card` plate, and a second
         * plate under it reads as a second article rather than as the page
         * finishing. The dashed rule is the one piece of decoration here and it
         * is doing a job — it says "this is not more of the piece you were
         * reading" without a heading having to say it.
         *
         * THE PITCH IS A HEADING, not body copy, because it is an offer rather
         * than a sentence in the argument above it. `<h2>`: it is a section of
         * this document and a screen reader ought to be able to jump to it.
         */
        <div className="rounded-card border border-dashed border-line px-5 py-6 text-center">
          <h2 className="text-xl font-bold tracking-tight text-pretty text-ink">
            {picks ? t.subscribePitch(picks) : t.tagline}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed font-medium text-pretty text-ink-mid">
            {t.subscribePitchSub}
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 cursor-pointer rounded-full bg-ink px-6 py-2.5 text-base font-bold text-paper transition duration-150 ease-out hover:bg-ink-mid active:bg-ink-mid"
          >
            {t.subscribeCta}
          </button>
        </div>
      )}

      <dialog
        ref={dialog}
        /* The backdrop is the dialog's own box, so a click that lands on the
           element rather than on the card inside it is a click outside. */
        onClick={(event) => {
          if (event.target === dialog.current) setOpen(false);
        }}
        /* `subscribe` (订阅邮件), which the visible heading no longer says: the
           heading is the publication's name, Ghost-style, and a sheet whose
           accessible name is also just the brand tells a screen reader nothing
           about why it opened. */
        aria-label={t.subscribe}
        /* THE SAME BOX AS THE OTHER TWO MODALS, to the class. The note on
           InstallApp's dialog says why — modals of different widths on one site
           read as an accident — and this is the third. */
        className="m-auto max-h-[90vh] w-[min(92vw,24rem)] overflow-y-auto rounded-card border border-line bg-paper p-0 shadow-soft backdrop:bg-black/40"
      >
        <div className="flex flex-col p-5">
          {/* THE CLOSE, AS A GLYPH, which is the one place this diverges from the
              site's other two sheets — they spell 关闭 out in the corner of a
              heading row. This sheet has no heading row to put it in: the mark
              and the name are centred, so a word in the top right would be the
              only thing on that line. `aria-label` carries what the glyph
              cannot. If the other two ever move to a glyph, they should take
              this class with them. */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.close}
            className="-mt-1 -mr-1 cursor-pointer self-end text-lg leading-none text-ink-soft transition duration-150 ease-out hover:text-ink active:opacity-70"
          >
            ✕
          </button>

          {state.kind === "sent" ? (
            /* Announced rather than silently swapped in: the input this replaces
               had focus, and a reader using a screen reader would otherwise be
               left on a control that no longer exists with no idea whether it
               worked. */
            <div className="pt-2 pb-2 text-center" role="status">
              <div className="text-xl font-bold text-ink">
                {t.confirmedTitle}
              </div>
              <p className="mt-2 text-sm font-medium text-ink-soft">
                {t.subscribeSent(state.email)}
              </p>
            </div>
          ) : (
            <>
              {/* The lockup, centred — the bar's arrangement stood on its side.
                  TWO FILES, ONE SHOWING, for the reason given wherever this mark
                  appears: an `<img>` resolves `prefers-color-scheme` against the
                  READER'S OS, while this page follows the switch in the bar, so
                  the choice is made by the `dark:` variant instead. `width`/
                  `height` because neither file declares an intrinsic size — see
                  the note in SiteHeader for what that costs when they are
                  missing. */}
              <div className="flex flex-col items-center text-center">
                <img
                  src="/mark.svg"
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 dark:hidden"
                />
                <img
                  src="/mark-cream.svg"
                  alt=""
                  width={40}
                  height={40}
                  className="hidden size-10 dark:block"
                />
                <div className="mt-3 text-xl font-bold tracking-tight text-ink">
                  {t.brand}
                </div>
                {/* THE OFFER, WHERE THE TAGLINE USED TO BE.

                    The tagline is the site's one claim about ITSELF, and it is
                    already in the bar directly above this sheet and in every
                    `<meta name="description">` — so in here it was saying a
                    thing the reader had just read, in the one place where the
                    question is not "what is this site" but "what do I get if I
                    hand over my address". Those are different sentences and this
                    slot only ever fits one.

                    The count comes from `picks` — see the prop, and see
                    `subscribePitch` in lib/i18n for the old hardcoded 「五条」
                    this interpolation exists to avoid repeating. Without one the
                    tagline is still the fallback, which is exactly what this
                    line was. */}
                <p className="mt-1.5 text-base font-bold text-pretty text-ink">
                  {picks ? t.subscribePitch(picks) : t.tagline}
                </p>
                <p className="mt-1.5 text-sm font-medium text-pretty text-ink-mid">
                  {t.subscribePitchSub}
                </p>
              </div>

              <form onSubmit={submit} className="mt-5 flex flex-col gap-2">
                {/* The honeypot. `hidden` rather than off-screen positioning: a
                    bot reads the DOM and fills every input it finds, and a person
                    never sees this one. `tabIndex={-1}` and `autoComplete="off"`
                    keep a password manager and a keyboard user out of it. */}
                <input
                  type="text"
                  name="company"
                  value={honeypot}
                  onChange={(event) => setHoneypot(event.target.value)}
                  hidden
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden
                />

                {/* A VISIBLE LABEL, where the card had only a placeholder and an
                    `aria-label`. Ghost's portal labels the field and it is the
                    better of the two: a placeholder is gone the moment there is
                    text in the box, so the one thing telling a returning reader
                    what they half-typed disappears exactly when they look for
                    it. The placeholder is dropped rather than kept — a label and
                    a placeholder saying the same words is one of them wasted. */}
                <label
                  htmlFor={FIELD_ID}
                  className="text-xs font-bold text-ink-mid"
                >
                  {t.subscribeEmail}
                </label>
                <input
                  id={FIELD_ID}
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  /* Autofocused, because a sheet the reader deliberately opened
                     has exactly one thing in it to do. `<dialog>` moves focus
                     into the modal on `showModal()` regardless; this makes it
                     land on the field rather than on the close button, which is
                     the first focusable child. */
                  autoFocus
                  className="w-full min-w-0 rounded-full border border-line bg-page px-4 py-3 text-base text-ink"
                />
                <button
                  type="submit"
                  disabled={state.kind === "sending"}
                  /* Full width, unlike the card's side-by-side row: there is no
                     horizontal space to share in a 24rem sheet, and it is the
                     only action in here. */
                  className="mt-1 w-full cursor-pointer rounded-full bg-ink px-6 py-3 text-base font-bold text-paper disabled:opacity-60 transition duration-150 ease-out hover:bg-ink-mid active:bg-ink-mid"
                >
                  {/* `subscribeCta` (每天发给我), not `subscribeGo` (订阅).
                      This is the SUBMIT, and a submit button reads better as
                      what the reader gets than as what they are doing — it also
                      restates the frequency at the last moment before the press,
                      which is the last thing anyone hesitates over. The bar's
                      pill keeps the short word: it is an ENTRANCE, and it has
                      44px less room than these five characters need. */}
                  {state.kind === "sending"
                    ? t.subscribeSending
                    : t.subscribeCta}
                </button>

                {/* ONLY WHEN THERE IS SOMETHING TO SAY. This line used to carry
                    the unsubscribe note when idle and the error when there was
                    one, so the error arrived in a slot the eye had already
                    learned to skip. With the note gone the row appears only on
                    failure, which is the one thing here worth interrupting for.
                    `role="status"` stays: it is announced when it appears, and it
                    appears because something went wrong. */}
                {state.kind === "error" ? (
                  <p
                    className="mt-1 text-xs font-medium text-ink-soft"
                    role="status"
                  >
                    {state.message}
                  </p>
                ) : null}
              </form>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
