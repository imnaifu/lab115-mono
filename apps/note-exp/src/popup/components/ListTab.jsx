import Icon from './Icon.jsx';
import NoteRow from './NoteRow.jsx';
import { Spinner, Btn, Progress, Overlay, Sheet, SheetIcon, EmptyState, Notice } from './ui.jsx';

export default function ListTab({ L, s }) {
  if (s.sPhase === 'nopage') {
    return (
      <EmptyState
        art="browser"
        title={L.nopageT}
        sub={L.nopageS}
        btn={L.nopageBtn}
        onBtn={() => s.setSPhase('capturing')}
      />
    );
  }

  return (
    <>
      {/* capture counter on the warm cream band */}
      <div className="px-4 pt-3 pb-3.5 bg-paper-soft border-b border-line">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12px] text-ink-muted font-medium">
            <span className="w-2 h-2 rounded-full bg-success shrink-0" />
            {L.connected}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink bg-brand-soft px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-brand-deep rx-pulse-dot" />
            {L.capturing}
          </div>
        </div>
        <div className="text-[12px] font-medium text-ink-muted mt-2">{L.captured}</div>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <b className="font-display text-[32px] font-extrabold text-ink leading-none">{s.total}</b>
          <span className="text-[13px] text-ink-muted font-bold">{L.unit}</span>
        </div>
        <div className="text-[12px] text-ink-muted mt-1">{L.dedup(s.received, s.duplicates)}</div>
      </div>

      <Notice icon="arrowdown" className="mx-4 mt-3 mb-1.5">
        {L.pageHint}
      </Notice>

      {/* live preview list */}
      <div>
        {s.items.map((n) => (
          <NoteRow key={n.id} n={n} L={L} />
        ))}
        {s.total === 0 && (
          <div className="flex items-center justify-center gap-2 text-[13px] text-ink-muted py-6">
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
                <div className="font-bold text-[16px] mb-3">{L.exporting(s.total)}</div>
                <Progress pct={s.exportPct} />
                <div className="font-display font-bold text-[13px] text-ink-muted mt-2">{Math.round(s.exportPct)}%</div>
              </>
            ) : (
              <>
                <SheetIcon ok />
                <div className="font-bold text-[16px] mb-3">{L.exportDone}</div>
                <Notice icon="file" tone="success" className="mt-1.5">
                  <div className="flex gap-2">
                    <span className="flex-1 truncate">{s.exportedName}</span>
                    <b className="font-bold">{L.rows(s.total)}</b>
                  </div>
                  <div className="text-[12px] text-ink-muted">{L.savedTo}</div>
                </Notice>
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
