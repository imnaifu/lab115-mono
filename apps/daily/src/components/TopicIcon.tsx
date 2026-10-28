import { TOPIC_FALLBACK, TOPIC_FILLS, TOPIC_PATHS } from "@/lib/topic-art";

/*
 * The drawings and the fills live in lib/topic-art, so the share poster can
 * draw the same icon on the same pastel as the page — see the notes there.
 */

/** The `bg-` class for each fill name, written out so Tailwind sees the
 *  classes. */
const FILL_CLASS = {
  sky: "bg-fill-sky",
  mint: "bg-fill-mint",
  pink: "bg-fill-pink",
  lilac: "bg-fill-lilac",
  yellow: "bg-fill-yellow",
} as const;

/** The pastel behind a topic's icon, as a `bg-` class. */
export function topicFill(id: string | undefined): string {
  const name = id ? TOPIC_FILLS[id] : undefined;
  return name ? FILL_CLASS[name] : "bg-card";
}

/** A topic's line icon. Decorative: the topic's name is always beside it. */
export function TopicIcon({
  id,
  className = "size-4",
}: {
  id: string | undefined;
  className?: string;
}) {
  const paths = (id && TOPIC_PATHS[id]) || TOPIC_FALLBACK;
  return (
    <svg
      viewBox="0 0 24 24"
      className={`flex-none ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
