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
    <div className="w-[400px] h-[600px] flex flex-col bg-white text-ink text-[12px] font-sans overflow-hidden relative antialiased">
      <Header L={L} lang={lang} setLang={setLang} />
      <Tabs L={L} tab={s.tab} setTab={s.setTab} />

      <div ref={s.bodyRef} className="flex-1 overflow-y-auto rx-scroll relative">
        {s.tab === 'list' ? <ListTab L={L} s={s} /> : <PostTab L={L} s={s} />}
      </div>

      {/* list footer — only while capturing and there is something to export */}
      {s.tab === 'list' && s.sPhase === 'capturing' && s.total > 0 && (
        <footer className="flex items-center gap-2.5 px-3.5 py-[11px] shrink-0 border-t border-line">
          <div className="flex items-center gap-1.5 text-[12px] text-ink2 font-semibold">
            <Icon name="file" size={13} />
            {s.total} {L.unit}
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
        <footer className="flex items-center gap-2.5 px-3.5 py-[11px] shrink-0 border-t border-line">
          <button
            onClick={() => s.selectAll(!s.allSel)}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-ink2 hover:text-brand px-1 py-1.5 rounded transition"
          >
            <Icon name={s.allSel ? 'check' : 'image'} size={13} />
            {s.allSel ? L.deselAll : L.selAll}
          </button>
          <Btn kind="primary" icon="download" className="ml-auto" disabled={!s.selCount} onClick={s.runDownload}>
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
