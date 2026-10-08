import { CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_D1_TOKEN } from "@/lib/config";
import type { Lang } from "@/lib/lang";

/**
 * The signup log, in Cloudflare D1: who was sent a confirmation link, and who
 * followed one.
 *
 * THE ONE PLACE THIS APP KEEPS ADDRESSES, and the reason is a failure, not a
 * feature. Double opt-in was built to hold no pending state at all — it lives in
 * the signed token the reader carries — and that was fine until every token was
 * refused (an empty MAIL_SECRET; see `signupOpen`). The readers it caught had
 * asked to subscribe, and the only record that they had was Resend's send log,
 * which forgets after 30 days. This is the record that does not.
 *
 * APPEND-ONLY. A row per event, never an update, so the table is a history and
 * "who never confirmed" is a query rather than a column somebody has to keep in
 * step — README has the SQL. Read it in the D1 console; nothing in the app reads
 * it back.
 *
 * BEST EFFORT, NEVER IN THE WAY. A missing token or a Cloudflare outage logs a
 * line and returns. The signup itself — the mail, the confirmation, the contact
 * in Resend — must not depend on a backstop, or the backstop becomes the next
 * thing that breaks it. Nothing here throws.
 *
 * Plain `fetch` against the D1 REST API, no Worker and no SDK, for the reason
 * lib/mail/resend.ts gives: two calls do not justify a dependency.
 */

const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`;

const SCHEMA = `CREATE TABLE IF NOT EXISTS signups (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  at    TEXT NOT NULL,
  email TEXT NOT NULL,
  lang  TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('sent', 'confirmed'))
);
CREATE INDEX IF NOT EXISTS signups_email ON signups (email);`;

export type SignupEvent = "sent" | "confirmed";

/** What D1 answers with. Every field optional — this is read on failure too. */
interface D1Response {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
}

async function query(sql: string, params: string[] = []): Promise<void> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_D1_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
    // Short on purpose: the subscribe POST waits on this, and a reader should
    // not sit on a spinner because Cloudflare is slow.
    signal: AbortSignal.timeout(5_000),
  });
  const body = (await response.json().catch(() => ({}))) as D1Response;
  if (!response.ok || body.success === false) {
    const detail = body.errors?.map((error) => error.message).join("; ");
    throw new Error(`D1 ${response.status}: ${detail || "no detail"}`);
  }
}

/**
 * The table, created on first use rather than by a migration step someone has
 * to remember. Once per process; a failure clears the memo so the next signup
 * tries again instead of inheriting a rejected promise forever.
 */
let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  schemaReady ??= query(SCHEMA).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

/** Append one event. `email` is expected already normalized (`normalizeEmail`). */
export async function recordSignup(
  event: SignupEvent,
  email: string,
  lang: Lang,
): Promise<void> {
  if (!CF_D1_TOKEN) return;
  try {
    await ensureSchema();
    await query(
      "INSERT INTO signups (at, email, lang, event) VALUES (?, ?, ?, ?)",
      [new Date().toISOString(), email, lang, event],
    );
  } catch (error) {
    // No address in the line: this log is not where the list lives, D1 is.
    console.error(`[mail] signup log (${event}) failed:`, error);
  }
}
