import { useEffect, useRef, useState } from "react";
import { parseInterceptedDataLocal } from "../utils/note";
import { convertToCSV } from "../utils/csv";
import { parseNoteDetail } from "../utils/video";

// All popup state + actions in one hook. Real data is pulled from the content
// script (which relays the page's intercepted API responses); there is no mock
// simulation. List data comes from the note-list endpoints (search, homefeed,
// user_posted) plus the homepage's server-rendered first screen; post data
// comes from the note-detail (feed) endpoint.

/** Parses a count string like "1,937" to a number; leaves "10万+" etc. as-is. */
function toNum(value) {
  const cleaned = String(value ?? "").replace(/,/g, "");
  return /^\d+$/.test(cleaned) ? Number(cleaned) : value;
}

/**
 * Sanitizes a download *folder* name. Chrome's downloads API drops the whole
 * relative path (files land flat in Downloads) when a directory segment
 * contains characters it can't handle — emoji, fullwidth punctuation, etc. So
 * we whitelist letters/numbers (incl. CJK), spaces and -_(), and replace
 * everything else, keeping the readable title while guaranteeing a path Chrome
 * will actually create as a subfolder.
 */
function sanitizeFolder(name) {
  return (
    (name || "")
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}\-_() ]+/gu, "_") // non-whitelisted runs → '_'
      .replace(/_+/g, "_") // collapse repeats
      .replace(/\s+/g, " ")
      .replace(/^[_\s.]+|[_\s.]+$/g, "") // no leading/trailing _ . or space
      .slice(0, 80) || "rednote"
  );
}

/** Guesses a file extension for an image URL (XHS serves webp by default). */
function imageExt(url) {
  if (/webp/i.test(url)) return "webp";
  if (/\.png|png_/i.test(url)) return "png";
  return "jpg";
}

/**
 * Current local time as "YYYY-MM-DD HH-MM-SS". Colons are illegal in filenames,
 * so the time uses dashes — this stamps the download folder at download time.
 */
function nowStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${datePart} ${timePart}`;
}

function getActiveTab() {
  return chrome.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs) => tabs[0] || null);
}

function originOf(tab) {
  try {
    if (tab?.url) return new URL(tab.url).origin;
  } catch {
    // ignore internal/malformed URLs
  }
  return "https://www.xiaohongshu.com";
}

export default function usePopup() {
  const [tab, setTab] = useState("list");

  // list tab (homefeed / search / user profile note lists)
  const [sPhase, setSPhase] = useState("capturing"); // nopage | capturing | exporting | exported
  const [items, setItems] = useState([]); // mapped note rows for the live list
  const [received, setReceived] = useState(0); // raw count before dedup
  const [exportPct, setExportPct] = useState(0);
  const [exportedName, setExportedName] = useState("");

  // post tab
  const [pPhase, setPPhase] = useState("error"); // ready | downloading | done | error
  const [post, setPost] = useState(null); // PostDetail of the currently open note
  const [sel, setSel] = useState(() => new Set());
  const [dlPct, setDlPct] = useState(0);
  const [dlDone, setDlDone] = useState(0);
  // Download folder name, captured at download time so the "saved to" path
  // shown afterwards matches the folder actually used.
  const [dlFolder, setDlFolder] = useState("");

  const bodyRef = useRef(null);

  // Underlying PostData[] of the last list refresh, kept for CSV export.
  const parsedRef = useRef([]);
  // Phase refs so the 1s poll doesn't stomp an active export/download overlay.
  const sPhaseRef = useRef(sPhase);
  sPhaseRef.current = sPhase;
  const pPhaseRef = useRef(pPhase);
  pPhaseRef.current = pPhase;
  // Track which note the selection belongs to, to reset it when the post changes.
  const postIdRef = useRef(null);
  // Pending timeouts, cleared on unmount.
  const timers = useRef([]);
  const after = (ms, fn) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };

  // Poll the content script for both list and post data once per second.
  useEffect(() => {
    let alive = true;

    async function refresh() {
      const activeTab = await getActiveTab();
      if (!alive || !activeTab?.id) return;
      const base = originOf(activeTab);

      // --- note list (search / homefeed / user_posted) ---
      try {
        const resp = await chrome.tabs.sendMessage(activeTab.id, {
          action: "extractPostData",
        });
        const parsed = parseInterceptedDataLocal(resp?.data, base);
        parsedRef.current = parsed;
        setItems(
          parsed.map((p, i) => ({
            id: p.noteUrl || String(i),
            title: p.title,
            author: p.authorName,
            likes: toNum(p.likeCount),
            collects: toNum(p.collectCount),
            comments: toNum(p.commentCount),
            time: p.publishTime,
            cover: p.coverUrl,
            url: p.noteUrl,
          })),
        );
        setReceived(resp?.totalReceived ?? parsed.length);
        // Only auto-drive idle phases; leave exporting/exported alone.
        if (
          sPhaseRef.current === "nopage" ||
          sPhaseRef.current === "capturing"
        ) {
          setSPhase("capturing");
        }
      } catch {
        // Content script unreachable → not on a Xiaohongshu/RedNote page.
        parsedRef.current = [];
        setItems([]);
        if (
          sPhaseRef.current === "nopage" ||
          sPhaseRef.current === "capturing"
        ) {
          setSPhase("nopage");
        }
      }

      // --- post (note-detail / feed) ---
      try {
        const resp = await chrome.tabs.sendMessage(activeTab.id, {
          action: "getPostData",
        });
        const list = Array.isArray(resp?.data) ? resp.data : [];
        const details = list
          .map((raw) => parseNoteDetail(raw, base))
          .filter(Boolean);
        // The most recently captured note is the one the user is viewing.
        let latest = details.length ? details[details.length - 1] : null;
        // The feed API gives no note-scoped xsec_token, so the parsed link
        // can't open standalone. The page the user is currently on does carry a
        // working xsec_token + xsec_source in its own URL — when it points at
        // this note, use it as the canonical, openable link.
        if (latest && activeTab.url && activeTab.url.includes(latest.noteId)) {
          latest = { ...latest, noteUrl: activeTab.url };
        }
        setPost(latest);
        // When the open note changes, select everything by default. Only seed
        // 'v' when the post actually has a video (图文 posts have none), so the
        // selection matches what's downloadable — mirrors selectAll's logic.
        if (latest && latest.noteId !== postIdRef.current) {
          postIdRef.current = latest.noteId;
          setSel(
            new Set([
              ...(latest.video ? ["v"] : []),
              ...latest.images.map((_, i) => "i" + i),
            ]),
          );
        }
        if (pPhaseRef.current === "ready" || pPhaseRef.current === "error") {
          setPPhase(latest ? "ready" : "error");
        }
      } catch {
        setPost(null);
        if (pPhaseRef.current === "ready" || pPhaseRef.current === "error") {
          setPPhase("error");
        }
      }
    }

    refresh();
    const id = setInterval(refresh, 1000);
    return () => {
      alive = false;
      clearInterval(id);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const total = items.length;
  const duplicates = Math.max(0, received - total);

  // --- export (real CSV via blob) ---
  function runExport() {
    const data = parsedRef.current;
    if (!data.length) return;

    const csv = convertToCSV(data);
    // Filename: "yyyy-mm-dd hh-mm-ss rednote-notes.csv". Reuse nowStamp()
    // (local time, filename-safe dashes) so it matches the download-folder
    // naming. The list can mix sources (homefeed/search/profile), so there is
    // no single keyword to name the file after.
    const name = `${nowStamp()} rednote-notes.csv`;

    // UTF-8 BOM so Excel opens Chinese text correctly (matches the old popup).
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    // The blob download is instant; animate the progress bar briefly for feedback.
    setExportedName(name);
    setSPhase("exporting");
    setExportPct(0);
    const tick = () =>
      setExportPct((p) => {
        const n = Math.min(100, p + 22);
        if (n < 100) after(60, tick);
        else after(220, () => setSPhase("exported"));
        return n;
      });
    after(80, tick);
  }

  // --- clear (drops the page-side caches; nothing auto-clears anymore) ---
  async function runClear() {
    // Ask the page to drop its caches first, so the next 1s poll doesn't
    // repopulate the UI from stale injected-script state.
    try {
      const activeTab = await getActiveTab();
      if (activeTab?.id) {
        await chrome.tabs.sendMessage(activeTab.id, { action: "clearData" });
      }
    } catch {
      // content script unreachable — still clear the popup's local view
    }
    parsedRef.current = [];
    setItems([]);
    setReceived(0);
  }

  // --- post selection ---
  const selImages = post
    ? post.images.filter((_, i) => sel.has("i" + i)).length
    : 0;
  const selVideo = sel.has("v") && !!post?.video;
  const selCount = selImages + (selVideo ? 1 : 0);
  const allSel = post
    ? selCount === post.images.length + (post.video ? 1 : 0) && selCount > 0
    : false;

  function toggle(key) {
    setSel((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  function selectAll(on) {
    if (!post) return;
    setSel(
      on
        ? new Set([
            ...(post.video ? ["v"] : []),
            ...post.images.map((_, i) => "i" + i),
          ])
        : new Set(),
    );
  }

  // --- download (real, via chrome.downloads) ---
  async function runDownload() {
    if (!post || !selCount) return;
    setPPhase("downloading");
    setDlPct(0);
    setDlDone(0);

    // Folder name uses the download time (captured now), not the publish time.
    const folder = sanitizeFolder(`${nowStamp()} ${post.title || post.noteId}`);
    setDlFolder(folder);
    const jobs = [];
    if (selVideo && post.video) {
      jobs.push({
        urls: [post.video.url, ...post.video.backupUrls],
        name: `${folder}/video-1.mp4`,
      });
    }
    // Number images by their position in the post (i + 1) so the filename
    // matches the index shown on each thumbnail in the UI.
    post.images.forEach((img, i) => {
      if (sel.has("i" + i)) {
        jobs.push({
          urls: [img.url],
          name: `${folder}/image-${i + 1}.${imageExt(img.url)}`,
        });
      }
    });

    let done = 0;
    for (const job of jobs) {
      // Route through the background worker, which forces the target path via
      // onDeterminingFilename. Calling chrome.downloads.download with `filename`
      // directly here is unreliable: the CDN's Content-Disposition overrides it,
      // dropping the folder and renaming the files.
      try {
        await chrome.runtime.sendMessage({
          action: "downloadResource",
          urls: job.urls,
          filename: job.name,
        });
      } catch {
        // background unreachable — skip this job
      }
      done += 1;
      setDlDone(done);
      setDlPct(Math.round((done / jobs.length) * 100));
    }
    after(300, () => setPPhase("done"));
  }

  return {
    tab,
    setTab,
    // list
    sPhase,
    setSPhase,
    items,
    total,
    received,
    duplicates,
    exportPct,
    exportedName,
    runExport,
    runClear,
    bodyRef,
    // post
    pPhase,
    setPPhase,
    post,
    sel,
    toggle,
    selectAll,
    allSel,
    selImages,
    selVideo,
    selCount,
    dlPct,
    dlDone,
    runDownload,
    dlFolder,
  };
}
