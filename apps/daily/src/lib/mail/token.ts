import { createHmac, timingSafeEqual } from "node:crypto";
import { MAIL_CONFIRM_TTL_HOURS, MAIL_SECRET } from "@/lib/config";
import { isLang, type Lang } from "@/lib/lang";

/**
 * The confirmation link, as a signed string rather than a row in a table.
 *
 * THIS IS WHERE THE PENDING STATE LIVES. Double opt-in normally needs somewhere
 * to keep "this address asked, and has not confirmed yet" — a file, a table, a
 * repo — plus something to expire the rows nobody ever clicked. Put the same
 * facts in a token the reader carries, sign them, and the storage disappears:
 * the address, the language and the deadline are all in the link, and an
 * unconfirmed signup leaves nothing behind to clean up.
 *
 * It also means an unconfirmed address is never a contact in Resend, so nobody
 * can spend somebody else's plan quota — or put a stranger on the list — by
 * typing an address into the form.
 *
 * WHAT THIS IS NOT: an unsubscribe token. Unsubscribing is Resend's, through the
 * per-recipient link in every broadcast, and it works for a reader whose
 * subscription predates any key we hold. Rotating MAIL_SECRET therefore costs at
 * most one day of unclicked confirmation links and can never strand a reader.
 */

/** The only purpose there is, named anyway so a second one can never be
 *  forged out of the first: a token signed for `confirm` says so inside the
 *  signature, not just in the route that happens to read it. */
const PURPOSE = "confirm";

interface Payload {
  /** Normalized address — see `normalizeEmail`. */
  e: string;
  /** Which language the reader was reading when they subscribed. */
  l: Lang;
  /** Expiry, epoch SECONDS. Seconds rather than milliseconds only to keep the
   *  token short; nothing here needs sub-second resolution. */
  x: number;
  p: typeof PURPOSE;
}

/**
 * The form of an address that gets signed, compared and sent to Resend.
 *
 * Lowercased and trimmed, and NOTHING ELSE. No dot-stripping, no `+tag`
 * removal: those are Gmail's rules, not the internet's, and applying them would
 * silently merge two addresses that a different provider treats as two people.
 * The local part is case-sensitive per RFC 5321 and case-insensitive in every
 * mail system anyone actually runs, so lowercasing is the one normalization that
 * is safe in practice and prevents `A@b.com` and `a@b.com` becoming two
 * contacts.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Good enough to reject a typo, deliberately not an RFC 5322 parser.
 *
 * The real validation is the confirmation mail: an address that does not exist
 * never comes back, so nothing this misses can reach the list. What a regex is
 * for here is catching `naifu@` before it costs a send.
 */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email) && email.length <= 254;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", MAIL_SECRET).update(payload).digest("base64url");
}

/**
 * A token for `email`, valid for MAIL_CONFIRM_TTL_HOURS.
 *
 * `now` is injectable so the expiry can be tested without waiting a day.
 */
export function confirmToken(
  email: string,
  lang: Lang,
  now = new Date(),
): string {
  const payload: Payload = {
    e: normalizeEmail(email),
    l: lang,
    x: Math.floor(now.getTime() / 1000) + MAIL_CONFIRM_TTL_HOURS * 3600,
    p: PURPOSE,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/**
 * The address and language inside a token, or null.
 *
 * ONE RETURN VALUE FOR EVERY KIND OF FAILURE — bad signature, expired, mangled
 * by a mail client, wrong purpose — because the page that calls this can say
 * exactly one useful thing either way ("you're subscribed" / "this link is no
 * longer valid"), and a caller that cannot act on the difference should not be
 * handed it. The distinction that WOULD matter operationally, an expired link
 * versus a forged one, is not worth a second code path on a route that gets a
 * handful of hits a day.
 */
export function readConfirmToken(
  token: string,
  now = new Date(),
): { email: string; lang: Lang } | null {
  // An unset secret must never verify anything. Without this the HMAC is still
  // computed — over an empty key — so a token minted by the same broken config
  // would sail through, and the one place that is reachable is a deploy where
  // MAIL_SECRET was forgotten.
  if (!MAIL_SECRET) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  // Length has to match before the constant-time compare: timingSafeEqual throws
  // on a length mismatch rather than returning false, and an exception here is a
  // 500 where the honest answer is "invalid link".
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.p !== PURPOSE) return null;
  if (!isLang(payload.l)) return null;
  if (typeof payload.e !== "string" || !looksLikeEmail(payload.e)) return null;
  if (typeof payload.x !== "number") return null;
  if (payload.x * 1000 < now.getTime()) return null;

  return { email: payload.e, lang: payload.l };
}
