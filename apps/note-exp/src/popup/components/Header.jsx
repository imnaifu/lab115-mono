import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { LANGS } from '../i18n.jsx';
import { readStatsEnabled, writeStatsEnabled } from '../stats.js';

// The site's privacy page for each UI language (paths match site/strings.py).
const PRIVACY_PATHS = { zh_CN: '/zh/', zh_TW: '/zh-tw/', en: '/', ko: '/ko/', ja: '/ja/', vi: '/vi/' };

// Six languages don't fit a segmented toggle, so this is a native <select>
// styled as a pill: keyboard and screen-reader support come for free, and the
// option list is drawn by Chrome, so it isn't clipped by the 400px popup.
function LangSelect({ lang, setLang }) {
  return (
    <label className="relative flex items-center shrink-0 text-ink-muted hover:text-ink transition-colors duration-[120ms]">
      <Icon name="globe" size={14} className="absolute left-2.5 z-[1] pointer-events-none" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        aria-label="Language"
        className="appearance-none w-[132px] h-[30px] pl-7 pr-7 rounded-full bg-paper-sunk text-[12px] font-bold text-ink cursor-pointer"
      >
        {LANGS.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
      <Icon name="chevrondown" size={14} className="absolute right-2.5 z-[1] pointer-events-none" />
    </label>
  );
}

// "…" menu with the one setting besides language: anonymous usage stats, on
// unless the user turns them off here.
function SettingsMenu({ L, lang }) {
  const [open, setOpen] = useState(false);
  const [statsOn, setStatsOn] = useState(true);
  const rootRef = useRef(null);

  useEffect(() => {
    readStatsEnabled().then(setStatsOn);
  }, []);

  // Close on a click outside or Escape, like the native menus around it.
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggleStats() {
    const next = !statsOn;
    setStatsOn(next);
    writeStatsEnabled(next);
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        aria-label={L.menu}
        aria-expanded={open}
        className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-paper-sunk transition-colors duration-[120ms]"
      >
        <Icon name="dots" size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-[36px] z-40 w-[272px] bg-paper border border-line rounded-md shadow-pop p-3.5 text-left rx-fade">
          <label className="flex items-start gap-3 cursor-pointer">
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-[13px] leading-[20px] text-ink">{L.statsT}</span>
              <span className="block text-[12px] leading-[18px] text-ink-muted mt-0.5 [text-wrap:pretty]">{L.statsS}</span>
            </span>
            {/* switch: a checkbox styled as a pill, so it stays keyboard-operable */}
            <input type="checkbox" role="switch" checked={statsOn} onChange={toggleStats} className="peer sr-only" />
            <span
              aria-hidden="true"
              className={`mt-0.5 w-9 h-5 rounded-full p-0.5 shrink-0 transition-colors duration-[120ms] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand ${
                statsOn ? 'bg-brand' : 'bg-line-strong'
              }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-paper transition-transform duration-[120ms] ${statsOn ? 'translate-x-4' : ''}`}
              />
            </span>
          </label>
          <a
            href={`https://rednote.lab115.com${PRIVACY_PATHS[lang] || '/'}privacy/`}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2.5 text-[12px] font-bold text-link hover:underline"
          >
            {L.privacy}
          </a>
        </div>
      )}
    </div>
  );
}

export default function Header({ L, lang, setLang }) {
  return (
    <header className="flex items-center justify-between bg-paper px-4 h-[52px] shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {/* Root-absolute src resolves to the extension root regardless of where
            popup.html lands in dist/; 48px source covers 24px display on 2x screens. */}
        <img src="/icons/icon48.png" alt="" className="w-6 h-6 rounded-sm shrink-0" />
        <span className="font-display font-extrabold text-[15px] text-ink tracking-[0.01em] truncate">{L.brand}</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <LangSelect lang={lang} setLang={setLang} />
        <SettingsMenu L={L} lang={lang} />
      </div>
    </header>
  );
}
