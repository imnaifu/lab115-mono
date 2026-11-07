import Icon from './Icon.jsx';
import { LANGS } from '../i18n.jsx';

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

export default function Header({ L, lang, setLang }) {
  return (
    <header className="flex items-center justify-between bg-paper px-4 h-[52px] shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {/* Root-absolute src resolves to the extension root regardless of where
            popup.html lands in dist/; 48px source covers 24px display on 2x screens. */}
        <img src="/icons/icon48.png" alt="" className="w-6 h-6 rounded-sm shrink-0" />
        <span className="font-display font-extrabold text-[15px] text-ink tracking-[0.01em] truncate">{L.brand}</span>
      </div>

      <LangSelect lang={lang} setLang={setLang} />
    </header>
  );
}
