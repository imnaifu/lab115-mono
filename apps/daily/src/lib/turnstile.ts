import { TURNSTILE_SECRET } from "@/lib/config";

/**
 * Server half of Cloudflare Turnstile on the subscribe form.
 *
 * WHAT IT GUARDS. Every accepted POST spends a transactional send on Resend's
 * daily quota and writes a row to the signup log. The honeypot stops the
 * laziest scripts and the per-IP limit stops one machine; neither stops a
 * script that spreads itself over addresses, and this does.
 *
 * THREE ANSWERS, NOT TWO, and the third is the design decision:
 *
 *   pass       Cloudflare said success.
 *   fail       Cloudflare said no — a missing, forged, expired or reused token.
 *              The POST is refused.
 *   unchecked  Cloudflare could not be asked: timeout, network error, a 5xx.
 *              The POST goes through. A captcha that is down must not close the
 *              list to everyone, and the IP limit is still in front of it.
 *
 * NO SECRET, NO CHECK — logged once, not silently. The empty MAIL_SECRET that
 * broke every confirmation link for weeks is why this says so out loud. And the
 * site key in lib/turnstile-key.ts has to be set in the SAME deploy: a page that
 * never renders a widget, talking to a server that demands a token, refuses
 * every signup.
 */

/** Cloudflare's always-pass test secret, paired with the test site key. */
const TEST_SECRET = "1x0000000000000000000000000000000AA";

const SECRET =
  TURNSTILE_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : TEST_SECRET);

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let warnedUnconfigured = false;

export type TurnstileResult = "pass" | "fail" | "unchecked";

export async function verifyTurnstile(
  token: string,
  remoteIp: string,
): Promise<TurnstileResult> {
  if (!SECRET) {
    if (!warnedUnconfigured) {
      console.warn("[mail] TURNSTILE_SECRET is empty — subscribe form is not bot-checked");
      warnedUnconfigured = true;
    }
    return "unchecked";
  }
  // Nothing to ask about: the page never got a token. That is a fail, not an
  // outage — a bot posting straight to the endpoint looks exactly like this.
  if (!token) return "fail";

  const form = new URLSearchParams({ secret: SECRET, response: token });
  if (remoteIp !== "unknown") form.set("remoteip", remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.error(`[mail] turnstile verify → HTTP ${response.status}, letting it through`);
      return "unchecked";
    }
    const body = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (body.success) return "pass";
    console.warn(`[mail] turnstile refused: ${(body["error-codes"] ?? []).join(",") || "no code"}`);
    return "fail";
  } catch (error) {
    console.error("[mail] turnstile verify unreachable, letting it through:", error);
    return "unchecked";
  }
}
