import Icon from './Icon.jsx';

export function Spinner({ size = 16 }) {
  return (
    <span className="rx-spin flex">
      <Icon name="spinner" size={size} stroke={2.2} />
    </span>
  );
}

export function Stat({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-[3px]">
      <Icon name={icon} size={12} />
      {children}
    </span>
  );
}

const KINDS = {
  primary: 'bg-brand text-white hover:brightness-110 active:brightness-95',
  secondary: 'bg-[#f1f1f3] text-ink hover:bg-[#e9e9ec]',
};

export function Btn({ kind = 'primary', icon, children, onClick, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold text-[13px] h-8 px-4 rounded-md transition disabled:opacity-40 disabled:pointer-events-none ${KINDS[kind]} ${className}`}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

export function Progress({ pct }) {
  return (
    <div className="w-full h-[7px] rounded-full bg-[#eeeef0] overflow-hidden my-1">
      <div className="h-full bg-brand rounded-full transition-[width] duration-150" style={{ width: pct + '%' }} />
    </div>
  );
}

export function Overlay({ children }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-[rgba(20,20,24,0.34)] backdrop-blur-[3px] rx-fade">
      {children}
    </div>
  );
}

export function Sheet({ children }) {
  return <div className="w-full bg-white rounded-t-[18px] px-[22px] pt-6 pb-5 text-center rx-rise">{children}</div>;
}

export function SheetIcon({ ok }) {
  return (
    <div
      className={`w-[52px] h-[52px] rounded-full flex items-center justify-center mx-auto mb-3 ${
        ok ? 'bg-brand-tint text-brand' : 'rx-spin text-brand'
      }`}
    >
      <Icon name={ok ? 'check' : 'spinner'} size={26} stroke={ok ? 2.6 : 2.2} />
    </div>
  );
}
