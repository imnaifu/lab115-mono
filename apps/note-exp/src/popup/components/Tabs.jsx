import Icon from './Icon.jsx';

const TABS = [
  ['list', 'tabList', 'list'],
  ['post', 'tabPost', 'download'],
];

export default function Tabs({ L, tab, setTab }) {
  return (
    <nav className="flex bg-header px-3.5 shrink-0">
      {TABS.map(([key, strKey, icon]) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex-1 flex items-center justify-center gap-1.5 font-semibold text-[12px] pt-1 pb-[9px] transition ${
              active ? 'text-white' : 'text-[#8b8b92]'
            }`}
          >
            <Icon name={icon} size={15} />
            {L[strKey]}
            {active && <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-brand" />}
          </button>
        );
      })}
    </nav>
  );
}
