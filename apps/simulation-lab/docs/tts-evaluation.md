# Local TTS evaluation: Kokoro-82M

Goal: a free, offline voice for narration, with no paid API. Measured 2026-10-26.
Re-run on any machine with `npm run tts:evaluate`, which writes WAVs and a `report.json` to `output/tts-eval/`.

## What Kokoro is

| | |
| --- | --- |
| Model | [hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) v1.0 (English and 7 other languages) and [Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh) (100 Mandarin speakers plus 3 English voices) |
| Licence | Apache-2.0 for both the weights and the code ([github.com/hexgrad/kokoro](https://github.com/hexgrad/kokoro)). The model card says it was trained on permissive or non-copyrighted audio and allows commercial use. Monetised YouTube videos are fine; no attribution is required. |
| Runtime | Python package `kokoro` 0.9.4 with `misaki[zh]` 0.9.4 as the G2P, PyTorch 2.14.1, output at 24 kHz |
| Cost | Free. Fully local after the first model download (~330 MB per model version, cached in `~/.cache/huggingface`). |
| JavaScript port | `kokoro-js` 1.2.1 (Apache-2.0) runs in Node/ONNX, but it only has English voices, so we don't use it. |

## Compatibility on the target machine

Apple M4 Pro, macOS (arm64), 24 GB RAM.

| Issue found | Fix (automated in `npm run setup:tts` / `tts/kokoro_worker.py`) |
| --- | --- |
| `kokoro` requires Python 3.10–3.12; the system Python is 3.13–3.15, which won't install it | `uv venv --python 3.12 .venv-tts` (uv downloads a standalone 3.12; the system Python is untouched) |
| The espeak-ng library bundled with `espeakng-loader` has a CI path baked in: `…/Users/runner/…/phontab: No such file` | The worker points misaki at a system espeak-ng (`brew install espeak-ng` / `apt install espeak-ng`); override with `SIMLAB_ESPEAK_LIB` / `SIMLAB_ESPEAK_DATA` |
| English G2P needs spaCy `en_core_web_sm`, and its auto-download fails inside a uv venv | Pinned as a wheel URL in `tts/requirements.txt` |

**Not tested yet:** Linux and x86_64. The worker already looks in the Debian/Ubuntu library paths, but nobody has run it there.

## Speed

Five narration sentences, 34–42 s of audio per voice. RTF = generation time ÷ audio length (lower is faster).

| Run | Device | English v1.0 (5 voices) | Mandarin v1.0 | Mandarin v1.1-zh | Model load + warm-up |
| --- | --- | --- | --- | --- | --- |
| 1st (first ever MPS use) | CPU | 0.13–0.18 | 0.16–0.19 | 0.13–0.20 | 3–13 s |
| 1st | MPS | 0.130 | — | 0.117 | 3–9 s |
| 2nd (`npm run tts:evaluate`) | CPU | 0.12–0.14 | 0.13–0.16 | 0.12–0.14 | 4–5 s |
| 2nd | MPS | **0.043** | — | **0.047** | 2–3 s |

So the CPU alone runs 5–8× faster than real time. MPS was about 3× faster again on the second run; the first MPS run was no faster, most likely because of one-off kernel compilation. The default is CPU: each clip takes well under a second either way, and CPU output is easier to reproduce. Set `SIMLAB_TTS_DEVICE=mps` to use the GPU. In real use, the 18-clip demo story generated in about 15 s including the model load.

## Pronunciation checks

Read from the G2P output (`npm run voice -- --story … --phonemes` shows it for any story).

| Check | English v1.0 | Mandarin v1.0 | Mandarin v1.1-zh |
| --- | --- | --- | --- |
| Numbers and percentages (200, 161, 81%, 52号, 2分42秒) | ✓ | ✓ | ✓ |
| Ordinals ("95th-percentile") | ✓ | — | — |
| Clock-style durations "2:42", "6:56" | ✗ "two forty-two" | ✗ "六 五十六" | ✗ |
| Polyphones 银行/行长/长队/着急/重新 | — | ✓ all | ✓ all |
| Terms: FIFO, lognormal | ✓ | ✗ left as raw Latin letters | ✓ via English G2P |
| "Poisson" | ✗ "Poy-son" | ✗ | ✗ |
| Lone letter "A" (e.g. "A, B, or C") | ✗ weak /ə/; "Rule A" and "A:" are fine | ✗ | ✗ |
| Pauses | commas and full stops give 0.25–0.8 s; each clip starts and ends with about 0.3 s of silence | same | same |

How the pipeline handles these failures:

- **Durations**: captions show `8:12`, but the speech text is generated from separate spoken variables ("8 minutes and 12 seconds", or "8分12秒" in Chinese). Story authors don't have to do anything.
- **Names and terms**: per-story `voice.lexicon`, for example `{ "Poisson": "[Poisson](/pwɑsˈɔn/)" }` (misaki phoneme markup). Verified: it produces `pwɑsˈɔn`.
- **Letters**: write "Rule A" rather than a bare "A".
- **Silence**: the edges of every clip are trimmed (−45 dBFS, 30 ms pad) before caching, and the configured pauses are added back by the timeline.
- **Mandarin**: use the v1.1-zh model. The v1.0 Mandarin voices are graded D on the model card and can't read embedded English.

## Voice choice

Model-card grades: `af_heart` A, `af_bella` A-, `am_michael`, `am_fenrir` and `am_puck` C+; every v1.0 Mandarin voice is D. The project default is **`af_heart` at speed 1.1** (`stories/*.json` → `voice`). Naturalness is a judgement call made by listening; the comparison pages are in `output/tts-eval/`.
