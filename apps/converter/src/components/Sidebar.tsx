import type { Lang } from "../data/categories";
import { getCategory } from "../data/categories";
import { I18N } from "../i18n";
import type { FavEntry } from "./ConverterApp";
import { fmt } from "../utils/format";
import SvgIcon from "./SvgIcon";

type Props = {
  lang: Lang;
  favs: FavEntry[];
  onLoad: (entry: FavEntry) => void;
  onRemove: (idx: number) => void;
};

export default function Sidebar({ lang, favs, onLoad, onRemove }: Props) {
  const t = I18N[lang];
  return (
    <aside className="sidebar">
      <section className="side-section">
        <h3>{t.fav}</h3>
        <div>
          {favs.length === 0 ? (
            <div className="empty">{t.emptyFav}</div>
          ) : (
            favs.map((e, idx) => {
              const cat = getCategory(e.cat);
              if (!cat) return null;
              const u = cat.units.find((x) => x.key === e.unit) || cat.units[0];
              return (
                <div className="entry" key={`${e.cat}|${e.unit}|${e.value}|${e.ts}`} onClick={() => onLoad(e)}>
                  <div className="entry-icon">
                    <SvgIcon name={`tab_${e.cat}`} />
                  </div>
                  <div className="entry-body">
                    <div className="entry-val">
                      {fmt(e.value, u.decimals)} <span className="entry-sym">{u.sym}</span>
                    </div>
                    <div className="entry-cat">{t.cat[e.cat]}</div>
                  </div>
                  <button
                    className="entry-x"
                    title="remove"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onRemove(idx);
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </aside>
  );
}
