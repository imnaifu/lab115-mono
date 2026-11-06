import Icon from './Icon.jsx';
import PhotoThumb from './PhotoThumb.jsx';
import { Btn, Progress, Overlay, Sheet, SheetIcon, EmptyState, Notice, Label } from './ui.jsx';

function Asset({ selected, onClick, children, thumb }) {
  return (
    // Pick card, styled like Sokosoko's format choice: picked = brand-deep border on brand-soft.
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`relative block w-full text-left p-1 rounded-md border-[1.5px] transition-colors duration-[120ms] ${
        selected ? 'border-brand-deep bg-brand-soft' : 'border-line bg-paper hover:border-line-strong'
      }`}
    >
      <div className="overflow-hidden rounded-sm">{thumb}</div>
      {/* round check: yellow with an ink tick when picked, a white ring otherwise */}
      <span
        className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors duration-[120ms] ${
          selected ? 'bg-brand border-brand-deep text-on-brand' : 'bg-[rgba(255,255,255,0.88)] border-line-strong'
        }`}
      >
        {selected && <Icon name="check" size={12} stroke={3} />}
      </span>
      {children}
    </button>
  );
}

export default function PostTab({ L, s }) {
  const post = s.post;

  // No video note captured yet (or not on a post page).
  if (s.pPhase === 'error' || !post) {
    return <EmptyState art="post" title={L.errT} sub={L.errS} btn={L.errBtn} onBtn={() => s.setPPhase('ready')} />;
  }

  // Use the first image (the cover frame) as the video poster when available.
  const videoPoster = post.images[0]?.url;

  return (
    <div className="px-4 py-4">
      {/* post head */}
      <div className="flex items-center gap-2.5">
        <PhotoThumb seed={1} src={post.avatar} className="w-9 h-9 rounded-full shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[13px] text-ink truncate">{post.author}</div>
          <div className="text-[12px] text-ink-muted">{post.time}</div>
        </div>
        {post.noteUrl && (
          <a
            href={post.noteUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={L.openNote}
            className="text-ink hover:bg-paper-sunk w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors duration-[120ms]"
          >
            <Icon name="link" size={16} />
          </a>
        )}
      </div>
      <div className="font-bold text-[14px] leading-[22px] mt-3 mb-3">{post.title}</div>

      {/* counts in ink: brand red is a fill, never a text colour */}
      <div className="text-[12px] text-ink-muted mb-2.5">
        <b className="font-display font-extrabold text-ink">{post.video ? 1 : 0}</b> {L.videoUnit} ·{' '}
        <b className="font-display font-extrabold text-ink">{post.images.length}</b> {L.imageUnit}
      </div>

      {/* video */}
      {post.video && (
        <Asset
          selected={s.sel.has('v')}
          onClick={() => s.toggle('v')}
          thumb={
            <PhotoThumb seed={9} src={videoPoster} className="w-full h-[136px]">
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[rgba(47,53,66,0.55)] text-white flex items-center justify-center pl-0.5">
                <Icon name="play" size={20} fill="currentColor" stroke={0} />
              </span>
              {post.video.duration && (
                <span className="absolute right-1.5 bottom-1.5 font-display text-[11px] font-bold text-white bg-[rgba(47,53,66,0.7)] rounded-full px-2 leading-[18px]">
                  {post.video.duration}
                </span>
              )}
              <span className="absolute left-1.5 top-1.5 flex items-center gap-1 text-[11px] font-bold text-on-brand bg-brand rounded-full px-2 leading-[18px]">
                <Icon name="video" size={12} />
                {L.videoWord}
              </span>
            </PhotoThumb>
          }
        >
          <div className="flex justify-between font-display font-bold text-[11.5px] text-ink-muted mt-1 px-1">
            <span>{post.video.resolution}</span>
            <span>{post.video.size}</span>
          </div>
        </Asset>
      )}

      {/* images */}
      {post.images.length > 0 && (
        <>
          <Label className="mt-4 mb-2">{L.imagesWord}</Label>
          <div className="grid grid-cols-3 gap-2">
            {post.images.map((im, i) => (
              <Asset
                key={i}
                selected={s.sel.has('i' + i)}
                onClick={() => s.toggle('i' + i)}
                thumb={<PhotoThumb seed={i + 2} src={im.url} className="w-full aspect-square" label={i + 1} />}
              />
            ))}
          </div>
        </>
      )}

      {/* download overlay */}
      {(s.pPhase === 'downloading' || s.pPhase === 'done') && (
        <Overlay>
          <Sheet>
            {s.pPhase === 'downloading' ? (
              <>
                <SheetIcon />
                <div className="font-bold text-[16px] mb-3">{L.downloading(s.dlDone, s.selCount)}</div>
                <Progress pct={s.dlPct} />
                <div className="text-[12px] text-ink-muted mt-2">{L.dlSub(s.selVideo, s.selImages)}</div>
              </>
            ) : (
              <>
                <SheetIcon ok />
                <div className="font-bold text-[16px] mb-3">{L.savedN(s.selCount)}</div>
                <Notice icon="folder" tone="success" className="mt-1.5">
                  <span className="block truncate">{L.savedPath(s.dlFolder)}</span>
                </Notice>
                <div className="flex gap-2.5 mt-4">
                  <Btn kind="primary" className="flex-1" onClick={() => s.setPPhase('ready')}>
                    {L.done}
                  </Btn>
                </div>
              </>
            )}
          </Sheet>
        </Overlay>
      )}
    </div>
  );
}
