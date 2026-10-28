import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnyExperiment, ControlSpec, Scene } from "../core/experiment.ts";
import { experiments } from "../core/registry.ts";
import { buildScene, formatMetric, mergeConfig } from "../core/scene.ts";
import type { StorySpec } from "../core/story.ts";
import { type AssetLibrary, loadAssets } from "../assets/library.ts";
import { loadFonts } from "../render/fonts.ts";
import { renderFrame } from "../render/frame.ts";
import { NarrationPlayer } from "./narrationPlayer.ts";

// Stories and configs are plain JSON files; the preview reads the same files the CLI uses.
const storyFiles = import.meta.glob<StorySpec>("/stories/*.json", { eager: true, import: "default" });
const configFiles = import.meta.glob<unknown>("/configs/*.json", { eager: true, import: "default" });
const stories = Object.fromEntries(Object.values(storyFiles).map((story) => [story.name, story]));
const SANDBOX = "__sandbox__";
const SPEEDS = [0.25, 0.5, 1, 2, 4];

/** The story's config file with its configOverrides applied — the editable starting point. */
function configFor(story: StorySpec | undefined): unknown {
  const file = story?.config ? (configFiles[`/${story.config}`] ?? {}) : {};
  return mergeConfig(file, story?.configOverrides ?? {});
}

/** A story that just plays a whole run, for exploring settings without writing JSON. */
function sandboxStory(experiment: AnyExperiment, compare: string[], seed: number): StorySpec {
  return {
    name: "sandbox",
    experiment: experiment.id,
    title: experiment.meta.title,
    seed,
    compare,
    batch: { runs: 50, seedStart: 1 },
    showIds: true,
    chapters: [
      { id: "run", kind: "sim", sim: { from: "start", to: "end", speed: 60 } },
      { id: "results", kind: "chart", duration: 8, heading: "Results" },
    ],
  };
}

function getPath(object: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], object);
}

function setPath(object: unknown, path: string, value: unknown): unknown {
  const [head, ...rest] = path.split(".");
  const source = (object ?? {}) as Record<string, unknown>;
  return { ...source, [head]: rest.length === 0 ? value : setPath(source[head], rest.join("."), value) };
}

