/**
 * SQLite storage + the three-layer dedupe that is the whole point of this app:
 *
 *   1. note_id primary key — the same note never notifies twice
 *   2. content_hash        — same title by the same author, reposted / mirrored
 *   3. publish-age cutoff  — applied in runner.ts, keeps old-but-unseen posts
 *      surfaced by search out of the digest (best-effort: the search API does
 *      not always expose a timestamp)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { config } from "./config.js";
import type { NormalizedNote } from "./normalize.js";

export type InsertOutcome = "new" | "seen" | "duplicate";

export interface StoredNote extends NormalizedNote {
  keyword: string;
  firstSeenAt: number;
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new Database(config.dbPath);
  // WAL keeps the (optional) read-only dashboard from blocking the writer.
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS note (
      note_id       TEXT PRIMARY KEY,
      watch_id      TEXT NOT NULL,
      keyword       TEXT NOT NULL,
      title         TEXT NOT NULL DEFAULT '',
      description   TEXT NOT NULL DEFAULT '',
      author_id     TEXT,
      author_name   TEXT,
      cover_url     TEXT,
      liked_count   INTEGER NOT NULL DEFAULT 0,
      published_at  INTEGER,
      first_seen_at INTEGER NOT NULL,
      xsec_token    TEXT,
      content_hash  TEXT NOT NULL,
      dup_of        TEXT,
      notified_at   INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_note_hash    ON note(content_hash);
    CREATE INDEX IF NOT EXISTS idx_note_pending ON note(notified_at);

    CREATE TABLE IF NOT EXISTS run (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      watch_id    TEXT NOT NULL,
      started_at  INTEGER NOT NULL,
      finished_at INTEGER,
      status      TEXT NOT NULL,
      fetched     INTEGER NOT NULL DEFAULT 0,
      new_count   INTEGER NOT NULL DEFAULT 0,
      error       TEXT
    );

    CREATE TABLE IF NOT EXISTS kv (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

/** Layer 2 fingerprint: punctuation/whitespace-insensitive title + author. */
export function contentHash(title: string, authorId: string | null): string {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .slice(0, 120);
  return crypto.createHash("sha1").update(`${normalizedTitle}|${authorId ?? ""}`).digest("hex");
}

export function hasAnyNote(watchId: string): boolean {
  const row = getDb().prepare("SELECT 1 FROM note WHERE watch_id = ? LIMIT 1").get(watchId);
  return row !== undefined;
}

const insertStmt = () =>
  getDb().prepare(`
    INSERT INTO note (
      note_id, watch_id, keyword, title, description, author_id, author_name,
      cover_url, liked_count, published_at, first_seen_at, xsec_token,
      content_hash, dup_of, notified_at
    ) VALUES (
      @noteId, @watchId, @keyword, @title, @description, @authorId, @authorName,
      @coverUrl, @likedCount, @publishedAt, @firstSeenAt, @xsecToken,
      @contentHash, @dupOf, @notifiedAt
    )
    ON CONFLICT(note_id) DO NOTHING
  `);

/**
 * Inserts a note and reports what happened.
 *
 * `suppress` marks the row as already-notified on write — used for the
 * first-run seed and for below-threshold notes, so they populate the dedupe
 * index without ever reaching the mailbox.
 */
export function insertNote(
  note: NormalizedNote,
  keyword: string,
  now: number,
  suppress: boolean,
): InsertOutcome {
  const database = getDb();
  const hash = contentHash(note.title, note.authorId);

  // Layer 2: a different note_id carrying the same title+author is a repost.
  const twin = database
    .prepare("SELECT note_id FROM note WHERE content_hash = ? AND note_id != ? LIMIT 1")
    .get(hash, note.noteId) as { note_id: string } | undefined;

  const result = insertStmt().run({
    noteId: note.noteId,
    watchId: note.watchId,
    keyword,
    title: note.title,
    description: note.description,
    authorId: note.authorId,
    authorName: note.authorName,
    coverUrl: note.coverUrl,
    likedCount: note.likedCount,
    publishedAt: note.publishedAt,
    firstSeenAt: now,
    xsecToken: note.xsecToken,
    contentHash: hash,
    dupOf: twin?.note_id ?? null,
    notifiedAt: suppress || twin ? now : null,
  });

  if (result.changes === 0) {
    // Already known. Refresh the volatile bits — xsec_token expires, and a
    // stale token means a 404 in the email we haven't sent yet.
    database
      .prepare(
        `UPDATE note SET xsec_token = ?, liked_count = ?
         WHERE note_id = ? AND notified_at IS NULL`,
      )
      .run(note.xsecToken, note.likedCount, note.noteId);
    return "seen";
  }
  return twin ? "duplicate" : "new";
}

export function pendingNotes(): StoredNote[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM note
       WHERE notified_at IS NULL AND dup_of IS NULL
       ORDER BY watch_id, COALESCE(published_at, first_seen_at) DESC`,
    )
    .all() as Record<string, any>[];

  return rows.map((row) => ({
    noteId: row.note_id,
    watchId: row.watch_id,
    keyword: row.keyword,
    title: row.title,
    description: row.description,
    authorId: row.author_id,
    authorName: row.author_name,
    coverUrl: row.cover_url,
    likedCount: row.liked_count,
    publishedAt: row.published_at,
    publishedLabel: null,
    xsecToken: row.xsec_token,
    firstSeenAt: row.first_seen_at,
  }));
}

export function markNotified(noteIds: string[], now: number): void {
  const stmt = getDb().prepare("UPDATE note SET notified_at = ? WHERE note_id = ?");
  const tx = getDb().transaction((ids: string[]) => {
    for (const id of ids) stmt.run(now, id);
  });
  tx(noteIds);
}

export function startRun(watchId: string, now: number): number {
  const result = getDb()
    .prepare("INSERT INTO run (watch_id, started_at, status) VALUES (?, ?, 'running')")
    .run(watchId, now);
  return Number(result.lastInsertRowid);
}

export function finishRun(
  runId: number,
  status: "ok" | "failed" | "blocked",
  stats: { fetched: number; newCount: number; error?: string },
  now: number,
): void {
  getDb()
    .prepare(
      `UPDATE run SET finished_at = ?, status = ?, fetched = ?, new_count = ?, error = ?
       WHERE id = ?`,
    )
    .run(now, status, stats.fetched, stats.newCount, stats.error ?? null, runId);
}

export function kvGet(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM kv WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function kvSet(key: string, value: string): void {
  getDb()
    .prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?")
    .run(key, value, value);
}
