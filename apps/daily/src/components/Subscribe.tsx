"use client";

import { useState } from "react";
import { SECTION } from "./Shell";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import { track } from "@/lib/track";

/**
 * The subscribe card: one input, one button, and whatever the server said.
 *
 * SHAPED LIKE `EndLink` because it sits where EndLink sits and does the same
 * kind of job — the end-of-page decision about what happens next. The reader who
 * has finished the day's cards is at the one moment they might want tomorrow's
 * delivered, and a form in the footer, at footer weight, is a form nobody sees.
 *
 * A CLIENT COMPONENT, which on this site is a thing that needs a reason: every
 * page is server-rendered and the language is a route parameter, so almost
 * nothing here holds state. This holds four states and has to show the outcome
 * without navigating away, which a plain `<form action>` cannot do without
 * turning the whole page into a POST target.
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

export function Subscribe({ lang }: { lang: Lang }) {
  const t = strings(lang);
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

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

  if (state.kind === "sent") {
    return (
      <div
        className={`${SECTION} rounded-card border border-line bg-paper px-6 py-5`}
        // Announced rather than silently swapped in: the input this replaces had
        // focus, and a reader using a screen reader would otherwise be left on a
        // control that no longer exists with no idea whether it worked.
        role="status"
      >
        <div className="text-xl font-bold text-ink">{t.confirmedTitle}</div>
        <p className="mt-1 text-sm font-medium text-ink-soft">
          {t.subscribeSent(state.email)}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={`${SECTION} rounded-card border border-line bg-paper px-6 py-5`}
    >
      <div className="text-xl font-bold text-ink">{t.subscribe}</div>
      <p className="mt-1 text-sm font-medium text-ink-soft">{t.subscribeSub}</p>

      {/* The honeypot. `hidden` rather than off-screen positioning: a bot reads
          the DOM and fills every input it finds, and a person never sees this
          one. `tabIndex={-1}` and `autoComplete="off"` keep a password manager
          and a keyboard user out of it. */}
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

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t.subscribeEmail}
          aria-label={t.subscribeEmail}
          autoComplete="email"
          inputMode="email"
          className="min-w-0 flex-1 rounded-full border border-line bg-cream px-4 py-3 text-base text-ink placeholder:text-ink-soft"
        />
        <button
          type="submit"
          disabled={state.kind === "sending"}
          className="flex-none rounded-full bg-ink px-6 py-3 text-base font-bold text-paper disabled:opacity-60"
        >
          {state.kind === "sending" ? t.subscribeSending : t.subscribeGo}
        </button>
      </div>

      <p className="mt-3 text-xs font-medium text-ink-soft" role="status">
        {state.kind === "error" ? state.message : t.subscribeNote}
      </p>
    </form>
  );
}
