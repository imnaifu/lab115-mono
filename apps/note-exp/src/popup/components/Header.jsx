function LangToggle({ lang, setLang }) {
  return (
    <div className="flex bg-paper-sunk rounded-full p-[3px] gap-0.5">
      {['中文', 'English'].map((lg) => {
        const active = lang === lg;
        return (
          <button
            key={lg}
            onClick={() => setLang(lg)}
            aria-pressed={active}
            className={`min-w-[34px] h-[26px] px-2.5 rounded-full text-[12px] font-bold leading-none transition-colors duration-[120ms] ${
              active ? 'bg-paper text-ink shadow-[0_0_0_1px_var(--line)]' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {lg === '中文' ? '中' : 'EN'}
          </button>
        );
      })}
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

      <LangToggle lang={lang} setLang={setLang} />
    </header>
  );
}
