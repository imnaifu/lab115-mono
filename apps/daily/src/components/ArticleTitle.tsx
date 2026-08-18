import type { Lang } from "@/lib/lang";
import type { Article } from "@/lib/types";

/** The original headline's size relative to the Chinese one above it. */
const ORIGINAL = {
  hero: "mt-2 text-base",
  card: "mt-1.5 text-sm",
} as const;

/**
 * A headline, and on the Chinese side the original underneath it.
 *
 * This is the ONE deliberate exception to one-language-at-a-time (see the note in
 * lib/i18n.ts), and it is an exception because the two lines are not a translated
 * pair the way 归档 / Archive was. A headline is a name: it is how the piece is
 * referred to everywhere else, how it is searched for, and what the reader will
 * see if they click through. A Chinese reader wants to know what the article says
 * AND to recognise it on arrival, so both earn their place.
 *
 * The English side shows one line, because there the original headline already IS
 * the English — printing it twice would be the mistake, not the service.
 *
 * Returns the heading's CONTENT, not the heading: the card is an `<h3>` inside a
 * list of cards and the article page is its `<h1>`, and that distinction belongs
 * to the page, not here.
 */
/**
 * The Chinese headline when there is one and the reader is on the Chinese side,
 * otherwise the original.
 *
 * Exported because anywhere an article is NAMED in one line — the share dialog's
 * "which article is this" line — has to name it the same way the heading does.
 * Empty for the English side, and empty in Chinese whenever the headline was
 * already Chinese: summarize.ts collapses that case to "", so this stays a single
 * truthiness check rather than a comparison repeated per renderer.
 */
export function displayTitle(article: Article, lang: Lang): string {
  const translated = lang === "zh" ? article.titleZh?.trim() : "";
  return translated || article.title;
}

export function ArticleTitle({
  article,
  lang,
  variant,
}: {
  article: Article;
  lang: Lang;
  variant: keyof typeof ORIGINAL;
}) {
  const translated = lang === "zh" ? article.titleZh?.trim() : "";

  if (!translated) return <>{article.title}</>;

  return (
    <>
      {translated}
      {/* `font-medium` against the heading's `font-bold`, and one step down in
          size: the original is here to be recognised, not to compete with the
          line that carries the meaning. `break-words` because a headline can
          contain a URL-like token that would otherwise widen the card. */}
      <span
        className={`block font-medium break-words text-ink-soft ${ORIGINAL[variant]}`}
      >
        {article.title}
      </span>
    </>
  );
}
