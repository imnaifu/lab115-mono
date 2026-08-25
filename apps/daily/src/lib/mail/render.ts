import { categoryOf } from "@/lib/categories";
import { MAIL_TOP_N, SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { articlePath, dayPath } from "@/lib/links";
import { summaryText, totalReadingMinutes } from "@/lib/reading";
import { sourceOf } from "@/lib/sources";
import { shownArticles } from "@/lib/store";
import { summaryFor } from "@/lib/take";
import type { Digest, PublishedArticle } from "@/lib/types";

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

/**
 * `utm_source=email`, and it is the only way this link can be attributed.
 *
 * An email client sends no referrer, so a reader arriving from the inbox is
 * indistinguishable from one who typed the domain — which would make the whole
 * point of the mail unmeasurable. Nothing else is tagged: medium and campaign
 * would be one value each forever.
 */
function tagged(path: string): string {
  return `${absolute(path)}?utm_source=email`;
}

/**
 * One issue: five headlines, each with the sentence that says what it argues.
 *
 * THE MAIL IS A DOORWAY, NOT THE EDITION. The site publishes everything that
 * clears the floor and the writing is meant to be read there; what belongs in an
 * inbox is enough to decide with — the headline, one line, where it came from —
 * and a way through to the rest. See MAIL_TOP_N in lib/config.ts for the whole
 * argument, including the Gmail clipping limit this shape never has to think
 * about.
 *
 * THE COUNTS DESCRIBE THE DAY, NOT THE EMAIL. "15 篇 · 读完约 12 分钟" is what the
 * masthead of the day's page says, computed the same way from the same summaries,
 * because a reader who follows the link has to land on the page those numbers
 * described. The mail carries five of them and the button says so.
 */
export function digestEmail(
  digest: Digest,
  lang: Lang,
): { subject: string; html: string; text: string } {
  const t = strings(lang);
  // `shownArticles`, not `digest.articles`: an article whose summary never came
  // back is not renderable, and it is the same filter the day's page applies —
  // so the mail can never lead with something the page does not show.
  const shown = shownArticles(digest);
  const picked = shown.slice(0, MAIL_TOP_N);
  const [year, month, day] = digest.date.split("-").map(Number);
  // Built from the date key rather than from a Date, so the server's timezone
  // can never shift the weekday by one. Same arithmetic as `formatDate` in
  // DigestView, which is the line this one has to agree with.
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  // Over the WHOLE day and via `summaryText`, both because the masthead the
  // reader is about to land on is computed exactly this way.
  const minutes = totalReadingMinutes(
    shown.map((article) => summaryText(summaryFor(article, lang))),
  );

  const headline = (article: PublishedArticle) =>
    (lang === "zh" && article.titleZh ? article.titleZh : article.title).trim();

  const cards = picked
    .map((article) => {
      const category = categoryOf(article.category);
      const url = tagged(href(lang, articlePath(digest.date, article)));
      return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
<tr><td>
<div style="font:700 12px/1 -apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif;color:${INK_SOFT};letter-spacing:.04em;padding-bottom:8px;">
<span style="display:inline-block;width:7px;height:7px;border-radius:7px;background:${escapeHtml(
        category.accent,
      )};"></span>&nbsp;${escapeHtml(lang === "zh" ? category.name : category.nameEn)}
</div>
<a href="${escapeHtml(url)}" style="font:700 17px/1.4 -apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif;color:${INK};text-decoration:none;">${escapeHtml(
        headline(article),
      )}</a>
<div style="font:400 15px/1.6 -apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif;color:${INK_MID};padding-top:7px;">${escapeHtml(
        summaryFor(article, lang).thesis,
      )}</div>
<div style="font:400 12px/1.5 -apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif;color:${INK_SOFT};padding-top:7px;">${escapeHtml(
        sourceOf(article.sourceId).name,
      )}</div>
</td></tr></table>`;
    })
    .join("");

  const dayUrl = tagged(href(lang, dayPath(digest.date)));
  const bodyHtml = `
<div style="font:400 14px/1.5 -apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif;color:${INK_MID};padding-bottom:4px;">${escapeHtml(
    t.date(year, month, day, weekday),
  )}</div>
<div style="font:600 13px/1.5 -apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif;color:${ORANGE};padding-bottom:22px;">${escapeHtml(
    `${t.posts(digest.stats.shown)} · ${t.readTime(minutes)}`,
  )}</div>
${cards}
${button(dayUrl, t.wholeDay)}
<div style="font:400 12px/1.5 -apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif;color:${INK_SOFT};">${escapeHtml(
    t.wholeDaySub(digest.date, digest.stats.shown),
  )}</div>`;

  /**
   * `{{{RESEND_UNSUBSCRIBE_URL}}}` IS NOT ESCAPED AND MUST NOT BE. It is a
   * placeholder Resend swaps for a per-recipient link as it sends, so escaping
   * the braces would ship the literal text to every reader — and an unsubscribe
   * link that is not a link is the one failure in this whole file that turns a
   * subscriber into a spam complaint.
   */
  const footerHtml = `${escapeHtml(t.mailWhy)}<br>
<a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${INK_SOFT};">${escapeHtml(
    t.mailUnsubscribe,
  )}</a>`;

  const text = [
    t.brand,
    t.date(year, month, day, weekday),
    `${t.posts(digest.stats.shown)} · ${t.readTime(minutes)}`,
    "",
    ...picked.flatMap((article) => [
      `— ${headline(article)}`,
      summaryFor(article, lang).thesis,
      `${sourceOf(article.sourceId).name} · ${tagged(
        href(lang, articlePath(digest.date, article)),
      )}`,
      "",
    ]),
    `${t.wholeDay}: ${dayUrl}`,
    "",
    t.mailWhy,
    `${t.mailUnsubscribe}: {{{RESEND_UNSUBSCRIBE_URL}}}`,
  ].join("\n");

  return {
    subject: t.mailSubject(t.mailShortDate(month, day)),
    // The inbox line under the subject: the top headline, which is the one
    // string that answers "is today's worth opening".
    html: shell({
      lang,
      preheader: picked[0] ? headline(picked[0]) : t.emptyTitle,
      bodyHtml,
      footerHtml,
    }),
    text,
  };
}

export { INK, INK_MID, INK_SOFT, ORANGE, CREAM, PAPER, shell, button };
