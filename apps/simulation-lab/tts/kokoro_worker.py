"""Kokoro TTS worker for simulation-lab.

Protocol: one JSON object per line on stdin, one JSON reply per line on stdout.
  request: {"id": str, "text": str, "voice": "af_heart", "model": "v1.0" | "v1.1-zh", "speed": 1.0, "out": "/path.wav"}
  reply:   {"id": str, "ok": true, "seconds": <generation time>}  or  {"id": str, "ok": false, "error": "..."}
The first line written is {"ready": true, ...} once imports succeed. Models load lazily and stay
in memory, so a whole story costs one model load.
"""
import json
import os
import sys
import time
from pathlib import Path


def configure_espeak():
    """The espeak-ng library bundled with espeakng-loader has its CI build path baked in and fails
    on macOS; prefer a system install when one exists (override with SIMLAB_ESPEAK_LIB/DATA)."""
    import espeakng_loader

    candidates = [
        (os.environ.get("SIMLAB_ESPEAK_LIB"), os.environ.get("SIMLAB_ESPEAK_DATA")),
        ("/opt/homebrew/lib/libespeak-ng.dylib", "/opt/homebrew/share/espeak-ng-data"),
        ("/usr/local/lib/libespeak-ng.dylib", "/usr/local/share/espeak-ng-data"),
        ("/usr/lib/x86_64-linux-gnu/libespeak-ng.so.1", "/usr/lib/x86_64-linux-gnu/espeak-ng-data"),
        ("/usr/lib/aarch64-linux-gnu/libespeak-ng.so.1", "/usr/lib/aarch64-linux-gnu/espeak-ng-data"),
    ]
    for library, data in candidates:
        if library and data and Path(library).exists() and Path(data).exists():
            espeakng_loader.get_library_path = lambda library=library: library
            espeakng_loader.get_data_path = lambda data=data: data
            return library
    return "bundled"


ESPEAK = configure_espeak()

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import torch  # noqa: E402
from kokoro import KModel, KPipeline  # noqa: E402

SAMPLE_RATE = 24000
REPOS = {"v1.0": "hexgrad/Kokoro-82M", "v1.1-zh": "hexgrad/Kokoro-82M-v1.1-zh"}
DEVICE = os.environ.get("SIMLAB_TTS_DEVICE", "cpu")
_models = {}
_pipelines = {}


def lang_code(voice):
    prefix = voice[:1]
    if prefix in "ab":
        return prefix  # American / British English
    if prefix == "z":
        return "z"
    raise ValueError(f"unsupported voice {voice!r}: use af_/am_/bf_/bm_ (English) or zf_/zm_ (Mandarin)")


def pipeline_for(model_name, voice):
    repo = REPOS.get(model_name)
    if repo is None:
        raise ValueError(f"unknown model {model_name!r}; use one of {sorted(REPOS)}")
    code = lang_code(voice)
    key = (repo, code)
    if key not in _pipelines:
        if repo not in _models:
            _models[repo] = KModel(repo_id=repo).to(DEVICE).eval()
        options = {}
        if code == "z" and repo.endswith("zh"):
            # English words inside Chinese text go through the English G2P (as in the model's samples).
            english = KPipeline(lang_code="a", repo_id=repo, model=False)
            options["en_callable"] = lambda text: next(english(text)).phonemes
        _pipelines[key] = KPipeline(lang_code=code, repo_id=repo, model=_models[repo], **options)
    return _pipelines[key]


def zh_speed(base):
    # From the v1.1-zh samples: slow down long inputs, which the model otherwise rushes.
    def speed(length):
        factor = 1 if length <= 83 else (1 - (length - 83) / 500 if length < 183 else 0.8)
        return factor * 1.1 * base
    return speed


def synthesize(request):
    voice = request["voice"]
    model_name = request.get("model") or ("v1.1-zh" if voice.startswith("z") else "v1.0")
    pipeline = pipeline_for(model_name, voice)
    speed = float(request.get("speed", 1.0))
    if voice.startswith("z") and model_name == "v1.1-zh":
        speed = zh_speed(speed)
    # split_pattern=None: the caller already split narration into caption-sized clips.
    chunks = [result.audio for result in pipeline(request["text"], voice=voice, speed=speed, split_pattern=None)]
    if not chunks:
        raise ValueError("no audio produced (empty text?)")
    audio = np.concatenate([chunk.numpy() if hasattr(chunk, "numpy") else np.asarray(chunk) for chunk in chunks])
    sf.write(request["out"], audio, SAMPLE_RATE, subtype="PCM_16")


def phonemes(request):
    voice = request["voice"]
    model_name = request.get("model") or ("v1.1-zh" if voice.startswith("z") else "v1.0")
    pipeline = pipeline_for(model_name, voice)
    return " | ".join(result.phonemes for result in pipeline(request["text"], voice=voice, split_pattern=None))


def main():
    if "--phonemes" in sys.argv:
        # Pronunciation check: G2P only, no audio. Input/output: JSON lines.
        for line in sys.stdin:
            if line.strip():
                request = json.loads(line)
                print(json.dumps({"id": request.get("id"), "phonemes": phonemes(request)}, ensure_ascii=False), flush=True)
        return
    if "--self-test" in sys.argv:
        out = Path(".venv-tts/self-test.wav")
        started = time.perf_counter()
        synthesize({"text": "Simulation lab is ready.", "voice": "af_heart", "out": str(out)})
        info = sf.info(str(out))
        print(f"ok: {info.duration:.2f}s of audio in {time.perf_counter() - started:.1f}s (espeak: {ESPEAK}, device: {DEVICE}, torch {torch.__version__})")
        return
    print(json.dumps({"ready": True, "espeak": ESPEAK, "device": DEVICE, "torch": torch.__version__}), flush=True)
    for line in sys.stdin:
        if not line.strip():
            continue
        request = json.loads(line)
        started = time.perf_counter()
        try:
            synthesize(request)
            reply = {"id": request["id"], "ok": True, "seconds": round(time.perf_counter() - started, 3)}
        except Exception as error:  # report per clip; the caller retries or moves on
            reply = {"id": request.get("id"), "ok": False, "error": f"{type(error).__name__}: {error}"}
        print(json.dumps(reply), flush=True)


if __name__ == "__main__":
    main()
