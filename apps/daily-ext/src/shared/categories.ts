/**
 * The site's eight category colours, copied from apps/daily/config.json
 * (`categories[].accent` / `accentDark`).
 *
 * A COPY, because the feed carries the category id and label but not its
 * colour. Labels always come from the feed, so a renamed category still reads
 * right; an id that is not in this table (a category added on the site later)
 * gets the neutral ink colour instead of a wrong one.
 */
export const CATEGORY_COLORS: Record<string, { light: string; dark: string }> = {
  tech: { light: "#3B3563", dark: "#8F86C9" },
  business: { light: "#EFA050", dark: "#EFA050" },
  investing: { light: "#B08D2E", dark: "#D9B85A" },
  economy: { light: "#4F6D9E", dark: "#8CA9D9" },
  science: { light: "#2F7D91", dark: "#63B4C6" },
  design: { light: "#A9523C", dark: "#D98A70" },
  living: { light: "#6E8B3D", dark: "#A4C46A" },
  culture: { light: "#9E5C81", dark: "#CF92B4" },
};

const NEUTRAL = { light: "#666b7a", dark: "#a9afbc" };

export function categoryColor(id: string): { light: string; dark: string } {
  return CATEGORY_COLORS[id] ?? NEUTRAL;
}
