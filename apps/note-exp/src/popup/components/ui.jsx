import Icon from './Icon.jsx';
import Illust from './Illust.jsx';

export function Spinner({ size = 16 }) {
  return (
    <span className="rx-spin flex">
      <Icon name="spinner" size={size} stroke={2.2} />
    </span>
  );
}

export function Stat({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon name={icon} size={12} />
      {children}
    </span>
  );
}

// Everything you press is a pill. One red primary per view; text on red is
// on-brand white (ink on red fails contrast).
const KINDS = {
  primary: 'bg-brand text-on-brand border-transparent hover:bg-brand-deep active:translate-y-px',
  secondary: 'bg-paper text-ink border-line-strong hover:bg-paper-sunk',
};

export function Btn({ kind = 'primary', icon, children, onClick, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 font-bold text-[13px] tracking-[0.04em] h-9 px-4 rounded-full border-2 transition-colors duration-[120ms] disabled:bg-paper-sunk disabled:text-ink-muted disabled:border-transparent disabled:pointer-events-none ${KINDS[kind]} ${className}`}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function Progress({ pct }) {
  return (
    <div className="w-full h-2 rounded-full bg-paper-sunk overflow-hidden my-1">
      <div className="h-full bg-brand rounded-full transition-[width] duration-150" style={{ width: pct + '%' }} />
    </div>
  );
}

export function Overlay({ children }) {
  return <div className="absolute inset-0 z-30 flex items-end justify-center bg-scrim rx-fade">{children}</div>;
}

export function Sheet({ children }) {
  return (
    <div className="w-full bg-paper rounded-t-lg shadow-sheet px-5 pt-2 pb-5 text-center rx-rise">
      <div className="w-10 h-1 rounded-full bg-line-strong mx-auto mb-4" />
      {children}
    </div>
  );
}

export function SheetIcon({ ok }) {
  return (
    <div
      className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${
        ok ? 'bg-success-soft text-success' : 'bg-paper-sunk text-ink'
      }`}
    >
      <span className={ok ? 'flex' : 'flex rx-spin'}>
        <Icon name={ok ? 'check' : 'spinner'} size={26} stroke={ok ? 2.6 : 2.2} />
      </span>
    </div>
  );
}

// Empty / not-on-the-right-page state (Sokosoko EmptyState): a 120px well with an
// illustration, a short title, one way out.
export function EmptyState({ art, title, sub, btn, onBtn }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-7 py-10 h-full gap-2">
      <span className="w-[120px] h-[120px] rounded-full bg-well flex items-center justify-center mb-2">
        <Illust name={art} className="w-[76px] h-[76px]" />
      </span>
      <div className="font-bold text-[17px] leading-[26px] text-ink">{title}</div>
      <div className="text-[14px] leading-[22px] text-ink-muted mb-3 max-w-[280px]">{sub}</div>
      <Btn kind="secondary" onClick={onBtn}>
        {btn}
      </Btn>
    </div>
  );
}

// Inline notice (Sokosoko Notice). `tone` picks the soft ground and icon colour.
const TONES = {
  brand: ['bg-brand-soft', 'text-ink'],
  success: ['bg-success-soft', 'text-success'],
};
export function Notice({ icon, tone = 'brand', children, className = '' }) {
  const [ground, iconColor] = TONES[tone];
  return (
    <div className={`flex gap-2.5 items-start px-3.5 py-2.5 rounded-md text-[13px] leading-[20px] text-ink text-left ${ground} ${className}`}>
      <Icon name={icon} size={18} className={`mt-px ${iconColor}`} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// Uppercase-style section label (Sokosoko sk-label).
export function Label({ children, className = '' }) {
  return <div className={`text-[12px] leading-[18px] font-medium tracking-[0.12em] uppercase text-ink-muted ${className}`}>{children}</div>;
}
