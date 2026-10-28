# Simulation Lab

A production tool for a simulation-experiment YouTube channel. You define an experiment in code,
run several rules on **the same random input**, and write the narration. The tool then voices the
narration with a local TTS and builds the video timeline from the real audio lengths. The output
is a 1080p MP4 with synced captions: a clean version, a version with burned-in captions, and
SRT/VTT files. Everything runs locally by default: no paid APIs, accounts or GPU.

Episode 1: **"100 people, 4 windows — which line rule makes everyone wait the least?"**

This is a local tool inside the lab115 monorepo. It is not deployed and has no Dockerfile or compose
service. CI runs `npm run build` (typecheck + Vite build), which needs neither Python nor a browser.

## What you need to provide

| What | Why | Cost |
| --- | --- | --- |
| Node 22+, FFmpeg with libx264 (`brew install ffmpeg` / `apt install ffmpeg`) | export | free |
| `uv` and `espeak-ng` (`brew install uv espeak-ng`) | local Kokoro TTS setup | free |
| Disk: ~1 GB Python env + ~330 MB per Kokoro model + ~170 MB Chrome Headless Shell (Remotion) | one-off downloads | free |
| *Optional:* your own narration recordings | instead of TTS (`voice.provider: "files"`) | — |
| *Optional:* a background music file you have the rights to | music under the narration (off by default) | your licence |

**Nothing in this project costs money to run.** No paid TTS provider is implemented. The provider
interface (`src/voice/providers.ts`) can take an online service later; any provider marked `paid`
refuses to run without an explicit `--allow-paid`, and its key must come from an environment variable.

Tested on macOS arm64 (Apple M4 Pro). Not tested yet: Linux and x86.

## Quick start

```bash
npm install
```

```bash
npm run setup:browser && npm run setup:tts
```

```bash
npm run voice -- --story stories/queue-demo.json --all
```

```bash
npm run render -- --story stories/queue-demo.json
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Interactive preview at http://localhost:5173 (plays real narration once generated) |
| `npm run test` | Vitest: determinism, invariants, hand-computed cases, seeking, timeline, captions, audio |
| `npm run build` | Typecheck + production build of the preview |
| `npm run simulate -- --experiment queue --config configs/queue-demo.json --seed 7` | One seed, all rules → event logs, per-customer CSVs, metrics |
| `npm run batch -- --experiment queue --config configs/queue-demo.json --runs 100` | Paired multi-seed statistics (CSV + JSON) |
| `npm run voice -- --story <story>` | **Plan only**: which narration clips exist or are missing (generates nothing) |
| `npm run voice -- --story <story> --segment hook --play` | Generate and listen to one segment |
| `npm run voice -- --story <story> --all` | Generate every missing clip (cached clips are never redone) |
| `npm run voice -- --story <story> --segment hook --force` | Regenerate one segment |
| `npm run voice -- --story <story> --phonemes` | Pronunciation check: how every clip will be read (no audio) |
| `npm run voice -- --story <story> --list` | Every clip with caption, spoken text and (for recordings) the expected file name |
| `npm run timeline -- --story <story>` | `timeline.json`, SRT, VTT, narration script and assembled narration WAV |
| `npm run render -- --story <story>` | Final export (clean and captioned MP4) |
| `npm run render -- --story <story> --preview --to 10` | Fast check: 960×540, first 10 s |
| `npm run render -- --story <story> --stills 2,30,50` | PNG stills, no encoding |
| `npm run studio` | Remotion Studio: every story as a composition, scrub any frame, hear the cached narration |
| `npm run render:legacy -- --story <story>` | The previous Playwright + FFmpeg exporter (same options), kept while Remotion settles |
| `npm run tts:evaluate` | Re-run the Kokoro compatibility and speed benchmark on this machine |

Every command writes to a **new** directory under `output/<command>/<name>-<timestamp>/`. Nothing
is overwritten. `output/`, `cache/` and `.venv-tts/` are git-ignored.

## Architecture

```
src/
  core/            experiment contract, RNG, stats, narration text, story timeline, scene, batch, sound, WAV
  experiments/
    queue/         episode 1: config, input, simulation, metrics, visual tracks, drawing, sound cues
    _template/     minimal working experiment to copy (see docs/new-experiment.md)
  render/          shared Canvas renderer, caption style, fonts, drawing helpers
  voice/           TTS providers, clip cache, soundtrack assembly and sync check (Node only)
  preview/         React preview UI + narration player
  export/          Remotion public-folder links; render.html for the legacy exporter
  cli/             simulate / batch / voice / timeline / render / studio
