const PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  list: '<path d="M9 6h12"/><path d="M9 12h12"/><path d="M9 18h12"/><circle cx="4.5" cy="6" r="0.5" fill="currentColor"/><circle cx="4.5" cy="12" r="0.5" fill="currentColor"/><circle cx="4.5" cy="18" r="0.5" fill="currentColor"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  heart: '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/>',
  comment: '<path d="M21 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-5.4A8 8 0 1 1 21 11.5z"/>',
  star: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 16.9 6.8 19.2l1-5.9L3.5 9.2l5.9-.9z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 6.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  arrowdown: '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  spinner: '<path d="M12 3a9 9 0 1 0 9 9"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L21 13"/><path d="M5.5 6h13l2.5 7v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z"/>',
  alert: '<path d="M12 8v5"/><circle cx="12" cy="16.5" r="0.4" fill="currentColor"/><path d="M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  video: '<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="M15.5 10l6-3v10l-6-3z"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  link: '<path d="M9 14a4 4 0 0 0 6 .5l2.5-2.5a4 4 0 0 0-5.7-5.7L10.5 7.7"/><path d="M15 10a4 4 0 0 0-6-.5L6.5 12a4 4 0 0 0 5.7 5.7L13.5 16.3"/>',
};

export default function Icon({ name, size = 16, stroke = 2, fill = 'none', className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '' }}
    />
  );
}
