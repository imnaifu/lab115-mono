import type { Lang } from "../data/categories";
import { I18N } from "../i18n";

type Props = { lang: Lang };

export default function SiteFooter({ lang }: Props) {
  const t = I18N[lang];
  return (
    <footer>
      <div>{t.foot1}</div>
      <div>{t.foot2}</div>
    </footer>
  );
}
