import Icon from './Icon.jsx';
import PhotoThumb from './PhotoThumb.jsx';
import { Btn, Progress, Overlay, Sheet, SheetIcon } from './ui.jsx';

function Asset({ selected, onClick, children, thumb }) {
  return (
    <button onClick={onClick} className="relative block w-full text-left group">
      <div className={`overflow-hidden transition ${selected ? 'ring-[2.5px] ring-brand rounded' : 'rounded'}`}>{thumb}</div>
      <span
        className={`absolute top-1.5 right-1.5 w-[19px] h-[19px] rounded-full flex items-center justify-center text-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition ${
          selected ? 'bg-brand' : 'bg-white/85'
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
    return (
      <div className="flex flex-col items-center justify-center text-center px-7 py-14 h-full gap-1">
        <span className="w-[60px] h-[60px] rounded-full flex items-center justify-center mb-3 bg-brand-tint text-brand">
          <Icon name="alert" size={30} stroke={1.7} />
        </span>
        <div className="font-bold text-[15px] text-ink">{L.errT}</div>
        <div className="text-[12px] text-ink2 leading-relaxed mb-3.5 max-w-[240px]">{L.errS}</div>
        <Btn kind="secondary" onClick={() => s.setPPhase('ready')}>
          {L.errBtn}
        </Btn>
      </div>
    );
  }

  // Use the first image (the cover frame) as the video poster when available.
  const videoPoster = post.images[0]?.url;

  return (
    <div className="px-3.5 py-3.5">
      {/* post head */}
      <div className="flex items-center gap-2.5">
        <PhotoThumb seed={1} src={post.avatar} className="w-[34px] h-[34px] rounded-full shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[13px] text-ink truncate">{post.author}</div>
          <div className="text-[11px] text-ink3">{post.time}</div>
        </div>
        {post.noteUrl && (
          <a
            href={post.noteUrl}
            target="_blank"
            rel="noreferrer"
            className="text-ink2 hover:text-brand hover:bg-black/5 p-1.5 rounded-md flex cursor-pointer"
          >
            <Icon name="link" size={15} />
          </a>
        )}
      </div>
      <div className="font-semibold text-[13.5px] leading-snug mt-2.5 mb-3.5">{post.title}</div>

      <div className="text-[12px] text-ink2 mb-2.5">
        <b className="text-brand">{post.video ? 1 : 0}</b> {L.videoUnit} · <b className="text-brand">{post.images.length}</b> {L.imageUnit}
      </div>

      {/* video */}
      {post.video && (
        <Asset
          selected={s.sel.has('v')}
          onClick={() => s.toggle('v')}
          thumb={
            <PhotoThumb seed={9} src={videoPoster} className="w-full h-[132px]">
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center pl-0.5">
                <Icon name="play" size={20} fill="currentColor" stroke={0} />
              </span>
              {post.video.duration && (
                <span className="absolute right-1.5 bottom-1.5 text-[10px] font-semibold text-white bg-black/50 rounded px-1.5 py-0.5">
                  {post.video.duration}
                </span>
              )}
              <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 text-[10px] font-bold text-white bg-brand rounded px-1.5 py-0.5">
                <Icon name="video" size={12} />
                {L.videoWord}
              </span>
            </PhotoThumb>
          }
        >
          <div className="flex justify-between text-[10.5px] text-ink2 mt-1.5">
            <span>{post.video.resolution}</span>
            <span>{post.video.size}</span>
          </div>
        </Asset>
      )}

      {/* images */}
      {post.images.length > 0 && (
        <>
          <div className="text-[11px] font-semibold text-ink2 mt-4 mb-2.5">{L.imagesWord}</div>
          <div className="grid grid-cols-3 gap-[5px]">
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
                <div className="font-bold text-[15px] mb-3">{L.downloading(s.dlDone, s.selCount)}</div>
                <Progress pct={s.dlPct} />
                <div className="text-[11.5px] text-ink2 mt-2">{L.dlSub(s.selVideo, s.selImages)}</div>
              </>
            ) : (
              <>
                <SheetIcon ok />
                <div className="font-bold text-[15px] mb-3">{L.savedN(s.selCount)}</div>
                <div className="flex items-center gap-2 bg-[#f6f6f8] rounded-md px-3 py-2.5 text-[12px] text-ink mt-1.5">
                  <Icon name="folder" size={15} />
                  <span className="flex-1 text-left truncate">{L.savedPath(s.dlFolder)}</span>
                </div>
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
