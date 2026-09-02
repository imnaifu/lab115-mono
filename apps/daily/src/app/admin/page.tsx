import type { Metadata } from "next";
import { AdminOverview } from "@/components/AdminOverview";

/**
 * `/admin` — the scoring dashboard.
 *
 * THE PASSWORD IS NOT HERE. `proxy.ts` holds the Basic-auth branch, so the whole
 * subtree is covered including any route added later — a per-page check is one
 * new file away from a page that forgot. See the note beside that branch for why
 * an unconfigured deployment answers 404 rather than 401.
 *
 * `force-dynamic` because it reads the git clone the cron rewrites, same as every
 * reader-facing page. There is nothing to cache anyway: the one person who opens
 * this is opening it to see what this morning's run did.
 */
export const dynamic = "force-dynamic";

/**
 * `noindex, nofollow` — belt to the `X-Robots-Tag` the 401 already carries.
 *
 * A crawler never gets this far without the password, so this tag is for the one
 * case where it might: a future misconfiguration that leaves the route open. It
 * costs one object and it is the difference between a mistake and an indexed
 * mistake.
 */
export const metadata: Metadata = {
  title: "打分数据 · admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  return <AdminOverview />;
}
