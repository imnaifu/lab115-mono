import type { Lang } from "../data/categories";
import { I18N } from "../i18n";

type Props = {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
};

export default function TopBar({ lang, onLangChange }: Props) {
  const t = I18N[lang];
  return (
    <div className="topbar">
      <div className="brand">
        <div className="mark">
          <span>{t.brand1}</span> · <em>{t.brand2}</em>
        </div>
        <div className="sub">{t.edition}</div>
      </div>
      <div className="lang-toggle">
        <button className={lang === "zh" ? "on" : ""} onClick={() => onLangChange("zh")}>
          中文
        </button>
        <button className={lang === "en" ? "on" : ""} onClick={() => onLangChange("en")}>
          EN
        </button>
      </div>
    </div>
  );
}
