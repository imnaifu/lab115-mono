import { NextResponse, type NextRequest } from "next/server";
import { MAIL_RATE_LIMIT } from "@/lib/config";
import { href, isLang, DEFAULT_LANG, type Lang } from "@/lib/lang";
import { absolute, confirmEmail } from "@/lib/mail/render";
import { sendEmail, signupOpen } from "@/lib/mail/resend";
import { confirmToken, looksLikeEmail, normalizeEmail } from "@/lib/mail/token";

/**
 * Step one of double opt-in: take an address and mail it a signed link.
 *
 * NOTHING IS STORED AND NOBODY IS SUBSCRIBED HERE. The address becomes a contact
 * only when the link in that mail is followed — see the confirm page — which is
 * what stops this route from being a way to put a stranger on the list, or to
 * spend the plan's contact allowance on addresses that never asked.
 *
 * `node:crypto` is what forces the runtime declaration below. It would default
 * to nodejs anyway; saying so keeps a future edge default from turning this into
 * a build error nobody expected.
 */
export const runtime = "nodejs";

/**
 * Recent attempts per IP.
 *
 * IN MEMORY, WHICH IS THE RIGHT SIZE FOR THE JOB. The site is one container, so
 * one map is the whole picture; a restart forgets everything, which costs a
 * determined script five minutes it could have had anyway. What this defends is
 * not the list — the confirmation step does that — but the DAILY TRANSACTIONAL
 * QUOTA: every submission spends one send, and a form left unguarded overnight
 * would burn the allowance that the next real reader needs.
 */
const attempts = new Map<string, number[]>();

function rateLimited(ip: string, now: number): boolean {
  const since = now - MAIL_RATE_LIMIT.windowMs;
  const recent = (attempts.get(ip) ?? []).filter((at) => at > since);
  recent.push(now);
  attempts.set(ip, recent);

  // Opportunistic sweep: without it the map holds every IP that ever posted.
  // Cheap because it only runs when the map is already large.
  if (attempts.size > 5_000) {
    for (const [key, times] of attempts) {
      if (times.every((at) => at <= since)) attempts.delete(key);
    }
  }

  return recent.length > MAIL_RATE_LIMIT.max;
}

/** Traefik sets `x-forwarded-for`; the first hop is the client. */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

interface Body {
  email?: unknown;
  lang?: unknown;
  /** Honeypot. A real form leaves it empty; a bot fills every input it finds. */
  hp?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Closed as well as unconfigured — see `signupOpen`. 503 for both: the form is
  // not on the page in either case, so anything arriving here is a direct post,
  // and "temporarily unavailable" tells it no without saying which of the two.
  if (!signupOpen()) {
    return NextResponse.json({ ok: false, reason: "error" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "email" }, { status: 400 });
  }

  // A filled honeypot gets the success answer and no mail. Telling a bot it was
  // detected is telling whoever wrote it what to change.
  if (typeof body.hp === "string" && body.hp.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  if (!looksLikeEmail(email)) {
    return NextResponse.json({ ok: false, reason: "email" }, { status: 400 });
  }

  const lang: Lang = isLang(body.lang as string) ? (body.lang as Lang) : DEFAULT_LANG;

  if (rateLimited(clientIp(request), Date.now())) {
    return NextResponse.json({ ok: false, reason: "rate" }, { status: 429 });
  }

  const url = `${absolute(href(lang, "/mail/confirm"))}?t=${confirmToken(email, lang)}`;

  try {
    const { subject, html, text } = confirmEmail(lang, url);
    await sendEmail({ to: email, subject, html, text });
  } catch (error) {
    // The address never appears in the log. A subscriber list is not something
    // this app keeps, and a log that reconstructs one is the same list with
    // extra steps.
    console.error("[mail] confirmation send failed:", error);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
