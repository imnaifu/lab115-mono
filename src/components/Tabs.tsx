import { CATEGORIES, type CategoryKey, type Lang } from "../data/categories";
import { I18N } from "../i18n";
import SvgIcon from "./SvgIcon";

type Props = {
  lang: Lang;
  active: CategoryKey;
  onSelect: (key: CategoryKey) => void;
};

export default function Tabs({ lang, active, onSelect }: Props) {
  const t = I18N[lang];
  return (
    <nav className="tabs">
      {CATEGORIES.map((c, i) => (
        <button
          key={c.key}
          className={c.key === active ? "on" : ""}
          onClick={() => onSelect(c.key)}
        >
          <SvgIcon name={`tab_${c.key}`} />
          <span>{t.cat[c.key]}</span>
          <span className="num">{String(i + 1).padStart(2, "0")}</span>
        </button>
      ))}
    </nav>
  );
}
