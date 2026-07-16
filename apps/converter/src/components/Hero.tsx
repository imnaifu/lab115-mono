import type { Category, Lang } from "../data/categories";
import { I18N } from "../i18n";
import { baseToUnit, findClosestRef } from "../utils/convert";
import { fmt, fmtCount } from "../utils/format";
import SvgIcon from "./SvgIcon";

type Props = {
  lang: Lang;
  cat: Category;
  baseValue: number;
  sourceUnit: string;
  isFav: boolean;
  onToggleFav: () => void;
};

export default function Hero({ lang, cat, baseValue, sourceUnit, isFav, onToggleFav }: Props) {
  const t = I18N[lang];
  const srcUnit = cat.units.find(u => u.key === sourceUnit) || cat.units[0];
  const srcVal = baseToUnit(srcUnit, baseValue);
  const { ref, ratio } = findClosestRef(cat.key, baseValue);

  const numStr = fmt(srcVal, srcUnit.decimals);
  // Step the hero number down for long strings so it never overflows on the largest viewport.
  let numSize = 64;
  if (numStr.length > 12) numSize = 36;
  else if (numStr.length > 9) numSize = 44;
  else if (numStr.length > 7) numSize = 54;

  const equivHtml = cat.isTemp
    ? `${t.approx} <b>${ref[lang]}</b>`
    : `${t.approx} <b>${fmtCount(ratio)}</b> ${ref[lang]}`;

  return (
    <div className="hero">
      <div className="hero-art">
        <SvgIcon name={ref.svg} />
      </div>
      <div className="hero-text">
        <div className="hero-value">
          <span className="hero-num" style={{ fontSize: `${numSize}px` }}>
            {numStr}
          </span>
          <span className="hero-sym">{srcUnit.sym}</span>
        </div>
        <div className="hero-eq" dangerouslySetInnerHTML={{ __html: equivHtml }} />
        <button
          className={`star-btn ${isFav ? "on" : ""}`}
          onClick={onToggleFav}
          title={t.save}
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              d="M12 2l3 7h7l-5.6 4.5L18 21l-6-4-6 4 1.6-7.5L2 9h7z"
              fill="currentColor"
            />
          </svg>
          <span>{isFav ? t.saved : t.save}</span>
        </button>
      </div>
    </div>
  );
}
