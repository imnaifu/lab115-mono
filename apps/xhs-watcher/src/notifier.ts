/**
 * Email delivery via Resend.
 *
 * The mail has to stand on its own: xsec_token in note links expires after a
 * while, so the digest embeds cover, title, author and stats rather than being
 * a bare list of URLs.
 */
import { Resend } from "resend";
import { config } from "./config.js";
import { noteUrl } from "./normalize.js";
import type { StoredNote } from "./db.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function groupByKeyword(notes: StoredNote[]): Map<string, StoredNote[]> {
  const groups = new Map<string, StoredNote[]>();
  for (const note of notes) {
    const bucket = groups.get(note.keyword);
    if (bucket) bucket.push(note);
    else groups.set(note.keyword, [note]);
  }
  return groups;
}

function formatTime(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(epochMs));
}

function renderNote(note: StoredNote): string {
  const url = noteUrl(note.noteId, note.xsecToken);
  const title = escapeHtml(note.title || "(无标题)");
  const author = escapeHtml(note.authorName ?? "未知作者");
  const time = formatTime(note.publishedAt ?? note.firstSeenAt, config.timezone);
  const cover = note.coverUrl
    ? `<td width="96" valign="top" style="padding-right:12px">
         <a href="${escapeHtml(note.coverUrl)}"><img src="${escapeHtml(note.coverUrl)}"
           width="96" alt="" style="width:96px;border-radius:8px;display:block"></a>
       </td>`
    : "";

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:0 0 18px;border-bottom:1px solid #eee;padding-bottom:14px">
    <tr>
      ${cover}
      <td valign="top">
        <a href="${escapeHtml(url)}"
           style="font-size:15px;font-weight:600;color:#1a1a1a;text-decoration:none;line-height:1.45">
          ${title}
        </a>
        <div style="margin-top:6px;font-size:12px;color:#888">
          ${author} · ❤ ${note.likedCount} · ${time}
        </div>
      </td>
    </tr>
  </table>`;
}

function renderDigest(notes: StoredNote[]): { html: string; text: string } {
  const groups = groupByKeyword(notes);
  const sections: string[] = [];
  const lines: string[] = [];

  for (const [keyword, groupNotes] of groups) {
    sections.push(`
      <h2 style="font-size:14px;color:#ff2442;margin:26px 0 12px;letter-spacing:.02em">
        # ${escapeHtml(keyword)} <span style="color:#bbb;font-weight:400">(${groupNotes.length})</span>
      </h2>
      ${groupNotes.map(renderNote).join("")}`);

    lines.push(`# ${keyword} (${groupNotes.length})`);
    for (const note of groupNotes) {
      lines.push(`- ${note.title || "(无标题)"} — ${note.authorName ?? "未知作者"}`);
      lines.push(`  ${noteUrl(note.noteId, note.xsecToken)}`);
    }
    lines.push("");
  }

  const html = `
  <div style="max-width:640px;margin:0 auto;padding:24px 20px;
              font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#1a1a1a">
    <div style="font-size:12px;color:#999;margin-bottom:4px">xhs-watcher</div>
    <div style="font-size:18px;font-weight:600">发现 ${notes.length} 条新笔记</div>
    ${sections.join("")}
    <div style="margin-top:28px;font-size:11px;color:#bbb;line-height:1.6">
      链接含时效性 token，建议尽快查看。<br>
      本邮件由 xhs-watcher 自动发送，仅推送公开搜索结果的元数据。
    </div>
  </div>`;

  return { html, text: lines.join("\n") };
}

async function send(subject: string, html: string, text: string): Promise<void> {
  if (!config.mail.apiKey || config.mail.to.length === 0) {
    // Dry-run: keeps local development working without credentials.
    console.warn(`[mail] 未配置 RESEND_API_KEY / MAIL_TO，跳过发送。标题：${subject}`);
    console.warn(text);
    return;
  }

  const resend = new Resend(config.mail.apiKey);
  const { error } = await resend.emails.send({
    from: config.mail.from,
    to: config.mail.to,
    subject,
    html,
    text,
  });
  if (error) throw new Error(`Resend 发送失败：${error.message}`);
  console.log(`[mail] 已发送「${subject}」→ ${config.mail.to.join(", ")}`);
}

export async function sendDigest(notes: StoredNote[]): Promise<void> {
  const { html, text } = renderDigest(notes);
  const keywords = [...groupByKeyword(notes).keys()].join(" / ");
  await send(`${config.mail.subjectPrefix} ${notes.length} 条新笔记 · ${keywords}`, html, text);
}

export async function sendAlert(reason: string, detail: string): Promise<void> {
  const html = `
  <div style="max-width:640px;margin:0 auto;padding:24px 20px;
              font-family:-apple-system,'PingFang SC',sans-serif">
    <div style="font-size:16px;font-weight:600;color:#d33">⚠️ xhs-watcher 抓取异常</div>
    <p style="font-size:14px;color:#333">${escapeHtml(reason)}</p>
    <pre style="background:#f6f6f6;padding:12px;border-radius:6px;font-size:12px;
                white-space:pre-wrap;color:#555">${escapeHtml(detail)}</pre>
    <p style="font-size:12px;color:#888">
      若为登录态失效：在本地执行 <code>npm run login</code> 重新扫码，
      并把 <code>data/pw-profile</code> 同步到服务器。
    </p>
  </div>`;
  await send(`${config.mail.subjectPrefix} ⚠️ 抓取异常`, html, `${reason}\n\n${detail}`);
}
