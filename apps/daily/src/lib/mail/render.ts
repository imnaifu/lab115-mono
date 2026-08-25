import { SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

/**
 * The HTML this app puts in an inbox.
 *
 * STRING TEMPLATES, NOT JSX, and the same reasoning as lib/feed.ts: an email
 * client parses a subset of HTML from 2004, so the output is `<table>` and
 * inline `style`, and JSX buys nothing when there are no components and no
 * reactivity — only a build step between you and the bytes that get sent.
 *
 * A PLAIN-TEXT PART IS NOT OPTIONAL. A `text/html`-only message scores worse
 * with every spam filter there is, and the alternative here costs a dozen lines
 * because the mail is already a list of short strings.
 *
 * The palette is the site's, written out literally: `src/index.css` declares it
 * as custom properties, and custom properties are exactly the modern CSS an
 * email client will not have.
 */

const INK = "#3b3563";
const INK_MID = "#5f5885";
const INK_SOFT = "#8a83a8";
const ORANGE = "#efa050";
const CREAM = "#fbf3e9";
const PAPER = "#fffdf9";

/**
 * `&` FIRST, or the entities written by the later replacements get their own
 * ampersand escaped a second time. Same order and same reason as `escapeXml` in
 * lib/feed.ts.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The frame every message wears: the wordmark, the body, a footer.
 *
 * `preheader` is the line a client shows next to the subject in the inbox list.
 * Hidden in the message itself — the two-part trick below is `display:none` plus
 * enough zero-width space to stop the client scavenging the first real sentence
 * instead. It is the second most-read string in the whole email and it has no
 * visible home, which is why it looks like this.
 *
 * `footerHtml` rather than a flag: a broadcast has to carry an unsubscribe link
 * and a transactional confirmation must NOT — an unsubscribe control on a
 * message someone has not yet subscribed to is a control that cannot mean
 * anything.
 */
function shell(options: {
  lang: Lang;
  preheader: string;
  bodyHtml: string;
  footerHtml: string;
}): string {
  const t = strings(options.lang);
  return `<!doctype html>
<html lang="${options.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:${CREAM};">
<div style="display:none;font-size:1px;color:${CREAM};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(
    options.preheader,
  )}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};">
<tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${PAPER};border-radius:18px;">
<tr><td style="padding:28px 26px 8px;">
<div style="font:700 20px/1.3 -apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif;color:${INK};letter-spacing:-.01em;">${escapeHtml(
    t.brand,
  )}</div>
</td></tr>
<tr><td style="padding:0 26px 26px;">
${options.bodyHtml}
</td></tr>
<tr><td style="padding:0 26px 26px;">
<div style="border-top:1px solid rgba(59,53,99,.14);padding-top:16px;font:400 12px/1.6 -apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif;color:${INK_SOFT};">
${options.footerHtml}
</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** One tappable button, as a table so Outlook draws the background. */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr>
<td style="background:${INK};border-radius:999px;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font:700 15px/1 -apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif;color:${PAPER};text-decoration:none;">${escapeHtml(
    label,
  )}</a>
</td></tr></table>`;
}

/**
 * The double opt-in mail — the only transactional message this app sends.
 *
 * The URL is spelled out under the button as well. A confirmation whose only
 * control is a styled anchor is unclickable in a client that strips the styling
 * and unreadable in one that shows plain text, and this link is the entire
 * point of the message.
 */
export function confirmEmail(
  lang: Lang,
  confirmUrl: string,
): { subject: string; html: string; text: string } {
  const t = strings(lang);

  const bodyHtml = `
<div style="font:400 16px/1.65 -apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif;color:${INK_MID};">${escapeHtml(
    t.confirmMailLead,
  )}</div>
${button(confirmUrl, t.confirmMailButton)}
<div style="font:400 13px/1.6 -apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif;color:${INK_SOFT};word-break:break-all;">${escapeHtml(
    confirmUrl,
  )}</div>`;

  const footerHtml = `${escapeHtml(t.confirmMailExpiry)}<br>${escapeHtml(
    t.confirmMailIgnore,
  )}`;

  const text = [
    t.brand,
    "",
    t.confirmMailLead,
    confirmUrl,
    "",
    t.confirmMailExpiry,
    t.confirmMailIgnore,
  ].join("\n");

  return {
    subject: t.confirmSubject,
    html: shell({ lang, preheader: t.confirmMailLead, bodyHtml, footerHtml }),
    text,
  };
}

/** Absolute, because a link in an email has no page to be relative to. */
export function absolute(path: string): string {
  return `${SITE}${path}`;
}

export { INK, INK_MID, INK_SOFT, ORANGE, CREAM, PAPER, shell, button };
