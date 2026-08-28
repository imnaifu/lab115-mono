import { MAIL_TOP_N, SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { href, type Lang } from "@/lib/lang";
import { articlePath, dayPath } from "@/lib/links";
import { summaryText, totalReadingMinutes } from "@/lib/reading";
import { sourceOf } from "@/lib/sources";
import { shownArticles } from "@/lib/store";
import { captionFor, summaryFor } from "@/lib/take";
import type { DailyPhoto, Digest, PublishedArticle } from "@/lib/types";

/**
 * The HTML this app puts in an inbox.
 *
 * STRING TEMPLATES, NOT JSX, and the same reasoning as lib/feed.ts: an email
 * client parses a subset of HTML from 2004, so the output is `<table>` and
 * inline `style`, and JSX buys nothing when there are no components and no
 * reactivity — only a build step between you and the bytes that get sent.
 *
 * NOT A RESEND TEMPLATE EITHER, and that was checked rather than assumed.
 * Resend's hosted templates are `{{{VAR}}}` substitution with a ceiling of 20
 * variables and no loops — five cards of four fields each spends the whole
 * allowance before the date line — and the digest goes out as a BROADCAST, which
 * cannot reference a template at all. What a template would buy is a version of
 * this file that lives in a dashboard instead of in git, in two copies because
 * there are two languages, unable to read lib/i18n.ts. See lib/mail/resend.ts.
 *
 * A PLAIN-TEXT PART IS NOT OPTIONAL. A `text/html`-only message scores worse
 * with every spam filter there is, and the alternative here costs a dozen lines
 * because the mail is already a list of short strings.
 *
 * THE LAYOUT IS THE SITE'S, ELEMENT FOR ELEMENT. The masthead is the mark, the
 * wordmark and the tagline (Shell.tsx `Masthead`); a card is the source name in
 * the source's colour, the headline, the thesis, on the card ground
 * (ArticleCards.tsx `ArticleCard`); the way through to the day is a panel with a
 * label, a sub and a round arrow (Shell.tsx `EndLink`); the footer is the brand
 * against lab115.com (Shell.tsx `Footer`). A reader who follows the button has
 * to land somewhere that looks like where they came from.
 *
 * The palette is the site's, written out literally: `src/index.css` declares it
 * as custom properties, and custom properties are exactly the modern CSS an
 * email client will not have.
 *
 * NO COVER IMAGES, and the site's card has one. An email client has no
 * `object-fit`, so the 80px square the page draws would either squash a 16:9
 * cover or letterbox it into two bands of empty colour — and every one of them is
 * a remote fetch a client is free to block, which turns five designed squares
 * into five grey boxes. The card keeps its shape without them.
 *
 * THE DAY'S PHOTOGRAPH IS THE ONE IMAGE THAT DOES GO IN, and the rule above is
 * what says why it can. It is ONE fetch rather than five, it is not cropped to
 * anything — `photoBlock` scales it by width and never states a height it would
 * have to squash to — and a reader who blocks images loses a picture whose own
 * caption is printed underneath it, so the block still reads as a sentence about
 * a photograph rather than as a grey hole where a thumbnail was. A cover is
 * decoration for a card that works without it; the picture of the day is the
 * plate the edition opens on, with words of its own.
 */

/* The palette. Names and values from `@theme` in src/index.css; the light side
   of each `light-dark()` pair, because an inbox has no `color-scheme` to ask and
   the head below pins the message to light for that reason. */
const INK = "#3b3563";
const INK_MID = "#5f5885";
const INK_SOFT = "#8a83a8";
const ORANGE = "#efa050";
/** `--color-page`: the ground the whole message sits on. */
const CREAM = "#fbf3e9";
/** `--color-card`: an article card. */
const CARD = "#f3e8d8";
/** `--color-paper`: a panel — the confirmation's body, the way onward. */
const PAPER = "#fffdf9";
/** `--color-line`, flattened: `rgb()` with an alpha is not safe in Outlook. */
const LINE = "#e2ddd4";

/** `--font-sans`, minus the two webfonts an inbox cannot load. */
const FONT = "-apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif";

/**
 * Type, as FOUR LONGHAND PROPERTIES, never as the `font` shorthand.
 *
 * THE SHORTHAND IS DROPPED BY OUTLOOK, whole, and this file was written in it.
 * Outlook's sanitiser walks every `style` attribute and keeps the declarations it
 * recognises one at a time; the shorthand is not one of them, so all four
 * properties it packs went with it and the message arrived in the client's default
 * face at one size and one weight — no bold headline, no small print, no lockup.
 * Nothing else was lost: the colours, the card grounds, the radii and the padding
 * all survived, which is what made the cause legible. The only things missing were
 * the four inside the shorthand.
 *
 * `leading` is a string so it can be either a multiplier (`"1.4"`) or a fixed box
 * (`"40px"`, which is how the round arrow centres its glyph).
 */
function type(weight: number, size: number, leading: string): string {
  return `font-family:${FONT};font-size:${size}px;font-weight:${weight};line-height:${leading};`;
}

/** `--radius-card`, the one radius every panel on the site uses. */
const RADIUS = "18px";

/**
 * The content column, in px and as a NUMBER because `photoBlock` does arithmetic
 * with it.
 *
 * It was a literal inside `shell` alone until the photograph arrived. An image in
 * an email needs a `width` ATTRIBUTE — Outlook sizes from that and not from the
 * CSS — so a second copy of this number would have been the thing that decides how
 * wide the plate is drawn, and the two would have parted company the first time
 * either moved.
 */
const COLUMN = 600;

/**
 * The tallest the photograph may be drawn, mirroring `max-h-[520px]` on the site's
 * own plate — see the note in Photo.tsx for why that ceiling exists.
 *
 * It is enforced by making a TALL PHOTO NARROWER, never by stating a height: an
 * email client has no `object-fit`, so a height that disagrees with the file's
 * ratio squashes the picture instead of cropping it. Two of fourteen consecutive
 * pictures of the day were portrait at h/w ~ 1.5, which at the full column would
 * be a ~900px plate — the whole first screen of the message, above a single
 * headline.
 */
const PHOTO_MAX_HEIGHT = 520;

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

/** Absolute, because a link in an email has no page to be relative to. */
export function absolute(path: string): string {
  return `${SITE}${path}`;
}

/**
 * The masthead: the mark, the wordmark, the tagline — the page's own lockup.
 *
 * A PNG, NOT `mark.svg`. Gmail strips `<img src="…svg">` outright and Outlook
 * has never rendered one; `icon-192.png` in public/ is the same artwork already
 * rasterised for the manifest, so this costs nothing new to serve.
 *
 * THE MARK IS AS TALL AS THE TWO LINES BESIDE IT — 24 for the wordmark, 5 of gap,
 * 19 for the tagline's line — which is the same rule the poster and the OG card
 * follow and the same one Shell.tsx measures its 44px mark against. It is why the
 * wordmark sets `line-height:1`: leave it at the client's default and the row
 * grows by a third, the sum stops describing anything, and the mark floats
 * against the middle of the block instead of spanning it.
 *
 * `valign="middle"` on both cells rather than `vertical-align` in the style
 * attribute: the attribute is the one of the two Outlook honours.
 *
 * The whole lockup is one link home, exactly as it is on the page.
 */
function masthead(lang: Lang): string {
  const t = strings(lang);
  const home = tagged(href(lang, "/"));
  // Repeated on both lines AND on the anchor: a client that ignores the
  // anchor's `text-decoration` will not ignore the one on the text itself.
  const bare = "text-decoration:none;";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="48" valign="middle" style="padding-right:14px;">
<a href="${escapeHtml(home)}" style="${bare}"><img src="${absolute(
    "/icon-192.png",
  )}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border:0;"></a>
