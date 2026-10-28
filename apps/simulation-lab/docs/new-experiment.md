# Adding a new experiment

An experiment is one folder under `src/experiments/<id>/` that implements the `Experiment`
interface in `src/core/experiment.ts`. Everything else is shared and needs no changes:
- the preview UI and the narration-driven story timeline;
- local TTS, the voice cache, and captions (SRT, VTT and burned-in);
- sound effects and music ducking;
- batch statistics;
- frame export and the audio sync checks.

## Steps

1. `cp -r src/experiments/_template src/experiments/<id>`. Rename `templateExperiment` and set `id`.
2. Register it in `src/core/registry.ts`.
3. Add `configs/<id>-demo.json` and `stories/<id>-demo.json` (`"experiment": "<id>"`), with each segment's `narration`.
4. `npm run dev`, pick the story or **Sandbox**. Iterate. The timing is estimated until voiced.
5. Write tests next to the code (`*.test.ts`): reproducibility, invariants, one hand-computed case.
6. `npm run voice -- --story stories/<id>-demo.json --phonemes` → fix any word with `voice.lexicon` → `--all`.
7. `npm run render -- --story stories/<id>-demo.json --preview --to 10`, then the full render.

## What to implement

| Member | Contract |
| --- | --- |
| `meta` | title, summary, `assumptions[]`, `metrics[]` (key, label, unit, definition), `primaryMetric`, `lowerIsBetter` |
| `variants` | the rules being compared: `id`, `short` ("A"), `label`, `description`, `color` |
| `defaultConfig`, `parseConfig(raw)` | merge defaults, validate, throw a readable `Error` |
| `controls` | form fields for the preview (`path` is a dot path into the config) |
| `generateInput(config, seed)` | **all** randomness, via `rngStream(seed, "<id>.<attribute>")`, one stream per attribute; round times to ms |
| `simulate(input, config, variant)` | pure and deterministic; no `Math.random`, no clock, no DOM |
| `endTime`, `metrics`, `records`, `events` | what's saved to `output/` and shown in charts |
| `anchors(scene)` | named moments stories can jump to (`"focus.arrival"` …) |
| `templateVars(scene)` | extra `{{names}}` for story text (core already provides every metric per variant, batch means, `best.*`, `left.*`/`right.*`) |
| `spokenVars?(scene)` | spoken forms for vars that read badly aloud (durations, ids); metric durations are handled by core |
| `templateValues?(scene)` | extra numbers for `when`/`unless` conditions (core provides every metric) |
| `soundCues?(scene, variant)` | optional effects at simulated moments (`ding`, `chime`, `whoosh`, `pop`, `tick`), used only when a story enables sfx |
| `resolveFocus(scene, spec)` | which entity `story.focus` refers to |
| `drawPanel(ctx, scene, variant, simTime, rect, options)` | draw one variant's state **at `simTime`**, inside `rect` |
| `drawResults(ctx, scene, rect, progress, { emphasis })` | the results chart; `progress` 0→1 animates it; `emphasis` lists metric keys a story wants highlighted; keep single run and `scene.batch` visibly separate |

### Rules that keep videos honest and reproducible

- Every variant must receive the same input object. Strategies differ only in decisions.
- Strategies may only use information the agents in the model could know at that moment. Hide
  future quantities (e.g. a customer's work) from the decision code, and add a test that changing
  a future value leaves earlier events unchanged (see `queue.test.ts`).
- Fix an explicit order for same-time events and document it.
- `drawPanel` must be a pure function of `simTime`. Precompute per-entity tracks from the event
  log (see `queue/visual.ts`) rather than accumulating state frame by frame. That keeps seeking,
  replay, and any FPS consistent.
- Never hard-code numbers or winners in stories. Use `{{vars}}`, anchors, and `when`/`unless` conditions so the narration stays true when seed or settings change.
- Provide spoken forms for anything you display as `m:ss` or `#id`; TTS reads display forms badly.

## Sketches for future topics

These are not implemented. They show how a topic maps onto the interface.

**Traffic and lane changing.** Input: vehicles with entry times, desired speeds, driver
aggressiveness. Variants: "keep lane", "change when gap > g", "zipper merge". Simulation: a
fixed-step model (e.g. 0.1 s, a simple car-following rule) is fine, because the contract only
needs state at any time. Store per-step positions and interpolate in `drawPanel`. Metrics: travel
time, throughput, number of lane changes. Anchors: `bottleneck.firstJam`.

**Elevator dispatch.** Input: passenger arrivals (time, origin, destination floor). Variants:
nearest car, sectoring, destination dispatch. Discrete-event like the queue (car arrives at a
floor, doors close, passenger arrives). Keep the passenger destination hidden from the
dispatcher if the variant models a classic up/down button. `drawPanel`: shafts as columns, cars
as boxes, waiting passengers as dots per floor.

**Resource allocation / fairness, predator–prey, cooperation games.** Same pattern: generate the
world once per seed, make each policy a variant, store a time series or event log, and draw from
it. For agent-based models with many entities, store snapshots every N steps plus events, and
keep `drawPanel` interpolating between snapshots.

## What is shared and when you'd touch it

- `src/core/story.ts`: segment kinds (`title`, `cards`, `poll`, `sim`, `chart`) and the
  narration-driven timeline. A new kind (e.g. a zoomed camera) is a small addition to
  `render/frame.ts` that every experiment can use.
- `src/voice/providers.ts`: TTS providers. To add an online service, implement `TtsProvider`, set
  `paid: true`, and read its key from an environment variable.
- `src/render/frame.ts`: frame layout (top bar, panels side by side, captions). Panels get a
  `rect`; experiments should lay out relative to it so other aspect ratios keep working.
- `src/render/theme.ts`: renderer names for the channel style (`src/style/channel.ts`, built on the
  Sokosoko design-system tokens). Use those roles and `seriesColors`; give pastel fills an ink
  outline and never use a rule colour for text.
