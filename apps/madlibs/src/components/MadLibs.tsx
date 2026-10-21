"use client";

import { useState, useTransition } from "react";
import { reveal } from "@/app/actions";
import { track } from "@/lib/track";
import type { Segment, Theme } from "@/lib/types";
import { QuestionStep } from "./QuestionStep";
import { StoryReveal } from "./StoryReveal";
import { ThemePicker } from "./ThemePicker";

type Phase =
  | { name: "pick" }
  | { name: "fill"; theme: Theme; step: number }
  | { name: "reveal"; theme: Theme; segments: Segment[] };

/** The client root: pick a theme → answer one blank at a time → reveal. */
export function MadLibs({ themes }: { themes: Theme[] }) {
  const [phase, setPhase] = useState<Phase>({ name: "pick" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isRevealing, startRevealing] = useTransition();

  function startTheme(theme: Theme) {
    setAnswers({});
    setError(null);
    setPhase({ name: "fill", theme, step: 0 });
    track("start", { theme: theme.id });
  }

  function submit(theme: Theme) {
    setError(null);
    startRevealing(async () => {
      const result = await reveal(theme.id, answers);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPhase({ name: "reveal", theme, segments: result.segments });
      track("reveal", { theme: theme.id });
    });
  }

  if (phase.name === "pick") {
    return <ThemePicker themes={themes} onPick={startTheme} />;
  }

  if (phase.name === "fill") {
    const { theme, step } = phase;
    const blank = theme.blanks[step];
    const isLast = step === theme.blanks.length - 1;
    return (
      <QuestionStep
        // Keyed by blank so the input remounts — and autofocuses — on every step.
        key={blank.key}
        blank={blank}
        step={step}
        total={theme.blanks.length}
        value={answers[blank.key] ?? ""}
        isLast={isLast}
        isBusy={isRevealing}
        error={error}
        onChange={(value) => setAnswers((previous) => ({ ...previous, [blank.key]: value }))}
        onBack={() => (step === 0 ? setPhase({ name: "pick" }) : setPhase({ name: "fill", theme, step: step - 1 }))}
        onNext={() => (isLast ? submit(theme) : setPhase({ name: "fill", theme, step: step + 1 }))}
      />
    );
  }

  const otherThemes = themes.filter((candidate) => candidate.id !== phase.theme.id);
  return (
    <StoryReveal
      theme={phase.theme}
      segments={phase.segments}
      onReplay={() => {
        track("replay", { theme: phase.theme.id, mode: "same" });
        startTheme(phase.theme);
      }}
      onOther={() => {
        track("replay", { theme: phase.theme.id, mode: "other" });
        // Straight into a random different story rather than back to the list —
        // one tap from laughing to playing again.
        startTheme(otherThemes[Math.floor(Math.random() * otherThemes.length)] ?? phase.theme);
      }}
    />
  );
}
