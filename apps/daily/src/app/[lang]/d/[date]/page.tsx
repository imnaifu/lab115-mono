import { notFound, permanentRedirect } from "next/navigation";
import { href as langHref, isLang } from "@/lib/lang";
import { dayPath } from "@/lib/links";
import { readDigest } from "@/lib/store";

/**
 * `/d/2026-08-26` — THE DAY'S OLD ADDRESS, kept alive as a redirect.
 *
 * This route rendered a day until `ca56b80` (2026-09-02) moved days to
 * `/2026/08/26`. The move shipped with no redirect, so every day URL Google held
 * — and every one anybody had shared — began answering 404. Three weeks later the
 * URL Inspection API still reported ten of those dead addresses as "已提交，且已
 * 编入索引": Google had not yet noticed, was still offering them in results, and
 * was still sending people to a 404.
 *
 * SO THE ROUTE COMES BACK AS A REDIRECT AND NOTHING ELSE. It renders no markup
 * and holds no layout. Its whole job is to answer the question the old URL asks.
 *
 * WHEN DOES IT GO AWAY? It does not. Google's own guidance is a year at minimum,
 * and this site's crawl rate makes a year the floor rather than the target — the
 * old URLs measured above were last fetched between three and four weeks ago, and
 * a 308 only transfers when the crawler comes back to see it. More to the point,
 * the redirect costs one file read on a path nobody walks, while the links it
 * serves sit in other people's chat histories and inboxes, where they never
 * expire. See tools/gsc for the measurement this paragraph is quoting.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ lang: string; date: string }> };

export default async function LegacyDayPage({ params }: Params) {
  const { lang, date } = await params;
  if (!isLang(lang)) notFound();

  /**
   * THE DAY HAS TO EXIST BEFORE THIS POINTS AT IT.
   *
   * `readDigest` rejects a malformed date itself — which is also what keeps a
   * path traversal out of `[date]` — so this one call covers both "not a date"
   * and "a date this site never published". Redirecting without the check would
   * turn a 404 into a 308 to a 404, which is strictly worse for the crawler that
   * has to spend two fetches to learn the same thing.
   */
  if (!(await readDigest(date))) notFound();

  permanentRedirect(langHref(lang, dayPath(date)));
}
