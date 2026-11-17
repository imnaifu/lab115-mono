import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { datesOf, siteUrl, type Entry, type Feed, type Lang } from "../shared/feed.ts";
import { categoryColor } from "../shared/categories.ts";
import { getCachedFeed, getLang, markSeen, refreshFeed, setLang, watchStore } from "../shared/store.ts";
import { formatDate, strings } from "./strings.ts";
import { parseTake, type Take } from "./take.ts";

/**
 * loading  nothing cached yet, fetch in flight
 * ready    showing a feed fetched in this session (or cache while the fetch runs)
 * stale    the fetch failed; showing the cached copy
 * error    the fetch failed and there is nothing cached
 */
type Status = "loading" | "ready" | "stale" | "error";

/**
 * The side panel is one list: the newest edition, nothing older. Each card
 * carries the whole one-sentence take and is itself the link to that article's
 * page on daily.lab115.com — reading the full summary, and browsing back
 * issues, happen on the site.
 *
 * No brand header: Chrome draws its own above the panel, with the extension's
 * icon and name and the pin and close buttons.
 */
export function App() {
  const [lang, setLangState] = useState<Lang | null>(null);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  // Each load gets a number; a slower, older load (e.g. before a language
  // switch) must not overwrite what a newer one already put on screen.
  const loadSeq = useRef(0);
  const scroller = useRef<HTMLElement>(null);

  const load = useCallback(async (target: Lang) => {
    const seq = ++loadSeq.current;
    const cached = await getCachedFeed(target);
    if (seq !== loadSeq.current) return;
    setFeed(cached);
    setStatus(cached ? "ready" : "loading");
    if (cached) void markSeen(cached);
    try {
      const fresh = await refreshFeed(target);
      if (seq !== loadSeq.current) return;
      setFeed(fresh);
      setStatus("ready");
      void markSeen(fresh);
    } catch {
      if (seq !== loadSeq.current) return;
      setStatus(cached ? "stale" : "error");
    }
  }, []);

  const showLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      if (scroller.current) scroller.current.scrollTop = 0;
      void load(next);
    },
    [load],
  );

  useEffect(() => {
    void getLang().then(showLang);
  }, [showLang]);

  // Unlike a popup, the panel can stay open for hours. The background's poll
  // saves each new edition to storage (and marks it seen while a panel is open),
  // so following storage is all it takes to keep the list current. A language
  // switched in another window's panel is followed too, so two windows never
  // disagree about the one stored choice.
  useEffect(() => {
    if (!lang) return;
    return watchStore(lang, {
      onFeed: (saved) => {
        setFeed(saved);
        setStatus("ready");
      },
      onLang: showLang,
    });
  }, [lang, showLang]);

  useEffect(() => {
    if (lang) document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const date = useMemo(() => (feed ? datesOf(feed)[0] ?? null : null), [feed]);
  const dayEntries = useMemo(
    () => (feed && date ? feed.entries.filter((entry) => entry.date === date) : []),
    [feed, date],
  );
  const takes = useMemo(() => {
    const parsed = new Map<string, Take>();
    for (const entry of dayEntries) parsed.set(entry.link, parseTake(entry.html));
    return parsed;
  }, [dayEntries]);

  // A new edition arriving while the panel is open starts the reader at its top.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [date]);

  if (!lang) return null;
  const t = strings(lang);
  const hasList = Boolean(feed && date && dayEntries.length > 0);

  const switchLang = () => {
    const next: Lang = lang === "zh" ? "en" : "zh";
    void setLang(next);
    showLang(next);
  };

  return (
    <div className="app">
      {status === "stale" && <div className="notice">{t.stale}</div>}

      <main className="scroll" ref={scroller}>
        <div className="column">
          {/* Which edition this is, and the language switch, on one line at the
              top of the list. Not pinned: it leaves with the list, so the cards
              get the whole panel once the reader starts scrolling. */}
          <div className="top">
            {hasList && date ? (
              <span className="day">
                <span className="day-date">{formatDate(date, lang)}</span>
                <span className="day-count">{t.count(dayEntries.length)}</span>
              </span>
            ) : (
              <span />
            )}
            {/* On = English. The track shows both choices, so the state is visible
                without reading a label that names the OTHER language. */}
            <button
              className="lang-switch"
              role="switch"
              aria-checked={lang === "en"}
              aria-label="English"
              title={t.switchTitle}
              onClick={switchLang}
            >
              <span aria-hidden="true">中</span>
              <span aria-hidden="true">EN</span>
            </button>
          </div>

          {hasList ? (
            <>
              <ol className="list">
                {dayEntries.map((entry, at) => (
                  <ListItem key={entry.link} rank={at + 1} entry={entry} take={takes.get(entry.link)!} />
                ))}
              </ol>
              {/* The end of the edition, and a quiet way on to the site for what the
                  panel leaves out (full summaries, back issues). One muted line, not
                  a button: the list is the point, and this is only a footnote to it. */}
              <p className="end">
                <span>
                  {t.endNote} · {t.endMore}{" "}
                  <a href={siteUrl(lang)} target="_blank" rel="noopener">
                    daily.lab115.com
                  </a>
                </span>
              </p>
            </>
          ) : (
            <div className="state">
              {status === "loading" && <p>{t.loading}</p>}
              {status === "error" && (
                <>
                  <p>{t.error}</p>
                  <button className="pill primary" onClick={() => void load(lang)}>
                    {t.retry}
                  </button>
                </>
              )}
              {(status === "ready" || status === "stale") && <p>{t.empty}</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Chip({ entry }: { entry: Entry }) {
  const color = categoryColor(entry.categoryId);
  if (!entry.categoryLabel) return null;
  return (
    <span className="chip" style={{ "--cat": color.light, "--cat-dark": color.dark } as CSSProperties}>
      {entry.categoryLabel}
    </span>
  );
}

function ListItem({ rank, entry, take }: { rank: number; entry: Entry; take: Take }) {
  return (
    <li>
      <a className="item" href={entry.link} target="_blank" rel="noopener">
        <span className="rank">{rank}</span>
        <span className="item-body">
          <span className="meta">
            <Chip entry={entry} />
            {take.sourceName && <span className="source">{take.sourceName}</span>}
          </span>
          <span className="item-title">{entry.title}</span>
          {take.thesis && <span className="item-thesis">{take.thesis}</span>}
        </span>
      </a>
    </li>
  );
}
