import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import type { Lang } from "@/lib/lang";
import { signupOpen } from "@/lib/mail/resend";

/**
 * THE PAGE: a full-width ground, the bar across it, and one centred column.
 *
 * The ground is the body's own `bg-page` and it is not layout — nothing
 * readable is ever laid out against it. What a wide screen gets is the bar's
 * ends (see SiteHeader) and cream either side of the column; what a phone gets
 * is the column, edge to edge, exactly as before.
 *
 * `overflow-x-clip` is kept from when the masthead's blobs bled past this
 * column's edges. The blobs are gone, but a summary can still hold an
 * unbreakable URL and the rule that the document never scrolls sideways is
 * cheaper to keep than to re-establish.
 *
 * NOT ASYNC ANY MORE, and it used to be for one reason: `listDates` answered
 * whether `/archive` exists yet, because the bar carried a link to it. That
 * link is gone (see the nav note in SiteHeader) and so is the read.
 *
 * IT KEEPS ITS OWN FILE, and the reason survives the read that caused it. This
 * was the top of Shell.tsx, where the rest of the chrome lives — and Shell.tsx
 * is imported by client components for its layout constants, which puts the
 * whole module in the browser bundle. `listDates` reaching for
 * `node:fs/promises` two files down failed the build outright then ("the
 * chunking context does not support external modules"), and `signupOpen` below
 * would do the same today: it reads `process.env` through lib/config and lives
 * beside the Resend client. One server-only component, one file; the note at
 * the top of Shell.tsx is the warning not to merge it back.
 */
export function PageShell({
  lang,
  path,
  children,
}: {
  lang: Lang;
  /** The BARE path of this page — the bar's language switch needs it. */
  path: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader
        lang={lang}
        path={path}
        /* ONE GATE IS ASKED HERE NOW, where there were two. `archiveReady` went
           with the bar's archive link — see the nav note in SiteHeader — so this
           component no longer reads `listDates` at all.

           `signupOpen` stays and still has to be answered here: it reads the
           Resend configuration, which is not a question the bar or the
           `"use client"` sheet inside it could ask for itself, and answering it
           in the browser bundle would mean shipping the shape of the key check
           to every reader. */
        signupOpen={signupOpen()}
      />

      <div className="mx-auto w-full max-w-page overflow-x-clip pb-10">
        {children}
      </div>
    </>
  );
}
