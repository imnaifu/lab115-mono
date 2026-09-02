import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdminDay } from "@/components/AdminDay";

/** Dynamic and noindex for the same reasons as `/admin` — see the notes there. */
export const dynamic = "force-dynamic";

/**
 * yyyy-mm-dd, and the check is here rather than left to `readDigest`.
 *
 * That function tests the same pattern and returns null, which this page turns
 * into a 404 — so the validation is not load-bearing for correctness. It is here
 * because `generateMetadata` runs first and would otherwise put a garbage segment
 * into a document title.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  return {
    title: `${DATE_RE.test(date) ? date : "未找到"} · admin`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();
  return <AdminDay date={date} />;
}
