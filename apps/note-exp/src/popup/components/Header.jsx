function LangToggle({ lang, setLang }) {
  return (
    <div className="flex bg-white/10 rounded-full p-0.5 gap-px">
      {['中文', 'English'].map((lg) => (
        <button
          key={lg}
          onClick={() => setLang(lg)}
          className={`px-2.5 py-[3px] rounded-full text-[11px] font-bold leading-snug transition ${
            lang === lg ? 'bg-white/[0.16] text-white' : 'text-[#9a9aa2]'
          }`}
        >
          {lg === '中文' ? '中' : 'EN'}
        </button>
      ))}
    </div>
  );
}

export default function Header({ L, lang, setLang }) {
  return (
    <header className="flex items-center justify-between bg-header px-3.5 py-[9px] shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {/* Root-absolute src resolves to the extension root regardless of where
            popup.html lands in dist/; 48px source covers 22px display on 2x screens. */}
        <img
          src="/icons/icon48.png"
          alt=""
          className="w-[22px] h-[22px] rounded-md shrink-0"
        />
        <span className="font-bold text-[13px] text-white tracking-tight">{L.brand}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <LangToggle lang={lang} setLang={setLang} />
      </div>
    </header>
  );
}