function ControlField({ spec, config, onChange }: { spec: ControlSpec; config: unknown; onChange: (value: unknown) => void }) {
  const value = getPath(config, spec.path);
  if (spec.type === "select") {
    return (
      <label className="field">
        <span>{spec.label}</span>
        <select value={String(value)} onChange={(event) => onChange(event.target.value)}>
          {spec.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (spec.type === "text") {
    const text = Array.isArray(value) ? value.join(",") : String(value ?? "");
    return (
      <label className="field" title={spec.help}>
        <span>{spec.label}</span>
        <input
          defaultValue={text}
          key={text}
          onBlur={(event) => onChange(Array.isArray(value) ? event.target.value.split(",").map((part) => Number(part.trim())) : event.target.value)}
        />
      </label>
    );
  }
  return (
    <label className="field" title={spec.help}>
      <span>{spec.label}</span>
      <input type="number" value={Number(value)} min={spec.min} max={spec.max} step={spec.step} onChange={(event) => event.target.value !== "" && onChange(Number(event.target.value))} />
    </label>
  );
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}

export function App() {
  const firstStory = stories["queue-demo"] ?? Object.values(stories)[0];
  const [storyName, setStoryName] = useState<string>(firstStory?.name ?? SANDBOX);
  const [experimentId, setExperimentId] = useState<string>(firstStory?.experiment ?? Object.keys(experiments)[0]);
  const experiment = experiments[experimentId];
  const [config, setConfig] = useState<unknown>(() => experiment.parseConfig(configFor(firstStory)));
  const [seed, setSeed] = useState<number>(firstStory?.seed ?? 1);
  const [compare, setCompare] = useState<string[]>(firstStory?.compare ?? experiment.variants.slice(0, 2).map((variant) => variant.id));
  const [lowRes, setLowRes] = useState(false);
  const [clean, setClean] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [tab, setTab] = useState<"metrics" | "assumptions" | "definitions" | "script">("metrics");
  const [fontsReady, setFontsReady] = useState(false);
  // Generated narration clips (key → seconds) from the dev server; null until fetched.
  const [manifest, setManifest] = useState<Record<string, number> | null>(null);
  const [narrationOn, setNarrationOn] = useState(true);
  const [loadedClips, setLoadedClips] = useState(0);
  // Bumped on every seek so a playing narration restarts from the new position.
  const [seekVersion, setSeekVersion] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef(new NarrationPlayer());
  const timeRef = useRef(0);

  const [library, setLibrary] = useState<AssetLibrary | null>(null);
  useEffect(() => {
    // Fonts and illustrations must be ready before the first frame, exactly as in export.
    void Promise.all([loadFonts(), loadAssets()]).then(([, loaded]) => {
      setLibrary(loaded);
      setFontsReady(true);
    });
  }, []);

  const refreshManifest = useCallback(() => {
    fetch("/__simlab/voice/manifest.json")
      .then((response) => (response.ok ? response.json() : {}))
      .then((data: Record<string, number>) => setManifest(data))
      // A static build has no voice route: fall back to estimated timing, silently.
      .catch(() => setManifest({}));
  }, []);
  useEffect(refreshManifest, [refreshManifest]);

  const selectStory = (name: string) => {
    setStoryName(name);
    setTime(0);
    setPlaying(false);
    if (name === SANDBOX) return;
    const story = stories[name];
    const nextExperiment = experiments[story.experiment];
    setExperimentId(story.experiment);
    setConfig(nextExperiment.parseConfig(configFor(story)));
    setSeed(story.seed);
    setCompare(story.compare);
  };

  // Rebuilt whenever settings change; the scene is the single source for every number on screen.
  const built = useMemo((): { scene: Scene | null; error: string | null } => {
    try {
      const base = storyName === SANDBOX ? sandboxStory(experiment, compare, seed) : { ...stories[storyName], compare, seed, configOverrides: undefined };
      const lookup = manifest && (base.voice?.provider ?? "none") !== "none" ? (clip: { key: string }) => manifest[clip.key] ?? null : undefined;
      return { scene: buildScene(experiment, config, base, { lookup }), error: null };
    } catch (error) {
      return { scene: null, error: (error as Error).message };
    }
  }, [experiment, config, storyName, compare, seed, manifest]);
  const scene = built.scene;
  const duration = scene?.timeline.duration ?? 0;
  const video = scene?.story.video;
  const width = lowRes ? 960 : (video?.width ?? 1920);
  const height = lowRes ? 540 : (video?.height ?? 1080);
  const fps = video?.fps ?? 30;

  useEffect(() => {
    if (time > duration) setTime(duration);
  }, [duration, time]);
  timeRef.current = time;

  const clips = scene?.timeline.clips ?? [];
  const cachedClips = clips.filter((clip) => !clip.estimated).length;
  useEffect(() => {
    let cancelled = false;
    void playerRef.current.preload(scene?.timeline.clips ?? []).then((count) => !cancelled && setLoadedClips(count));
    return () => {
      cancelled = true;
    };
  }, [scene]);
  // Real narration plays only at 1× with every clip available; otherwise the preview is silent.
  const audioMode = narrationOn && speed === 1 && clips.length > 0 && cachedClips === clips.length && loadedClips === clips.length;

  // Narrated playback: the audio clock drives video time.
  useEffect(() => {
    if (!playing || !audioMode || !scene) return;
    const player = playerRef.current;
    player.start(timeRef.current, scene.timeline.clips);
    let handle = 0;
    const tick = () => {
      const next = player.videoTime();
      if (next >= duration) {
        setTime(duration);
        setPlaying(false);
        return;
      }
      setTime(next);
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(handle);
      player.stop();
    };
  }, [playing, audioMode, scene, duration, seekVersion]);

  // Silent playback clock: advances video time by real elapsed time × speed. Rendering itself is
  // a pure function of video time, so skipped frames on a slow machine never change the picture.
  useEffect(() => {
    if (!playing || audioMode) return;
    let handle = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = ((now - last) / 1000) * speed;
      last = now;
      setTime((previous) => {
        const next = previous + delta;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [playing, speed, duration, audioMode]);

  const seek = useCallback((value: number) => {
    setTime(value);
    setSeekVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene || !fontsReady) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    // Snap to the frame grid so the preview shows exactly what the export would.
    renderFrame(canvas.getContext("2d")!, scene, Math.min(Math.round(time * fps) / fps, duration));
    // `clean` swaps the canvas element, so it must trigger a redraw too.
  }, [scene, time, width, height, fps, duration, fontsReady, clean]);

  const togglePlay = useCallback(() => {
    if (!playing && time >= duration) setTime(0);
    setPlaying(!playing);
  }, [playing, time, duration]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).tagName === "INPUT" || (event.target as HTMLElement).tagName === "SELECT") return;
      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "c") setClean((value) => !value);
      else if (event.key === "ArrowRight") seek(Math.min(duration, timeRef.current + (event.shiftKey ? 5 : 1 / fps)));
      else if (event.key === "ArrowLeft") seek(Math.max(0, timeRef.current - (event.shiftKey ? 5 : 1 / fps)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, duration, fps, seek]);

  const current = scene?.timeline.at(time);
  const transport = (
    <div className="transport">
      {/* The page's one primary (yellow) button; everything else is secondary. */}
      <button className="sk-btn sk-btn--primary" onClick={togglePlay}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
      <button className="sk-btn sk-btn--secondary" onClick={() => { seek(0); setPlaying(true); }}>↺ Replay</button>
      <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} title="Playback speed">
        {SPEEDS.map((option) => (
          <option key={option} value={option}>
            {option}×
          </option>
        ))}
      </select>
      <input className="scrubber" type="range" min={0} max={duration} step={1 / fps} value={time} onChange={(event) => seek(Number(event.target.value))} />
      <span className="time">
        {formatTime(time)} / {formatTime(duration)}
      </span>
      <span className="status">{current?.chapter.spec.id}</span>
      <span className={audioMode ? "status on" : "status"}>{audioMode ? "♪ narration" : "silent"}</span>
    </div>
  );

  if (clean) {
    return (
      <div className="clean" onDoubleClick={() => setClean(false)}>
        <canvas ref={canvasRef} className="frame" />
        <div className="clean-transport">
          {transport}
          <button className="sk-btn sk-btn--secondary" onClick={() => setClean(false)}>
            Exit clean view (c)
          </button>
        </div>
      </div>
    );
  }

  const variantIds = experiment.variants.map((variant) => variant.id);
  return (
    <div className="page">
      <header className="sk-header">
        <span className="sk-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="14" cy="14" r="12" fill="var(--brand)" stroke="var(--ink)" strokeWidth="2.5" />
          </svg>
          Simulation Lab
        </span>
        <span className="header-meta">local preview · frames match the export</span>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <h2>Story</h2>
          <div className="sk-tags" role="group" aria-label="Story">
            {Object.values(stories).map((story) => (
              <button key={story.name} className="sk-tag" aria-pressed={storyName === story.name} title={story.experiment} onClick={() => selectStory(story.name)}>
                {story.name}
              </button>
            ))}
            <button className="sk-tag" aria-pressed={storyName === SANDBOX} title="Plays a whole run with the settings below" onClick={() => selectStory(SANDBOX)}>
              sandbox
            </button>
          </div>
          {storyName === SANDBOX && (
            <label className="field">
              <span>Experiment</span>
              <select
                value={experimentId}
                onChange={(event) => {
                  const next = experiments[event.target.value];
                  setExperimentId(next.id);
                  setConfig(next.parseConfig({}));
                  setCompare(next.variants.slice(0, 2).map((variant) => variant.id));
                }}
              >
                {Object.values(experiments).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="row">
            {["Left", "Right"].map((side, i) => (
              <label className="field" key={side}>
                <span>{side}</span>
                <select value={compare[i]} onChange={(event) => setCompare(compare.map((id, j) => (j === i ? event.target.value : id)))}>
                  {variantIds.map((id) => (
                    <option key={id} value={id}>
                      {experiment.variants.find((variant) => variant.id === id)!.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label className="field">
            <span>Seed</span>
            <input type="number" value={seed} step={1} onChange={(event) => event.target.value !== "" && setSeed(Math.trunc(Number(event.target.value)))} />
          </label>
          <h2>Settings</h2>
          {experiment.controls.map((spec) => (
            <ControlField key={spec.path} spec={spec} config={config} onChange={(value) => setConfig(setPath(config, spec.path, value))} />
          ))}
          <button className="sk-btn sk-btn--secondary" onClick={() => setConfig(experiment.parseConfig(storyName === SANDBOX ? {} : configFor(stories[storyName])))}>
            Reset settings
          </button>
          <h2>Narration</h2>
          <label className="check">
            <input type="checkbox" checked={narrationOn} onChange={(event) => setNarrationOn(event.target.checked)} /> Play narration audio (1× only)
          </label>
          <p className="hint">
            {clips.length === 0
              ? "This story has no narration."
              : cachedClips === clips.length
                ? `${clips.length}/${clips.length} clips generated — timing from real audio.`
                : `${cachedClips}/${clips.length} clips generated. Missing clips use estimated timing (settings or text changed?). Run: npm run voice -- --story stories/${scene?.story.name}.json --all`}
          </p>
          <button className="sk-btn sk-btn--secondary" onClick={refreshManifest}>
            Reload narration
          </button>
          <h2>Illustrations</h2>
          {library && library.missing.length === 0 && <p className="hint">All illustration files found.</p>}
          {library && library.missing.length > 0 && (
            <div className="notice">
              {library.missing.length} slot(s) use placeholders. Add Soco-st files to <code>public/assets/socost/</code> and list them in <code>config/assets.socost.json</code>, then reload (check with <code>npm run assets</code>).
              <ul>
                {library.missing.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          <h2>View</h2>
          <label className="check">
            <input type="checkbox" checked={lowRes} onChange={(event) => setLowRes(event.target.checked)} /> Low-res preview (960×540)
          </label>
          <button className="sk-btn sk-btn--secondary" onClick={() => setClean(true)}>
            Clean video view (c)
          </button>
          <p className="hint">Space: play/pause · ←/→: step a frame (Shift: 5 s) · c: clean view</p>
        </aside>
        <main className="main">
          <h1 className="page-title">{scene?.story.title ?? "Simulation Lab"}</h1>
          <span className="kicker">
            {experiment.id} · seed {seed} · {formatTime(duration)}
          </span>
          {built.error && <div className="error">{built.error}</div>}
          <canvas ref={canvasRef} className="frame" />
          {transport}
          {scene && (
            <section className="info">
              <nav className="sk-tags" aria-label="Details">
                {(["metrics", "assumptions", "definitions", "script"] as const).map((name) => (
                  <button key={name} className="sk-tag" aria-pressed={tab === name} onClick={() => setTab(name)}>
                    {name === "script" ? "captions & narration" : name}
                  </button>
                ))}
              </nav>
              {tab === "metrics" && <MetricsTable scene={scene} />}
              {tab === "assumptions" && (
                <ul>
                  {experiment.meta.assumptions.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              {tab === "definitions" && (
                <dl>
                  {experiment.meta.metrics.map((def) => (
                    <div key={def.key}>
                      <dt>{def.label}</dt>
                      <dd>{def.definition}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {tab === "script" && (
                <ol className="script">
                  {scene.timeline.chapters.map((chapter) => (
                    <li key={chapter.spec.id}>
                      <button className="link" onClick={() => seek(chapter.start)}>
                        {formatTime(chapter.start)} · {chapter.spec.id}
                      </button>
                      {chapter.clips.length === 0 && <p>(no narration)</p>}
                      {chapter.clips.map((clip) => (
                        <p key={clip.id} className={clip.estimated ? "estimated" : ""} title={clip.speech}>
                          <button className="link" onClick={() => seek(clip.start)}>
                            {formatTime(clip.start)}
                          </button>{" "}
                          {clip.caption}
                          {clip.estimated && " (no audio — estimated)"}
                        </p>
                      ))}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function MetricsTable({ scene }: { scene: Scene }) {
  const { experiment, metrics, batch } = scene;
  return (
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          {experiment.variants.map((variant) => (
            <th key={variant.id}>
              {/* The rule's pastel as an outlined swatch; pastel text would not be readable. */}
              <span className="swatch" style={{ background: variant.color }} />
              {variant.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="group">
          <td colSpan={experiment.variants.length + 1}>This run · seed {scene.seed}</td>
        </tr>
        {experiment.meta.metrics.map((def) => (
          <tr key={def.key}>
            <td title={def.definition}>{def.label}</td>
            {experiment.variants.map((variant) => (
              <td key={variant.id}>{formatMetric(def, metrics[variant.id][def.key])}</td>
            ))}
          </tr>
        ))}
        {batch && (
          <>
            <tr className="group">
              <td colSpan={experiment.variants.length + 1}>
                Across {batch.seeds.length} seeds ({batch.seeds[0]}–{batch.seeds[batch.seeds.length - 1]}) · mean
              </td>
            </tr>
            {experiment.meta.metrics.map((def) => (
              <tr key={`batch-${def.key}`}>
                <td>{def.label}</td>
                {experiment.variants.map((variant) => (
                  <td key={variant.id}>{formatMetric(def, batch.summary[variant.id][def.key].mean)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td>Best {batch.winMetric} (runs won)</td>
              {experiment.variants.map((variant) => (
                <td key={variant.id}>{batch.wins[variant.id]}</td>
              ))}
            </tr>
          </>
        )}
      </tbody>
    </table>
  );
}
