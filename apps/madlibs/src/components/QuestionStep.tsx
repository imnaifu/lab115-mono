import type { FormEvent } from "react";
import { MAX_ANSWER_LENGTH, type Blank } from "@/lib/types";

type Props = {
  blank: Blank;
  step: number;
  total: number;
  value: string;
  isLast: boolean;
  isBusy: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

/** One blank per screen, so no answer is chosen with the others in view. */
export function QuestionStep({ blank, step, total, value, isLast, isBusy, error, onChange, onBack, onNext }: Props) {
  const isEmpty = value.trim() === "";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isEmpty && !isBusy) onNext();
  }

  function rollExample() {
    // Skip the current value so a second tap always changes the word.
    const choices = blank.examples.filter((example) => example !== value);
    onChange(choices[Math.floor(Math.random() * choices.length)] ?? blank.examples[0]);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-line bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <span className="text-sm tabular-nums text-ink-soft">
          {step + 1} / {total}
        </span>
      </div>

      <label htmlFor="answer" className="block text-2xl font-semibold">
        {blank.label}
      </label>
      <div className="mt-4 flex gap-2">
        <input
          id="answer"
          autoFocus
          autoComplete="off"
          enterKeyHint={isLast ? "done" : "next"}
          maxLength={MAX_ANSWER_LENGTH}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`比如：${blank.examples[0]}`}
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-lg outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={rollExample}
          aria-label="帮我想一个"
          title="帮我想一个"
          className="shrink-0 rounded-xl border border-line px-4 text-xl hover:border-accent"
        >
          🎲
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      <div className="mt-6 flex justify-between gap-3">
        <button type="button" onClick={onBack} className="rounded-xl px-4 py-3 text-ink-soft hover:text-ink">
          {step === 0 ? "换个故事" : "上一个"}
        </button>
        <button
          type="submit"
          disabled={isEmpty || isBusy}
          className="rounded-xl bg-accent px-6 py-3 font-semibold text-accent-ink transition disabled:opacity-40"
        >
          {isLast ? (isBusy ? "揭晓中…" : "揭晓故事") : "下一个"}
        </button>
      </div>
    </form>
  );
}
