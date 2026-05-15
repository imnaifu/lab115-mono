import type { Lang } from "../data/categories";
import { I18N } from "../i18n";

type Props = { lang: Lang };

export default function Intro({ lang }: Props) {
  const t = I18N[lang];
  return (
    <div className="intro">
      <div className="lede" dangerouslySetInnerHTML={{ __html: t.lede }} />
      <div className="meta">
        <div>{t.meta1}</div>
        <div>{t.meta2}</div>
        <div>{t.meta3}</div>
      </div>
    </div>
  );
}
