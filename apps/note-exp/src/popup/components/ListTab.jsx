import Icon from './Icon.jsx';
import NoteRow from './NoteRow.jsx';
import { Spinner, Btn, Progress, Overlay, Sheet, SheetIcon } from './ui.jsx';

function StateMsg({ icon, warn, title, sub, btn, onBtn }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-7 py-14 h-full gap-1">
      <span
        className={`w-[60px] h-[60px] rounded-full flex items-center justify-center mb-3 ${
          warn ? 'bg-brand-tint text-brand' : 'bg-[#f4f4f6] text-ink3'
        }`}
      >
        <Icon name={icon} size={30} stroke={1.7} />
      </span>
      <div className="font-bold text-[15px] text-ink">{title}</div>
      <div className="text-[12px] text-ink2 leading-relaxed mb-3.5 max-w-[240px]">{sub}</div>
      <Btn kind="secondary" onClick={onBtn}>
        {btn}
      </Btn>
    </div>
  );
}

export default function ListTab({ L, s }) {
  if (s.sPhase === 'nopage') {
    return (
      <StateMsg
        icon="inbox"
        title={L.nopageT}
        sub={L.nopageS}
        btn={L.nopageBtn}
        onBtn={() => s.setSPhase('capturing')}
      />
    );
  }

  return (
    <>
      {/* connected banner */}
      <div className="flex items-center gap-[7px] px-3.5 pt-[11px] pb-[3px] text-[11.5px] text-ink2 bg-[#f7f7f8]">
        <span className="w-[7px] h-[7px] rounded-full bg-[#1bc46a] shrink-0 rx-ping-dot" />
        <span className="font-semibold">{L.connected}</span>
      </div>

      {/* capture counter */}
      <div className="flex items-start justify-between px-3.5 py-[11px] border-b border-line bg-[#f7f7f8]">
        <div>
          <div className="text-[11px] font-semibold text-ink2">{L.captured}</div>
          <div className="flex items-baseline gap-[5px] mt-0.5">
            <b className="text-[24px] font-extrabold tracking-tight text-ink leading-none">{s.total}</b>
            <span className="text-[13px] text-ink2 font-semibold">{L.unit}</span>
          </div>
          <div className="text-[11.5px] text-ink3 mt-0.5">{L.dedup(s.received, s.duplicates)}</div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand bg-brand-tint px-2.5 py-[5px] rounded-full">
          <span className="w-[7px] h-[7px] rounded-full bg-brand rx-pulse-dot" />
          {L.capturing}
        </div>
      </div>

      <div className="flex items-center gap-[7px] px-4 pt-2.5 pb-1 text-[11.5px] text-ink2 leading-snug">
        <Icon name="arrowdown" size={13} className="text-ink3" />
        {L.pageHint}
      </div>

      {/* live preview list */}
      <div>
        {s.items.map((n) => (
          <NoteRow key={n.id} n={n} L={L} />
        ))}
        {s.total === 0 && (
          <div className="flex items-center justify-center gap-2 text-[12px] text-ink2 py-6">
            <Spinner /> {L.capturing}
          </div>
        )}
      </div>

      {/* export overlay */}
      {(s.sPhase === 'exporting' || s.sPhase === 'exported') && (
        <Overlay>
          <Sheet>
            {s.sPhase === 'exporting' ? (
              <>
                <SheetIcon />
                <div className="font-bold text-[15px] mb-3">{L.exporting(s.total)}</div>
                <Progress pct={s.exportPct} />
                <div className="text-[11.5px] text-ink2 mt-2">{Math.round(s.exportPct)}%</div>
              </>
            ) : (
              <>
                <SheetIcon ok />
                <div className="font-bold text-[15px] mb-3">{L.exportDone}</div>
                <div className="flex items-center gap-2 bg-[#f6f6f8] rounded-md px-3 py-2.5 text-[12px] text-ink mt-1.5">
                  <Icon name="file" size={15} />
                  <span className="flex-1 text-left truncate">{s.exportedName}</span>
                  <b className="text-ink2 font-semibold">{L.rows(s.total)}</b>
                </div>
                <div className="text-[11.5px] text-ink2 mt-2">{L.savedTo}</div>
                <div className="flex gap-2.5 mt-4">
                  <Btn kind="primary" className="flex-1" onClick={() => s.setSPhase('capturing')}>
                    {L.done}
                  </Btn>
                </div>
              </>
            )}
          </Sheet>
        </Overlay>
      )}
    </>
  );
}