</td>
<td valign="middle">
<a href="${escapeHtml(home)}" style="${bare}display:block;">
<div style="${type(700, 24, "1")}color:${INK};letter-spacing:-.02em;${bare}">${escapeHtml(
    t.brand,
  )}</div>
<div style="${type(500, 13, "19px")}color:${INK_MID};padding-top:5px;${bare}">${escapeHtml(
    t.tagline,
  )}</div>
</a>
</td>
</tr></table>`;
}

/**
 * The copyright year.
 *
 * The site's footer takes it as a prop from a page that renders per request; a
 * send has no such page, and reading the clock at module scope is the smallest
 * honest way to get it. It is one number in fine print — the failure mode on the
 * first of January is a stale year for as long as the process lives, which is
 * shorter than a day for a job that runs and exits.
 */
const SITE_YEAR = String(new Date().getUTCFullYear());

/**
 * The frame every message wears: the masthead, the body, a footer.
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
 *
 * THE FOOTER IS FINE PRINT AND NOTHING ELSE. The site's own footer opens with
 * the wordmark and closes with `© 2026 daily.lab115.com`; this one carries
 * neither, and both were cut for the same reason — a message is not a page you
 * scrolled to the bottom of, it is one screen with the lockup at the top of it.
 * The wordmark was the same two words 34px above, and the domain was in its third
 * place after the mark's link and `mailWhy`. What is left is the link off this
 * brand and the year.
 *
 * The rule moved onto the cell that holds them, so removing the wordmark left no
 * two-column table behind with one empty side.
 *
 * THE COLUMN HAS NO PANEL UNDER IT, and it used to: the whole message sat on a
 * rounded sheet of `--color-paper`. The site does not do that — the masthead and
 * the cards sit directly on `--color-page` — so the sheet was a container the
 * page has no equivalent of, and it flattened the one distinction the cards rely
 * on, which is card ground against page ground.
 */
function shell(options: {
  lang: Lang;
  preheader: string;
  bodyHtml: string;
  footerHtml: string;
}): string {
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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};">
<tr><td align="center" style="padding:32px 16px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${COLUMN}px;">
<tr><td>
${masthead(options.lang)}
</td></tr>
<tr><td style="padding-top:26px;">
${options.bodyHtml}
</td></tr>
<tr><td style="padding-top:34px;border-top:1px solid ${LINE};">
<div align="right" style="${type(500, 12, "1.7")}color:${INK_SOFT};">
<a href="https://lab115.com" style="color:${INK_SOFT};text-decoration:none;">lab115.com</a><br>&copy; ${SITE_YEAR}
</div>
<div style="padding-top:14px;${type(400, 12, "1.7")}color:${INK_SOFT};">
${options.footerHtml}
</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** One tappable pill, as a table so Outlook draws the background. Mirrors the
 *  subscribe form's submit — `rounded-full bg-ink text-paper` on the site. */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 14px;"><tr>
<td style="background:${INK};border-radius:999px;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;${type(700, 15, "1")}color:${PAPER};text-decoration:none;">${escapeHtml(
    label,
  )}</a>
</td></tr></table>`;
}

