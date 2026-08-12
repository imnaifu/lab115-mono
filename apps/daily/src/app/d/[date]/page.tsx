import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DigestView } from "@/components/DigestView";
import { readDigest } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { date } = await params;
  return { title: `今日速读 · ${date}` };
}

export default async function DayPage({ params }: Params) {
  const { date } = await params;
  // readDigest validates the yyyy-mm-dd shape, so a crafted [date] cannot walk
  // out of the repo directory.
  const digest = await readDigest(date);
  if (!digest) notFound();

  return <DigestView digest={digest} />;
}
