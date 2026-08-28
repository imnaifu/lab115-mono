/**
 * What a cycle found, written to the log.
 *
 * IT USED TO BE EMAIL. This file rendered an HTML digest and posted it through
 * Resend — cover, title, author and stats per note, because a note link carries an
 * `xsec_token` that expires and a bare list of URLs would rot. The feature is gone:
 * the watcher's output is its log and its SQLite file now, and the credentials it
 * needed are out of docker-compose with it.
 *
 * THE PLAIN-TEXT RENDERING IS WHAT SURVIVED, and it is not a consolation prize:
 * the mail path always built this string as the `text/plain` half, and the
 * dry-run branch already printed exactly it whenever `RESEND_API_KEY` was unset —
 * which is to say the log output below is the shape this app was already debugged
 * through, not a new one invented while deleting something.
 *
 * The URLs still carry their tokens, so a line copied out of the log opens the
 * note for as long as the token lives.
 */
import { config } from "./config.js";
import { noteUrl } from "./normalize.js";
import type { StoredNote } from "./db.js";

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

/** One block per keyword, one note per two lines: the title line and its URL. */
function renderDigest(notes: StoredNote[]): string {
  const lines: string[] = [];

  for (const [keyword, groupNotes] of groupByKeyword(notes)) {
    lines.push(`# ${keyword} (${groupNotes.length})`);
    for (const note of groupNotes) {
      const time = formatTime(note.publishedAt ?? note.firstSeenAt, config.timezone);
      lines.push(
        `- ${note.title || "(无标题)"} — ${note.authorName ?? "未知作者"}` +
          ` · ❤ ${note.likedCount} · ${time}`,
      );
      lines.push(`  ${noteUrl(note.noteId, note.xsecToken)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** The cycle's new notes. */
export function logDigest(notes: StoredNote[]): void {
  const keywords = [...groupByKeyword(notes).keys()].join(" / ");
  console.log(`[digest] ${notes.length} 条新笔记 · ${keywords}`);
  console.log(renderDigest(notes));
}

/**
 * A cycle that failed, on stderr.
 *
 * STILL RATE-LIMITED BY THE CALLER, which is worth keeping now that this is only
 * a log line: `recordCycleFailure` holds the cooldown so a dead login does not
 * repeat itself every 45 minutes, and a log nobody can skim is a log nobody
 * reads — the same reason the cooldown existed when this was mail.
 */
export function logAlert(reason: string, detail: string): void {
  console.error(`[alert] ${reason}\n${detail}`);
  console.error(
    "若为登录态失效：本地跑 npm run login 重新扫码，" +
      "并把 data/pw-profile 同步到服务器。",
  );
}
