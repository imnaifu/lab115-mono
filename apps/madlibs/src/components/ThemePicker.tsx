import type { Theme } from "@/lib/types";

export function ThemePicker({ themes, onPick }: { themes: Theme[]; onPick: (theme: Theme) => void }) {
  return (
    <section>
      <h2 className="mb-4 text-center text-ink-soft">选一个故事</h2>
      <ul className="grid gap-3">
        {themes.map((theme) => (
          <li key={theme.id}>
            <button
              type="button"
              onClick={() => onPick(theme)}
              className="w-full rounded-card border border-line bg-card px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-accent"
            >
              <span className="block text-lg font-semibold">{theme.title}</span>
              <span className="mt-1 block text-sm text-ink-soft">
                {theme.teaser} · {theme.blanks.length} 个词
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
