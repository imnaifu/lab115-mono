import { MAIL_FROM, MAIL_REPLY_TO, MAIL_SEGMENT, RESEND_API_KEY } from "@/lib/config";
import type { Lang } from "@/lib/lang";

/**
 * The four Resend calls this app makes, and nothing else.
 *
 * PLAIN `fetch`, NOT THE `resend` SDK, which apps/xhs-watcher does use. Two
 * reasons and the second is the load-bearing one. This talks to four endpoints
 * and the wrapper below is shorter than the dependency's own type stubs. And the
 * endpoints it needs are the ones Resend has just reshaped — Audiences became
 * Segments, contacts went global, `audience_id` became `segment_id` — so pinning
 * a package version here means pinning a snapshot of a moving API and finding out
 * from a type error rather than from the docs. `daily`'s dependency list is six
 * lines long and this is not worth a seventh.
 *
 * WHAT LIVES AT THE OTHER END: the subscriber list, the unsubscribe links and
 * the bounce suppression. See the note in lib/config.ts for why none of that is
 * in this repo.
 */

const API = "https://api.resend.com";

/** Off, not broken: no key means no form on the page and no send after a run. */
export function mailEnabled(): boolean {
  return Boolean(RESEND_API_KEY);
}

/** What Resend puts in an error body. Every field optional on purpose — this is
 *  parsed from a failure, which is the worst moment to throw on a shape. */
interface ApiError {
  statusCode?: number;
  name?: string;
  message?: string;
}

export class ResendError extends Error {
  constructor(
    readonly status: number,
    /** Resend's own error name, e.g. `rate_limit_exceeded`. */
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ResendError";
  }
}

/** 429 and 5xx are worth another go; a 4xx is the same answer every time. */
const RETRY_STATUS = (status: number) => status === 429 || status >= 500;
const BACKOFF_MS = [1_000, 4_000];

/**
 * One API call, with retries.
 *
 * The key is only ever a header. It is never interpolated into a URL, a message
 * or a log line, so nothing here needs the redaction that lib/repo.ts needs for
 * git remotes.
 */
async function call<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  let last: unknown;

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      // A timeout or a dropped socket, which retries like a 5xx.
      last = error;
      const wait = BACKOFF_MS[attempt];
      if (wait === undefined) throw last;
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }

    if (response.ok) {
      // 204 and friends: nothing to parse, and callers that want a body ask for
      // one from an endpoint that returns it.
      const text = await response.text();
      return (text ? JSON.parse(text) : {}) as T;
    }

    const detail = (await response.json().catch(() => ({}))) as ApiError;
    const error = new ResendError(
      response.status,
      detail.name ?? "unknown_error",
      detail.message ?? `HTTP ${response.status}`,
    );

    if (!RETRY_STATUS(response.status)) throw error;
    const wait = BACKOFF_MS[attempt];
    if (wait === undefined) throw error;
    console.warn(
      `[mail] ${method} ${path} → ${response.status} ${error.code}, ` +
        `retrying in ${wait / 1000}s`,
    );
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

/**
 * One transactional email — in this app, only ever the confirmation link.
 *
 * NOT how the digest goes out. A broadcast is metered against the contact count
 * and this against a daily message quota, which is exactly the right way round:
 * one confirmation per signup is a trickle, and the daily edition would eat a
 * per-message allowance alive.
 */
export async function sendEmail(message: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string }> {
  return call<{ id: string }>("POST", "/emails", {
    from: MAIL_FROM,
    reply_to: MAIL_REPLY_TO,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}

/**
 * Put a confirmed address on the list, or bring a returning one back.
 *
 * TWO CALLS BECAUSE ONE ENDPOINT CANNOT DO BOTH. `POST /contacts` creates, and
 * what it does with an address already on file is not something the docs commit
 * to — so the second call is not an optimisation, it is the branch that handles a
 * reader who unsubscribed in March and signed up again in August. The PATCH sets
 * `unsubscribed: false`, which is the only thing standing between that reader and
 * a list they are on but never receive.
 *
 * ONE KNOWN GAP: `PATCH /contacts/{email}` documents `unsubscribed`, the names
 * and `properties` — but not `segments`. So a reader who first subscribed on the
 * Chinese side and later confirms from the English one gets their `lang` property
 * updated and stays in the segment they were created in, i.e. keeps receiving
 * Chinese. Rare, recoverable by hand in the dashboard, and not worth guessing an
 * endpoint over — if it turns out to happen, the fix is whatever Resend's
 * add-contact-to-segment call is, verified first.
 */
export async function subscribeContact(
  email: string,
  lang: Lang,
  segmentId: string,
): Promise<"created" | "updated"> {
  try {
    await call("POST", "/contacts", {
      email,
      unsubscribed: false,
      segments: [segmentId],
      properties: { lang },
    });
    return "created";
  } catch (error) {
    // Anything the API refuses outright — the address is already a contact being
    // much the likeliest — is retried as an update. A PATCH that also fails
    // throws, and the confirm page says the link did not work, which is honest.
    if (!(error instanceof ResendError) || error.status >= 500) throw error;
    await call("PATCH", `/contacts/${encodeURIComponent(email)}`, {
      unsubscribed: false,
      properties: { lang },
    });
    return "updated";
  }
}

interface Broadcast {
  id: string;
  name?: string;
  status?: string;
}

/**
 * Every broadcast name Resend knows about.
 *
 * THIS IS THE IDEMPOTENCY KEY, and it is why the send needs no local state. A
 * day's edition is named `daily-<date>-<lang>`, so "has this already gone out"
 * is a question the API can answer — which matters because `runDaily` is
 * re-runnable by design and a second run must not mail the list twice.
 *
 * Paginated at 100. A daily site makes two a day, so the first page covers seven
 * weeks and the loop below is for the archive's sake rather than today's.
 */
export async function broadcastNames(): Promise<Set<string>> {
  const names = new Set<string>();
  let after: string | undefined;

  for (;;) {
    const query = new URLSearchParams({ limit: "100" });
    if (after) query.set("after", after);
    const page = await call<{ data?: Broadcast[]; has_more?: boolean }>(
      "GET",
      `/broadcasts?${query}`,
    );

    const rows = page.data ?? [];
    for (const row of rows) if (row.name) names.add(row.name);
    if (!page.has_more || rows.length === 0) return names;
    after = rows[rows.length - 1].id;
  }
}

/**
 * Create one edition and send it in the same call.
 *
 * `send: true` rather than create-then-send: two calls would leave a draft
 * behind whenever the second one failed, and a draft named `daily-2026-08-25-zh`
 * is exactly what `broadcastNames` would then read as "already sent".
 */
export async function sendBroadcast(edition: {
  name: string;
  segmentId: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string }> {
  return call<{ id: string }>("POST", "/broadcasts", {
    name: edition.name,
    segment_id: edition.segmentId,
    from: MAIL_FROM,
    reply_to: MAIL_REPLY_TO,
    subject: edition.subject,
    html: edition.html,
    text: edition.text,
    send: true,
  });
}

/**
 * The segment id for a language, or null when that side is not set up yet.
 *
 * Every caller goes through here rather than indexing MAIL_SEGMENT, so the
 * "" case is handled once: an empty id would otherwise reach the API as a
 * broadcast addressed to no segment at all.
 */
export function segmentFor(lang: Lang): string | null {
  return MAIL_SEGMENT[lang] || null;
}
