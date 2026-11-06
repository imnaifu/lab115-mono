import Icon from './Icon.jsx';

const TABS = [
  ['list', 'tabList', 'list'],
  ['post', 'tabPost', 'download'],
];

export default function Tabs({ L, tab, setTab }) {
  return (
    <nav role="tablist" className="flex bg-paper px-4 gap-5 shrink-0 border-b border-line">
      {TABS.map(([key, strKey, icon]) => {
        const active = tab === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => setTab(key)}
            // -mb-px lets the 3px underline sit on top of the nav's hairline
            className={`flex-1 flex items-center justify-center gap-1.5 font-bold text-[13px] h-11 -mb-px border-b-[3px] transition-colors duration-[120ms] ${
              active ? 'text-ink border-brand' : 'text-ink-muted border-transparent hover:text-ink'
            }`}
          >
            <Icon name={icon} size={16} />
            {L[strKey]}
          </button>
        );
      })}
    </nav>
  );
}
