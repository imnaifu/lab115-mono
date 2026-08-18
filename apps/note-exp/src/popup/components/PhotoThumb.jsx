import { useState } from 'react';
import Icon from './Icon.jsx';

// Muted, desaturated tones so a grid reads like a photo feed without rainbow slop.
const MUTE = [
  ['#e7ded6', '#cbbcae'], ['#d9e0dc', '#b6c4bc'], ['#e6dde3', '#cbb8c6'],
  ['#dde1e8', '#b8c1d0'], ['#e8e1d4', '#cdbf9f'], ['#dee6e6', '#b9cccb'],
  ['#ece0dd', '#d4b9b1'], ['#e0e2da', '#c2c7b3'],
];

// Real thumbnail when `src` is given; falls back to a gradient placeholder when
// there is no src or the image fails to load (XHS CDN images can 403 without
// the right referrer). Pass sizing/rounding via className.
export default function PhotoThumb({ seed = 0, src, className = '', label, children, style }) {
  const [failed, setFailed] = useState(false);
  const tone = MUTE[Math.abs(Number(seed) || 0) % MUTE.length];
  const showImg = src && !failed;

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(135deg, ${tone[0]}, ${tone[1]})`, ...style }}
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
      ) : (
        <span className="text-white/70 flex">
          <Icon name="image" size={18} stroke={1.7} />
        </span>
      )}
      {label != null && (
        <span className="absolute left-1 top-1 z-10 text-[9px] font-bold text-white/90 bg-black/30 rounded px-1 leading-tight">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
