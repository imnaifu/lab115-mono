import { PAD } from "./Shell";
import { Subscribe } from "./Subscribe";
import { signupOpen } from "@/lib/mail/resend";
import type { Lang } from "@/lib/lang";

/**
 * The subscribe card, wherever a page offers it: the gate, the page padding and
 * the card, as ONE thing to render.
 *
 * WHY THIS FILE EXISTS. The card was already one component, and every page still
 * repeated the two decisions around it — `signupOpen()` and the `PAD` wrapper —
 * which is five identical lines per call site. Two copies was a duplication; the
 * third one (the article page) would have made it a rule nobody wrote down, and
 * the failure mode is silent either way: a page that forgets the gate renders a
 * form that cannot submit on a deployment with no Resend key, and one that
 * forgets `PAD` renders a card the width of the viewport against every other
 * block on the page.
 *
 * A SERVER COMPONENT WRAPPING A CLIENT ONE, and that split is the reason this is
 * not simply the top of Subscribe.tsx. `signupOpen` reads the Resend configuration
 * from the environment; a `"use client"` file cannot ask that question, and
 * answering it in the browser bundle would mean shipping the answer — and the
 * shape of the key check — to every reader. So the gate stays on the server and
 * the form stays on the client, one file each.
 *
 * WHERE IT GOES ON A PAGE, and it is not one answer any more:
 *
 *   - THE THREE LISTS — front page, archive, article — put it before whatever
 *     sends the reader onward. A reader who has just finished reading is at the
 *     moment they might want tomorrow's delivered, and a block that first offers
 *     them another page has already spent that moment.
 *   - THE DAY'S EDITION puts it at the TOP, under the opening plate and above the
 *     first card. The bottom of that page is the bottom of the whole day's
 *     reading, which is a place many readers never arrive at; the plate is where
 *     everyone starts.
 *
 * `className` EXISTS FOR THAT SECOND CASE. The card carried no margin of its own
 * while it only ever sat between two blocks that supplied their own; under the
 * photograph it sits against a block whose comment says in as many words that it
 * has no bottom margin — see PhotoCard's placement in DigestView — so the caller
 * that puts it there has to say so.
 */
export function SubscribeSection({
  lang,
  className,
}: {
  lang: Lang;
  className?: string;
}) {
  if (!signupOpen()) return null;

  return (
    <div className={className ? `${PAD} ${className}` : PAD}>
      <Subscribe lang={lang} />
    </div>
  );
}
