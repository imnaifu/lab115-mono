import type { CategoryKey, Lang } from "../data/categories";
import { I18N } from "../i18n";

type Props = {
  lang: Lang;
  category: CategoryKey;
};

export default function CategoryHead({ lang, category }: Props) {
  const t = I18N[lang];
  return (
    <div className="category-head">
      <div>
        <h2>{t.cat[category]}</h2>
        <div className="tag">{t.tagline[category]}</div>
      </div>
      <div className="hint">{t.hint[category]}</div>
    </div>
  );
}
