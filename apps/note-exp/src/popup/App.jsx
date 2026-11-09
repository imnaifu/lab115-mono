import { LangProvider, useLang } from './i18n.jsx';
import usePopup from './usePopup.js';
import Header from './components/Header.jsx';
import Tabs from './components/Tabs.jsx';
import ListTab from './components/ListTab.jsx';
import PostTab from './components/PostTab.jsx';
import Icon from './components/Icon.jsx';
import { Btn } from './components/ui.jsx';

function Popup() {
  const { L, lang, setLang } = useLang();
  const s = usePopup();

  return (
    <div className="w-[400px] h-[600px] flex flex-col bg-paper text-ink text-[13px] font-sans overflow-hidden relative antialiased">
      <Header L={L} lang={lang} setLang={setLang} />
      <Tabs L={L} tab={s.tab} setTab={s.setTab} />

      <div ref={s.bodyRef} className="flex-1 overflow-y-auto rx-scroll relative">
        {s.tab === 'list' ? <ListTab L={L} s={s} /> : <PostTab L={L} s={s} />}
      </div>

      {/* list footer — only while capturing and there is something to export */}
      {s.tab === 'list' && s.sPhase === 'capturing' && s.total > 0 && (
        <footer className="flex items-center gap-2 px-4 py-2.5 shrink-0 border-t border-line bg-paper">
          <div className="flex items-center gap-1.5 text-[13px] text-ink-muted font-bold">
            <Icon name="file" size={15} />
            <b className="font-display font-extrabold text-ink">{s.total}</b> {L.unit}
          </div>
          <Btn kind="secondary" icon="x" className="ml-auto" onClick={s.runClear}>
            {L.clear}
          </Btn>
          <Btn kind="primary" icon="arrowdown" onClick={s.runExport}>
            {L.exportCsv}
          </Btn>
        </footer>
      )}

      {/* post footer */}
      {s.tab === 'post' && s.pPhase === 'ready' && (
        <footer className="flex items-center gap-2 px-4 py-2.5 shrink-0 border-t border-line bg-paper">
          {/* select-all as a checkbox (Sokosoko Choice): red box with a white tick when on */}
          <button
            onClick={() => s.selectAll(!s.allSel)}
            aria-pressed={s.allSel}
            className="flex items-center gap-2 text-[13px] font-bold text-ink h-9 pl-1 pr-2 rounded-full hover:bg-paper-sunk transition-colors duration-[120ms]"
          >
            <span
              className={`w-[18px] h-[18px] rounded-xs border-2 flex items-center justify-center ${
                s.allSel ? 'bg-brand border-brand-deep text-on-brand' : 'bg-paper border-line-strong'
              }`}
            >
              {s.allSel && <Icon name="check" size={12} stroke={3} />}
            </span>
            {s.allSel ? L.deselAll : L.selAll}
          </button>
          <Btn kind="primary" icon="download" className="ml-auto" disabled={!s.selCount} onClick={() => s.runDownload(L.txt)}>
            {L.dlSel(s.selCount)}
          </Btn>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <Popup />
    </LangProvider>
  );
}
