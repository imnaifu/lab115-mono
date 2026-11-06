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
      className="flex gap-2.5 px-4 py-2.5 border-b border-line hover:bg-paper-soft transition-colors duration-[120ms] cursor-pointer"
    >
      {/* real cover thumbnail; falls back to a flat pastel well if it fails to load */}
      <PhotoThumb seed={(n.title || '').length} src={n.cover} className="w-12 h-16 shrink-0 rounded-sm" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-[20px] font-medium text-ink truncate">{n.title}</div>
        <div className="flex items-center gap-1.5 text-[12px] text-ink-muted mt-0.5">
          <PhotoThumb seed={(n.author || '').length} className="w-4 h-4 rounded-full" />
          <span className="truncate">{n.author}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[11.5px] text-ink-muted mt-1.5">
          <Stat icon="heart">{statText(n.likes, L)}</Stat>
          <Stat icon="star">{statText(n.collects, L)}</Stat>
          <Stat icon="comment">{statText(n.comments, L)}</Stat>
          <span className="ml-auto">{n.time || '—'}</span>
        </div>
      </div>
    </Wrapper>
  );
}
