import { MadLibs } from "@/components/MadLibs";
import { listThemes } from "@/lib/game";

/**
 * A server component, so `listThemes()` runs here and only the public half of
 * each template (title, teaser, questions) is serialised into the page. The
 * stories themselves never leave the server; see lib/game.ts.
 */
export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-10 sm:py-16">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">疯狂填词</h1>
        <p className="mt-2 text-ink-soft">不看故事，先填词。填完再看你写了个什么。</p>
      </header>
      <MadLibs themes={listThemes()} />
      <footer className="mt-auto pt-12 text-center text-sm text-ink-soft">
        <a href="https://lab115.com" className="hover:text-ink">
          LAB115
        </a>
      </footer>
    </main>
  );
}
