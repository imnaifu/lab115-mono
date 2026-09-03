import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import type { Lang } from "@/lib/lang";
import { signupOpen } from "@/lib/mail/resend";
import { hasArchive } from "@/lib/paging";
import { listDates } from "@/lib/store";

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
 * ASYNC, and it is the one read this component does: `listDates` answers
 * whether `/archive` exists yet, which the bar has to know on every page. Doing
 * it here rather than in the bar keeps the question in the place that already
 * knows which page it is wrapping.
 *
 * ITS OWN FILE, AND THAT IS THE READ'S FAULT. This was the top of Shell.tsx,
 * which is where the rest of the chrome lives — and Shell.tsx is imported by
 * `Subscribe.tsx`, a client component, for one layout constant. That import
 * puts the whole module in the browser bundle, so `listDates` reaching for
 * `node:fs/promises` two files down failed the build outright: "the chunking
 * context does not support external modules". Splitting the one server-reading
 * component out is the fix; the note at the top of Shell.tsx is the warning not
 * to merge it back.
 */
export async function PageShell({
  lang,
  path,
  children,
}: {
  lang: Lang;
  /** The BARE path of this page — the bar's language switch needs it. */
  path: string;
  children: ReactNode;
}) {
  const dates = await listDates();

  return (
    <>
      <SiteHeader
        lang={lang}
        path={path}
        archiveReady={hasArchive(dates.length)}
        /* BOTH GATES ARE ASKED HERE, on the server, and handed down as
           booleans. `signupOpen` reads the Resend configuration and
           `listDates` reads the clone — neither is a question the bar or the
           `"use client"` sheet inside it could ask for itself, and answering
           them in the browser bundle would mean shipping the shape of the key
           check to every reader.

           `hasSubscribe` used to be a third prop of this component, for the one
           page that carried no subscribe card. No page carries one now — the
           form is a modal in the bar — so there is nothing left to vary. */
        signupOpen={signupOpen()}
      />

      <div className="mx-auto w-full max-w-page overflow-x-clip pb-10">
        {children}
      </div>
    </>
  );
}
