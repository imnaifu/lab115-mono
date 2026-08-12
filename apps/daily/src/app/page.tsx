import { DigestView, EmptyState } from "@/components/DigestView";
import { dateKey } from "@/lib/config";
import { readDigest, readLatest } from "@/lib/store";

// Read from the git clone on every request — the cron rewrites those files
// underneath a long-running server, so nothing here may be cached at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const today = dateKey(new Date());

  // Before the day's run has happened there is no file for `today` yet; fall
  // back to the newest digest on disk so the page is never blank.
  const digest = (await readDigest(today)) ?? (await readLatest());

  if (!digest) {
    return (
      <div className="page">
        <EmptyState date={today} />
      </div>
    );
  }

  return <DigestView digest={digest} />;
}