/**
 * The end-of-message destination, and it is `EndLink` from Shell.tsx: a whole
 * panel with a label, a sub and a round arrow, rather than a line of small type.
 *
 * The arrow's cell is `aria-hidden` on the page for the reason it carries no
 * text here either — the label beside it already names where this goes.
 */
function endLink(url: string, label: string, sub: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};border:1px solid ${LINE};border-radius:${RADIUS};">
<tr><td style="padding:20px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle">
<a href="${escapeHtml(url)}" style="display:block;${type(700, 19, "1.35")}color:${INK};text-decoration:none;">${escapeHtml(
    label,
  )}</a>
<div style="padding-top:4px;${type(500, 13, "1.5")}color:${INK_SOFT};">${escapeHtml(
    sub,
  )}</div>
</td>
<td width="40" valign="middle" align="right">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;background:${INK};border-radius:999px;">
<a href="${escapeHtml(
    url,
  )}" style="display:block;${type(400, 17, "40px")}color:${PAPER};text-decoration:none;">&rarr;</a>
</td>
</tr></table>
</td>
</tr></table>
</td></tr></table>`;
}

/**
 * The double opt-in mail — the only transactional message this app sends.
 *
 * The body sits on a `--color-paper` panel with the site's hairline border,
 * which is the shape the subscribe form and the confirmation page both wear —
 * and it is headed with `t.subscribe`, the same words as the form, rather than
 * with the subject line. The subject reads 「确认订阅每日严选」 and the wordmark is
 * directly above it, so using it here printed the brand name twice in two lines.
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

  const bodyHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};border:1px solid ${LINE};border-radius:${RADIUS};">
<tr><td style="padding:22px 24px;">
<div style="${type(700, 19, "1.35")}color:${INK};">${escapeHtml(
    t.subscribe,
  )}</div>
<div style="padding-top:6px;${type(400, 15, "1.65")}color:${INK_MID};">${escapeHtml(
    t.confirmMailLead,
  )}</div>
${button(confirmUrl, t.confirmMailButton)}
<div style="${type(400, 12, "1.6")}color:${INK_SOFT};word-break:break-all;">${escapeHtml(
    confirmUrl,
  )}</div>
</td></tr></table>`;

  const footerHtml = `${escapeHtml(t.confirmMailExpiry)}<br>${escapeHtml(
    t.confirmMailIgnore,
  )}`;

  const text = [
    t.brand,
    t.tagline,
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

/**
 * `utm_source=email`, and it is the only way this link can be attributed.
 *
 * An email client sends no referrer, so a reader arriving from the inbox is
 * indistinguishable from one who typed the domain — which would make the whole
 * point of the mail unmeasurable. Nothing else is tagged: medium and campaign
 * would be one value each forever.
 */
/**
 * The day's photograph, as the message's opening plate.
 *
 * THE SITE'S CARD, ELEMENT FOR ELEMENT — the picture on the card ground, the
 * caption under it, the credit under that in one step smaller type; see
 * PhotoCard in components/Photo.tsx, which this has to look like for the same
 * reason every other block here does.
 *
 * WIDTH ONLY, NEVER A HEIGHT. `width` is an attribute as well as a style because
 * Outlook reads the attribute; `height:auto` is stated so a client that has its
 * own idea does not stretch the file's ratio. A tall photograph is made narrower
 * — see PHOTO_MAX_HEIGHT — and centred, exactly as it is on the page, so nothing
 * is ever cropped and nothing is ever squashed.
 *
 * THE CREDIT IS A LICENCE CONDITION, NOT A COURTESY, and that is the reason it is
 * in here rather than in a nice-to-have list: most pictures of the day are CC
 * BY-SA and report `AttributionRequired`, so the artist, the source and the licence
 * name have to be visible wherever the photograph is, and an inbox is a place the
 * photograph is. Two links, the same two the page draws: the Commons file page,
 * which holds the full licence notice, and the deed — with the licence name in
 * plain text on the public-domain files, which have no deed to point at.
 *
 * NOT LINKED ON THE PICTURE ITSELF, also as on the page: the credit carries the
 * links, so an image that fails to load takes no destination with it.
 */
function photoBlock(photo: DailyPhoto, lang: Lang): string {
  const t = strings(lang);
  const width = Math.min(
    COLUMN,
    Math.round((PHOTO_MAX_HEIGHT * photo.width) / photo.height),
  );
  const licence = photo.license.url
    ? `<a href="${escapeHtml(photo.license.url)}" style="color:${INK_SOFT};text-decoration:none;">${escapeHtml(
        photo.license.name,
      )}</a>`
    : escapeHtml(photo.license.name);

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CARD};border-radius:${RADIUS};margin:0 0 22px;">
<tr><td align="center" style="padding:0;">
<img src="${escapeHtml(photo.src)}" width="${width}" alt="" style="display:block;width:${width}px;max-width:100%;height:auto;border:0;border-radius:${RADIUS} ${RADIUS} 0 0;">
</td></tr>
<tr><td style="padding:16px 20px 18px;">
<div style="${type(500, 15, "1.65")}color:${INK};">${escapeHtml(captionFor(photo, lang))}</div>
<div style="padding-top:8px;${type(400, 11, "1.6")}color:${INK_SOFT};">
<a href="${escapeHtml(photo.filePage)}" style="color:${INK_SOFT};text-decoration:none;">${escapeHtml(
    `${photo.artist} · ${t.photoSource}`,
  )}</a> · ${licence}
</div>
</td></tr></table>`;
}

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
 *
 * NO CATEGORY ON A CARD, and there used to be one — a coloured dot and 「技术」
 * above every headline. It named a grouping THE MAIL DOES NOT HAVE: the day's
 * page sorts its cards into sections and prints the category once as a heading,
 * while five picks off the top of the ranking arrive in rank order, so the label
 * was a section marker with no section under it. What replaces it is the line the
 * site's own card leads with — the source, in the source's colour.
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
      const source = sourceOf(article.sourceId);
      const url = tagged(href(lang, articlePath(digest.date, article)));
      /* `source.accent` READ DIRECTLY, not through `themedAccent`: that helper
         returns a `light-dark()` pair, which needs a `color-scheme` no inbox
         provides. See the note at the top of lib/accent.ts. */
      return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CARD};border-radius:${RADIUS};margin:0 0 14px;">
<tr><td style="padding:18px 20px;">
<div style="${type(700, 12, "1.4")}color:${escapeHtml(source.accent)};">${escapeHtml(
        source.name,
      )}</div>
<a href="${escapeHtml(
        url,
      )}" style="display:block;padding-top:6px;${type(700, 18, "1.4")}color:${INK};text-decoration:none;">${escapeHtml(
        headline(article),
      )}</a>
<div style="padding-top:9px;${type(400, 15, "1.65")}color:${INK_MID};">${escapeHtml(
        summaryFor(article, lang).thesis,
      )}</div>
</td></tr></table>`;
    })
    .join("");

  const dayUrl = tagged(href(lang, dayPath(digest.date)));
  /* The masthead's meta row, as one line with orange separators — the same
     `date · N 篇新文章 · 读完约 M 分钟` the day's page prints, and `MastheadDot` is
     what the coloured `·` stands in for. The reading time is dropped at zero for
     the same reason DigestView drops it. */
  const dot = `<span style="color:${ORANGE};">&nbsp;·&nbsp;</span>`;
  const meta = [
    escapeHtml(t.date(year, month, day, weekday)),
    escapeHtml(t.posts(digest.stats.shown)),
    ...(minutes > 0 ? [escapeHtml(t.readTime(minutes))] : []),
  ].join(dot);

  /* Above the cards and under the meta row, which is where DigestView puts it —
     the masthead, then the plate, then the day. Conditional because `photo` is
     optional: digests written before photos existed have none, and so does any day
     Wikimedia had nothing usable. Both render as no plate rather than as a gap. */
  const bodyHtml = `
<div style="${type(600, 14, "1.5")}color:${INK_MID};padding-bottom:18px;">${meta}</div>
${digest.photo ? photoBlock(digest.photo, lang) : ""}
${cards}
<div style="padding-top:12px;">
${endLink(dayUrl, t.wholeDay, t.wholeDaySub(digest.date, digest.stats.shown))}
</div>`;

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
    t.tagline,
    "",
    t.date(year, month, day, weekday),
    `${t.posts(digest.stats.shown)}${minutes > 0 ? ` · ${t.readTime(minutes)}` : ""}`,
    "",
    /* The photograph, as the words that came with it. The credit is not dropped
       here either — a text/plain reader is owed the licence the same as anyone,
       and the file page goes in as a URL because there is no anchor to hide it
       in. */
    ...(digest.photo
      ? [
          captionFor(digest.photo, lang),
          `${digest.photo.artist} · ${t.photoSource} · ${digest.photo.license.name}`,
          digest.photo.filePage,
          "",
        ]
      : []),
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

export { INK, INK_MID, INK_SOFT, ORANGE, CREAM, CARD, PAPER, LINE, shell, button };