remotion/          video layer: the Episode composition (frames from the shared renderer, narration clips as audio)
tts/               Kokoro worker (Python), requirements, evaluation script
configs/ stories/  experiment parameters and video narratives (JSON)
```

1. **Simulation.** A pure function `(input, config, variant) → run`, with no DOM, no `Math.random()`
   and no clock. All randomness lives in `generateInput`, which uses one named stream per
   attribute. Inputs are rounded to 1 ms so that Node and Chromium agree bit for bit; the exporter
   refuses to render if they ever don't.
2. **Story (narration-driven).** The simulation runs first. Story text pulls every number and
   result from it through `{{variables}}` and `when`/`unless` conditions. The narration is split
   into caption-sized clips, and the voiced clips' real lengths lay out the timeline: pauses,
   simulation speed-ups and freeze-frames are fitted around the speech. Audio is never stretched.
3. **Presentation.** `drawPanel(ctx, scene, variant, simTime, rect)` reads state at any simulated
   time directly. It never steps frame by frame, so seeking, replaying and any FPS all show the
   same picture. Preview and export call the same `renderFrame`, and captions use one shared style.
4. **Video layer (Remotion).** The `Episode` composition (`remotion/`) draws frame *N* with the
   same `renderFrame` as the preview — camera moves, cards and burned-in captions included — and
   places every narration clip as audio at its timeline frame (clips start on whole frames).
   Effects and music are mixed in Node into one "bed" track. Remotion renders frames in parallel
   headless Chrome tabs (no timers, no screen recording) and encodes H.264/AAC. Before rendering,
   the browser rebuilds the scene and its metrics must equal Node's; afterwards each clip is
   located in the final audio, and the export reports its offset, peak level, clipping and length.

Three clocks are kept apart and all three appear in `timeline.json`: **simulated time** (seconds
inside the model), **chapter-local time** (seconds since a segment started) and **video time**
(seconds since the video started).

## Episode 1: the queue experiment

Three rules, compared on identical customers (same arrival times, same amount of work each):

| | Rule |
| --- | --- |
| **A · One shared line** | One FIFO line; the person at the front goes to the lowest-numbered free window. |
| **B · Shortest line, stay put** | One line per window. A newcomer joins the line with the fewest people (waiting + being served + walking towards it); ties go to the lowest window number. No switching. |
| **C · Shortest line + switching** | Joins like B, then may switch lines (defined below). |

### Rule C, precisely

- **When people decide**: only when something happens (an arrival, a service ending, a switcher reaching a line).
- **Who decides**: people waiting in a line whose last join was at least `switching.cooldown` ago and who have switched fewer than `switching.maxSwitches` times.
- **What they see**: how many people are waiting in each line, how many are walking towards it, whether each window is busy and **how long its current service has run**, and window speeds if `speedsVisible`. Nobody sees anyone's remaining work, their own included.
- **Wait estimate** for a line with `k` people ahead: `k × T/s + (busy ? max(T/(2s), elapsed) : 0)`. Here `T` is the public average work, `s` the window speed, and `elapsed` how long the current service has run. In words: a visibly stuck window will probably stay stuck about as long again.
- **Switch rule**: move to the line with the largest `current − (target + switching.cost)` if that saving is greater than `switching.threshold`. Walking takes `switching.cost` seconds, counts as waiting, and the person is in no line meanwhile.
- **Simultaneous decisions**: people furthest back decide first, then by customer id. Each sees the lines as the earlier movers left them, and people already walking count as part of their target line.

**Same-time event order**: services ending (by window) → switchers arriving (by id) → newcomers (by id) → idle windows call the next person (by window) → rule C decisions.

### Metrics

| Metric | Definition |
| --- | --- |
| Wait | service start − arrival (includes time walking between lines) |
| Service | service end − service start = work ÷ window speed |
| Time in system | service end − arrival |
| Average / median / P95 / max wait | over all customers; percentiles interpolate linearly between ranks |
| Everyone done (makespan) | time from t = 0 (first arrival) to the last service end |
| Window utilisation | total busy time ÷ (windows × makespan) |

**One run vs many runs.** The video shows one seed and labels it as such. The results chapter also
shows a batch of 200 seeds with the mean, the 10th–90th percentile range, and how often each rule
won. Example (`npm run batch -- --runs 100`):

```
metric                  A · One shared line  B · Shortest line, stay put  C · Shortest line + switching
Average wait               2:20 (0:38–4:39)             2:35 (0:51–4:53)               2:29 (0:46–4:44)
Median wait                2:15 (0:21–5:05)             2:01 (0:21–4:17)               1:59 (0:24–4:06)
95th-percentile wait       5:03 (2:09–8:31)            7:28 (3:02–12:16)              6:43 (3:01–11:38)
best avgWait (wins)                  86/100                        3/100                         11/100
```

The shared line wins on average and on the tail, while separate lines have the lower *median*.
The demo story tells that twist only when a condition on the actual numbers is true, so it can't
claim something the data doesn't show.

**Assumptions and limitations**: work is lognormal, with a share of "slow" customers who need
several times more. Arrivals are Poisson (staggered) or all at t = 0. There is no balking,
reneging, priority or breaks. Rule C is one reasonable heuristic among many. Animation eases
between positions for readability; only line-switching walks take simulated time.

## Writing a video: stories

`stories/queue-demo.json` is the reference. The top level holds `title`, `language` (`en`|`zh`),
`config`, `seed`, `compare` (left/right rules), `focus`, `batch`, `video`, `voice`, `sound`, and a
list of **segments** (`chapters`):

```jsonc
{
  "id": "focus",                        // also the prefix of its clip ids: focus-1, focus-2, …
  "kind": "sim",                        // title | cards | poll | sim | chart
  "narration": [                        // what is said; each sentence = one audio clip = one caption
    "Customer {{focus.id}} again.",
    { "text": "On the right, a slow customer blocks the line.", "when": "focus.right.slowAhead > 0" },
    { "text": "On the right, that line simply moves slower.", "unless": "focus.right.slowAhead > 0" }
  ],
  "sim": { "to": { "anchor": "focus.lastStart", "offset": 15 } },  // simulated-time window
  "duration": 5,                        // minimum seconds (narration can make it longer)
  "pauseBefore": 0.2, "pauseAfter": 0.45,
  "highlight": { "from": "focus.arrival" },  // highlight once that event has happened
  "dimOthers": true,
  "callout": "Customer {{focus.id}}"
}
```

| Field | Meaning |
| --- | --- |
| `narration` | String or list. Items can be `{ "text", "when", "unless", "caption" }`. Sentences are split at `. ! ? 。！？`; a sentence too long for two caption lines is split at `, ; : ，；：`. A clause that still doesn't fit is an error: no proportional guessing. |
| `caption` | Override the caption text of a single-clip item (captions otherwise use the narration text exactly). |
| `sim.from` / `sim.to` | The simulation runs over the segment (sped up to fit). With `speed`, it runs at that pace and then holds. |
| `sim.play: "after"` + `speed` | Freeze at `from` while narrating, then play. |
| `sim.at` | Freeze on one moment: pause the simulation while explaining. |
| `duration`, `pauseBefore`, `pauseAfter` | Hold the picture (camera dwell) and leave gaps between segments. |
| `highlight` | `true`, or `{ "from": anchor }` to highlight the focus customer when that event happens. |
| `when` / `unless` | Include the whole segment only if the condition on the results holds. |
| `kind: "cards"` | `heading` + `bullets`; bullet *i* appears with narration clip *i*. |
| `kind: "poll"` | "Pause and guess" cards for every rule, then a `countdown` (seconds) after the narration. |
| `kind: "chart"` | Results. `reveal: false` shows settled bars; `emphasis: ["medianWait", "p95Wait"]` highlights rows. |

**Numbers come from the run, not the script.** `{{single.avgWait}}`, `{{left.medianWait}}`,
`{{best.short}}`, `{{batch.best.wins}}`, `{{focus.right.wait}}` and so on fill in the actual
results. Captions show display forms (`8:12`); the TTS gets spoken forms ("8 minutes and 12
seconds" / "8分12秒"). Conditions compare raw values: `right.medianWait < left.medianWait &&
right.p95Wait > left.p95Wait`. Unknown variables, values or anchors are errors.

**Anchors** (moments in simulated time): `start`, `end`, `lastArrival`, `<rule>.end`,
`<rule>.firstSlowStart`, `focus.arrival`, `focus.firstStart`, `focus.lastStart`, `focus.lastEnd`,
or `{ "anchor": "end", "scale": 0.4, "offset": -30 }`.

## Voice, captions and sound

### Voice providers (`story.voice`)

| `provider` | What it does | Cost / terms |
| --- | --- | --- |
| `kokoro` (default in the demo) | Local Kokoro-82M via `tts/kokoro_worker.py`. `voice`: `af_heart`, `am_michael`, `bm_george`, … (English) or `zf_001`… with `"model": "v1.1-zh"` (Mandarin). `speed`: 1.0 = normal. | Free, offline after the model download. Apache-2.0, commercial use allowed. See [docs/tts-evaluation.md](docs/tts-evaluation.md). |
| `files` | Your recordings: `audio/<story>/<clip-id>.wav` (or m4a/mp3/aiff/flac/ogg). `--list` prints every expected file and its text. Replacing a file re-imports just that clip. | — |
| `none` | No audio. Timing uses reading-speed **estimates**, flagged as such everywhere. | — |

- **Cache.** `cache/voice/<key>.wav` + `.json`. The key hashes provider, voice, model, speed,
  language and the exact speech text, so editing one sentence regenerates only that sentence.
  Changing a seed or setting that alters a number regenerates only the sentences containing it.
- **Explicit generation.** `voice` without `--segment`/`--all` only prints the plan. Failed clips
  are retried 3 times; completed ones stay cached, so re-running retries only the failures.
- **Pronunciation.** Use `--phonemes` to check, and `voice.lexicon` to fix
  (`{ "Poisson": "[Poisson](/pwɑsˈɔn/)" }`, Kokoro/misaki markup, speech only).
- **Clip trimming.** Every clip is converted to 48 kHz mono, and silence at both ends is trimmed
  before caching, so captions start with the speech.

### Captions

- Captions use the original narration text, one caption per clip, starting exactly when the clip
  starts. Each caption stays up through the short gap after its clip.
- The look is defined once in `src/render/captionStyle.ts`: plain ink text (Noto Sans SC 500,
  46 px, no box) in the caption zone y 860–1020, which holds nothing else; at most **two lines** of
  ≤ 42 characters, split into two balanced lines when one is not enough. Chinese text wraps by
  width (breaks between characters, kinsoku: no `，。！？` at a line start, no opening brackets at a
  line end). The exporter measures every caption with the real font and fails if one needs a
  third line.
- Outputs: `captions.srt`, `captions.vtt`, `video.mp4` (clean) and `video.captioned.mp4`
  (burned in). Use `--no-burn` to skip the burned-in version.

### Sound (`story.sound`, all off by default)

- `sfx: true` adds effects synthesised from simulation events. The default for stories is off; the demo story turns it on.
  - "Served" ding: pitch by window, panned left or right with the panel.
  - Line-switch whoosh.
  - Chime when the focus customer is served.
  - Countdown ticks and chart pops.
  - Effects are thinned and quieter when the simulation runs fast.
- `music: "audio/track.mp3"` (or `--music`) loops and fades your own track under everything. A
  sidechain compressor ducks it about 13 dB while the narration speaks. **The tool never
  downloads music**; use only tracks you have the rights to (e.g. the YouTube Audio Library).
- On export the audio is checked:
  - Every narration clip is located in the final file by envelope cross-correlation. The export
    fails if any clip is off by more than one frame (verified to detect ±60–100 ms shifts).
  - It reports peak dBFS and clipped samples. The mix is held below −1 dBFS.
  - The audio track length must match the video within 50 ms.

## Previewing

**Remotion Studio** (`npm run studio`): the video as it will be exported — every story is a
composition with its narration clips on the timeline; scrub to any frame. It links
`remotion/public/` to `public/assets` and `cache/` and writes the cached clips' manifest first.

**Preview page** (`npm run dev` → http://localhost:5173) — the experiment workbench:

- **Story** picks a story; **Sandbox** plays a whole run for any pair of rules.
- **Left / Right**, **Seed** and the **Settings** form edit everything live. The form is generated from the experiment's `controls`.
- **Narration**: once clips are generated, playback at 1× plays the real voice, and the audio clock drives the picture and captions. If a change makes the text differ from the generated audio (e.g. a new seed changes a number), the panel says how many clips are missing and timing falls back to estimates. At other speeds the preview is silent. Effects and music are export-only.
- Scrub bar, 0.25–4× speed, `Space`, `←/→` (one frame), `Shift+←/→` (5 s), `c` for the clean view, low-res mode.
- Tabs show the metrics (single run and batch kept separate), assumptions, metric definitions, and every narration clip with its time (click to jump).

## Exporting

`npm run render -- --story stories/queue-demo.json` (Remotion; the clean and the captioned file are
two renders of the same composition, captions on or off).

| Flag | Meaning |
| --- | --- |
| `--preview` | 960×540 for quick checks |
| `--width`, `--height`, `--fps` | override the story's `video` (defaults 1920×1080, 30) |
| `--from`, `--to` | render part of the timeline; captions and audio are cut to match |
| `--seed`, `--config`, `--batch-runs` | override the story's seed, config file, batch size |
| `--silent` | export without narration even if clips are missing (estimated timing, flagged) |
| `--sfx` / `--no-sfx`, `--music <file>` / `--no-music` | override `story.sound` |
| `--no-burn` | skip `video.captioned.mp4` |
| `--stills 2,30,50` | PNG stills (with captions) instead of a video |
| `--keep-frames`, `--crf`, `--out <dir>` | keep PNG frames; x264 quality (default 18); explicit output dir (must not exist) |
| `--concurrency <n>` | Chrome tabs rendering in parallel (Remotion's default: half the CPU threads) |

If clips are missing, the export stops and tells you to run `voice --all`, or to pass `--silent`.

Output directory: `video.mp4`, `video.captioned.mp4`, `captions.srt`, `captions.vtt`,
`timeline.json` (whole-video, chapter-local and simulated times; every clip's key, duration and
text), `narration.md`, `narration.wav`, `audio.wav` (narration + effects as mixed in Node, for
reference),
`story.json`, `config.json`, `input.json`, `events-*.json`, `records-*.csv`, `metrics.json`,
`batch-summary.json`, and `meta.json` (version, git commit, resolution, FPS, voice settings, sync
report, ffprobe results, render time). After a failure there is a `FAILED.txt`, and any partial
video is deleted. Ctrl+C cancels the render and removes the temporary bundle and audio bed.

Measured on this machine (Apple Silicon), both files, including bundling: the 60 s demo 35.9 s
(legacy exporter 73.6 s); the 10 s sample 8.2 s (legacy 13.2 s). The first render
also downloads Chrome Headless Shell (~170 MB). Integrated loudness identical to the legacy export (−22.7 LUFS); every clip
located at 0 ms offset.

## Channel style and illustrations

**Design system.** The look follows the Sokosoko design system
(<https://claude.ai/artifact/KPRSTffJfVbQawMQ8681A7>): white ground, one ink line plus flat pastel
fills, a single warm yellow that marks what matters, round shapes, no resting shadows, Nunito for
titles and numbers and Noto Sans SC for text. `src/style/sokosoko.tokens.json` is a verbatim copy
of its `tokens.json` (replace the file to update), and `src/preview/sokosoko.css` is its component
stylesheet (`sk-header`, `sk-btn`, `sk-tag`…) without the Google Fonts import. The video's
shots, components and motion follow the Claude Design canvas "simulation-lab 美术设计 · Ep1"
(<https://claude.ai/artifact/5pe1Qnnhfjwzg1t4HKASj2>; private), including its decisions D1–D16.

**Design tokens.** `src/style/channel.ts` reads colours, families and radii from that file and adds
what only video needs: the 1080p type scale with a phone-readability floor, the frame bands (header
y 60–136, content y 136–860, captions y 860–1020), outline weights, motion rules (walking pace per
shot type with a gentle start and stop, a step bob only while walking, people moving up one after
another, tags appearing only once someone stands still, ≤ 4 number updates per second) and what
each colour means on screen:

| Meaning | Token |
| --- | --- |
| The one thing to look at (focus disc, emphasised metric); heading highlighter | `brand` |
| Disc under everyone's feet (instead of a shadow) | `paper-sunk` |
| Head tag while waiting | `paper` |
| Head tag after a long wait (≥ half of `waitRedAt`), with an hourglass | `fill-pink` |
| At the counter: the clock stops and a check mark replaces the prefix | fill unchanged |
| Rules A / B / C (always outlined in ink and labelled with the letter) | `fill-sky` / `fill-mint` / `fill-lilac` |
| All text | `ink`, `ink-muted` |

The video renderer and the preview page both read them (the page gets the design system's tokens
under their own names as CSS custom properties). Tests fail if any other source file hard-codes a
colour, if a colour is not a design-system token, or if a rule's colour is the long-wait or
emphasis colour.

**Illustrations (Soco-st).** Download files from soco-st.com yourself into
`public/assets/socost/` (git-ignored, never redistributed) and list each one in
`config/assets.socost.json`: `id`, `kind` (character / prop / background / icon), `role`
(customer, cashier, checkout-counter, shelf, entrance, basket, cart, decor), `file`, the
character's native `facing`, and the `source` page URL. `npm run assets` lists empty slots,
missing files, unlisted files and entries without a source. Missing slots are drawn as neutral
placeholders (faceless ink outlines on `paper-sunk`); the preview lists them and `render` warns
(or fails with `--require-assets`). Assets are only moved, scaled and faded as a whole, and
mirrored only when the original faces left (everyone walks left to right). Faces are never
edited, and discs and tags are drawn outside the image. Customer #n always gets
`shopper-((n − 1) mod pool) + 1`, so neighbours never share a look.

**Illustrated shots.** A sim segment can ask for `"shot": { "type": "lane", "variant": "single",
"window": 0 }`: the design's lane close-up, driven by the run's events. Shoppers walk in, queue
(up to 4 visible, the rest as a "+n" pill), get served and leave in front of the counter; tags and
the clock come from the run. `stories/socost-sample.json` is a 10-second sample.
`src/experiments/queue/laneMotion.test.ts` checks every frame: no teleports, nobody overtakes in
line or stacks on someone, nobody walks through the counter, feet stay above the caption zone,
the line moves up front to back, and standing shoppers are perfectly still.

## Adding an experiment

See [docs/new-experiment.md](docs/new-experiment.md). In short: copy `src/experiments/_template/`,
implement the `Experiment` interface, register it in `src/core/registry.ts`, and add a config and a
story. The preview, timeline, voice, captions, sound, batch statistics and export all work unchanged.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Kokoro is not set up` | `npm run setup:tts` (needs `uv`; Kokoro needs Python ≤ 3.12, which uv provides) |
| `…/runner/…/phontab: No such file` | install espeak-ng (`brew install espeak-ng`), or set `SIMLAB_ESPEAK_LIB` / `SIMLAB_ESPEAK_DATA` |
| `N narration clip(s) have no audio yet` | `npm run voice -- --story … --all`, or `--silent` |
| `captions need more than two lines` | shorten the sentence or add a comma; clips split at punctuation |
| A word sounds wrong | `npm run voice -- --story … --phonemes`, then add it to `voice.lexicon` and regenerate that segment |
| `Narration is off by … ms` | shouldn't happen; check `meta.json` → `sync` and report it |
| Chrome download fails on the first render | `npm run setup:browser` (Remotion's Chrome Headless Shell; Playwright's Chromium for `render:legacy`) |
| `ffmpeg not found` / `no libx264` | install FFmpeg with x264 |
| `Browser and Node simulations disagree` | the simulation used non-deterministic maths; round inputs as `queue/input.ts` does |
| Slow TTS | `SIMLAB_TTS_DEVICE=mps` on Apple Silicon (≈3× faster in our measurements) |

