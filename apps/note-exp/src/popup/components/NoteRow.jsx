import PhotoThumb from './PhotoThumb.jsx';
import { Stat } from './ui.jsx';

// Counters the list API doesn't return (collect/comment/share on the /explore
// homefeed and on profile lists) arrive empty. Render a dash instead of letting
// the icon sit next to a blank — and never a 0, which would read as a real count.
function statText(value, L) {
  return value === '' || value === undefined || value === null ? '—' : L.fmt(value);
}

export default function NoteRow({ n, L }) {
  // Whole row links to the note detail page (opens in a new tab).
  const Wrapper = n.url ? 'a' : 'div';
  const wrapperProps = n.url
    ? { href: n.url, target: '_blank', rel: 'noreferrer' }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="flex gap-[9px] px-3.5 py-[9px] border-b border-line hover:bg-[#fafafb] cursor-pointer"
    >
      {/* real cover thumbnail; falls back to a gradient if it fails to load */}
      <PhotoThumb seed={(n.title || '').length} src={n.cover} className="w-[46px] h-[60px] shrink-0 rounded" />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-ink truncate">{n.title}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink2 mt-1">
          <PhotoThumb seed={(n.author || '').length} className="w-3.5 h-3.5 rounded-full" />
          <span className="truncate">{n.author}</span>
        </div>
        <div className="flex items-center gap-[9px] text-[10.5px] text-ink2 mt-1.5">
          <Stat icon="heart">{statText(n.likes, L)}</Stat>
          <Stat icon="star">{statText(n.collects, L)}</Stat>
          <Stat icon="comment">{statText(n.comments, L)}</Stat>
          <span className="text-ink3 ml-auto">{n.time || '—'}</span>
        </div>
      </div>
    </Wrapper>
  );
}
