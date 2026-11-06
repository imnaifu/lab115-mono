import { useState } from 'react';
import Icon from './Icon.jsx';

// Flat pastel wells (Sokosoko's illustration fills) — no gradients, so a missing
// cover reads as a quiet placeholder rather than a photo.
const WELLS = ['#f3efe6', '#bcdcf2', '#bfe3cf', '#f6c6cf', '#d9d1f2', '#fdf1cc', '#f8d5b8'];

// Real thumbnail when `src` is given; falls back to a pastel placeholder when
// there is no src or the image fails to load (XHS CDN images can 403 without
// the right referrer). Pass sizing/rounding via className.
export default function PhotoThumb({ seed = 0, src, className = '', label, children, style }) {
  const [failed, setFailed] = useState(false);
  const well = WELLS[Math.abs(Number(seed) || 0) % WELLS.length];
  const showImg = src && !failed;

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{ background: well, ...style }}
    >
      {showImg ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : children ? null : (
        // Overlays (the video's play button) replace the placeholder glyph.
        <span className="text-[rgba(47,53,66,0.4)] flex">
          <Icon name="image" size={18} stroke={1.8} />
        </span>
      )}
      {label != null && (
        <span className="absolute left-1 top-1 z-10 min-w-[18px] text-center font-display text-[10px] font-extrabold text-ink bg-[rgba(255,255,255,0.92)] rounded-full px-1.5 leading-[16px]">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
