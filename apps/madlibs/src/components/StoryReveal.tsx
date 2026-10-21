import { useState } from "react";
import { track } from "@/lib/track";
import type { Segment, Theme } from "@/lib/types";

type Props = {
  theme: Theme;
  segments: Segment[];
  onReplay: () => void;
  onOther: () => void;
};

const SITE_LINE = "—— 来自「疯狂填词」madlibs.lab115.com";

export function StoryReveal({ theme, segments, onReplay, onOther }: Props) {
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");

  async function copyStory() {
    const story = segments.map((segment) => segment.text).join("");
    try {
      await navigator.clipboard.writeText(`《${theme.title}》\n${story}\n\n${SITE_LINE}`);
      setCopyState("done");
      track("copy", { theme: theme.id });
    } catch {
      // Clipboard needs a secure context and a user gesture; some in-app
      // browsers refuse it anyway. Say so instead of pretending it worked.
      setCopyState("failed");
    }
  }

  return (
    <section className="animate-rise">
      <article className="rounded-card border border-line bg-card p-5 sm:p-7">
        <h2 className="mb-4 text-center text-xl font-bold">《{theme.title}》</h2>
        <p className="whitespace-pre-line text-lg leading-loose">
          {segments.map((segment, index) =>
            segment.filled ? (
              <mark key={index} className="rounded-md bg-mark px-1 font-semibold text-mark-ink">
                {segment.text}
              </mark>
            ) : (
              <span key={index}>{segment.text}</span>
            ),
          )}
        </p>
      </article>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={copyStory}
          className="col-span-2 rounded-xl bg-accent px-6 py-3 font-semibold text-accent-ink"
        >
          {copyState === "done" ? "已复制，发给朋友吧" : copyState === "failed" ? "复制失败，请长按选择文字" : "复制故事"}
        </button>
        <button type="button" onClick={onReplay} className="rounded-xl border border-line px-4 py-3 hover:border-accent">
          再填一次
        </button>
        <button type="button" onClick={onOther} className="rounded-xl border border-line px-4 py-3 hover:border-accent">
          换个故事
        </button>
      </div>
    </section>
  );
}