## Dependencies and licences

| Component | Licence | Notes |
| --- | --- | --- |
| React, Vite, Vitest, tsx, @vitejs/plugin-react | MIT | |
| TypeScript, Playwright | Apache-2.0 | Playwright is used by `render:legacy` and screenshot checks |
| Remotion 4.0.534 (`remotion`, `@remotion/*`) | [Remotion License](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) | free for individuals and companies of up to 3 people, commercial use included; larger companies need a company licence (terms change with Remotion 5). No licence key is set, so renders send no usage events. Downloads Chrome Headless Shell on first render |
| Kokoro-82M (weights + `kokoro` package), misaki | Apache-2.0 | installed by `setup:tts`; commercial use allowed |
| PyTorch, spaCy + `en_core_web_sm`, soundfile | BSD-3 / MIT | Python deps in `.venv-tts` |
| espeak-ng | GPL-3.0 | separate system program used for G2P fallback; not distributed with this repo |
| Nunito, Noto Sans SC (`@fontsource/*`) | SIL OFL 1.1 | bundled (Latin subsets loaded); display and text faces of the design system; free to use in videos |
| Soco-st illustrations (your downloads) | [Soco-st terms](https://soco-st.com/guide) | commercial/YouTube use, no credit needed; **not redistributed** (git-ignored); no face edits; no AI training/reference |
| FFmpeg | LGPL/GPL (GPL with libx264) | separate system program; not distributed with this repo |

No external images, sounds or music ship with the project (Soco-st files stay on your machine). Visuals are drawn with Canvas, and
effects are synthesised from code. Videos are English. For Chinese captions, load the CJK
subsets of `@fontsource/noto-sans-sc` (already installed) in `src/render/fonts.ts`; line breaking
and spoken number formats already support Chinese.
