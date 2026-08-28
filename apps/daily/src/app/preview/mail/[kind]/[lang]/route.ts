import { notFound } from "next/navigation";
import { absolute, confirmEmail, digestEmail } from "@/lib/mail/render";
import { href, isLang } from "@/lib/lang";
import { readDigest, readLatest } from "@/lib/store";

/**
 * One rendered email, as the bytes an inbox would get: `/preview/mail/digest/zh`.
 *
 * THE ONLY ARTIFACT ROUTE THIS PREVIEW NEEDS. The share posters and the OG cards
 * are already served by `/share/[lang]/[date]/[id]/[part]` and `/og/[lang]/[name]`
 * — the same URLs the site and the crawlers use — so the sheet links straight at
 * those rather than rendering a second copy of them. An email has no address of
 * its own anywhere, which is why this exists and they do not.
 *
 * DEV ONLY. The gate is in proxy.ts, which turns every `/preview` path into a 404
 * outside development, and the check below is the backstop for the day someone
 * edits that matcher — see the note there. Nothing here is secret; it is a tool
 * that has no business answering on the public site.
 *
 * `?date=` picks the digest, defaulting to the newest, the same way the sheet does.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; lang: string }> },
) {
  if (process.env.NODE_ENV === "production") notFound();

  const { kind, lang } = await params;
  if (!isLang(lang)) notFound();

  if (kind === "confirm") {
    /**
     * A token that is deliberately not a real one. `confirmToken` in lib/mail/token
     * signs against MAIL_SECRET, which a preview has no business reading and which
     * is empty on most machines this runs on — and the link is here to be LOOKED
     * at, not followed. Clicking it lands on the expired-link page, which is itself
     * worth seeing.
     */
    const url = `${absolute(href(lang, "/mail/confirm"))}?t=preview.not.a.real.token`;
    return html(confirmEmail(lang, url).html);
  }

  if (kind !== "digest") notFound();

  const date = new URL(request.url).searchParams.get("date");
  const digest = date ? await readDigest(date) : await readLatest();
  if (!digest) notFound();

  return html(digestEmail(digest, lang).html);
}

/** `no-store`, because the whole point is to re-render what the code does now. */
function html(body: string): Response {
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
