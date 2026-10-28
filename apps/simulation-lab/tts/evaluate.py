"""Kokoro evaluation: English + Mandarin narration samples, phonemes and timing (CPU vs MPS).

Run on any machine to check compatibility and speed before relying on it:
    npm run tts:evaluate            (writes output/tts-eval/<timestamp>/ with one WAV per sentence and voice, plus report.json)
"""
import json, os, sys, time
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
sys.path.insert(0, str(Path(__file__).parent))
import kokoro_worker  # noqa: F401,E402  (applies the espeak-ng path fix)
from kokoro import KModel, KPipeline  # noqa: E402

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
SR = 24000
GAP = np.zeros(int(0.45 * SR), dtype=np.float32)

EN = [
    ("en1_clock", "Same person, same arrival time. Customer #52 waited 2:42 on the left, and 8:12 on the right."),
    ("en2_spoken", "Customer number 52 waited 2 minutes 42 seconds on the left, and 8 minutes 12 seconds on the right."),
    ("en3_stats", "Across 200 random runs, rule A had the lowest average wait in 161 of them. That's 81%."),
    ("en4_terms", "The 95th-percentile wait was 6:56. Arrivals follow a Poisson process, service times are lognormal, and each line is FIFO."),
    ("en5_question", "Pause and guess: which rule wins? A, B, or C?"),
]
ZH = [
    ("zh1_numbers", "同一个人，同一时刻到达。52号顾客在左边等了2分42秒，在右边等了8分12秒。"),
    ("zh2_stats", "在200次随机实验中，单队规则有161次平均等待最短，占81%。"),
    ("zh3_polyphones", "银行的行长说，长队会让人着急；重新排队并不总是更快。"),
    ("zh4_terms", "P95等待时间是6:56。到达服从Poisson过程，服务时间服从对数正态分布，这是一个FIFO队列。"),
    ("zh5_question", "暂停一下，猜猜看：A、B、C哪个规则会赢？"),
]

import platform
report = {"machine": os.uname().machine, "processor": platform.processor(), "system": platform.platform(), "torch": torch.__version__, "runs": []}

def run(label, pipeline, voice, sentences, speed=1.0):
    clips, rows = [], []
    for sid, text in sentences:
        t0 = time.perf_counter()
        results = list(pipeline(text, voice=voice, speed=speed))
        elapsed = time.perf_counter() - t0
        audio = np.concatenate([r.audio.numpy() if hasattr(r.audio, "numpy") else np.asarray(r.audio) for r in results]).astype(np.float32)
        phonemes = " | ".join(r.phonemes for r in results)
        dur = len(audio) / SR
        sf.write(OUT / f"{label}__{sid}.wav", audio, SR)
        clips += [audio, GAP]
        rows.append({"id": sid, "text": text, "phonemes": phonemes, "audio_s": round(dur, 2), "gen_s": round(elapsed, 3),
                     "rtf": round(elapsed / dur, 3), "peak": round(float(np.abs(audio).max()), 3), "chunks": len(results)})
    sf.write(OUT / f"{label}__ALL.wav", np.concatenate(clips), SR)
    report["runs"].append({"label": label, "voice": voice, "rows": rows})
    total_audio = sum(r["audio_s"] for r in rows); total_gen = sum(r["gen_s"] for r in rows)
    print(f"{label:28s} audio {total_audio:6.1f}s  gen {total_gen:6.2f}s  RTF {total_gen/total_audio:.3f}", flush=True)

# --- English, v1.0 ---
DEVICES = ["cpu"] + (["mps"] if torch.backends.mps.is_available() else [])
for device in DEVICES:
    t0 = time.perf_counter()
    model = KModel(repo_id="hexgrad/Kokoro-82M").to(device).eval()
    en = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M", model=model)
    list(en("Warm up.", voice="af_heart"))
    print(f"[{device}] v1.0 load+warmup {time.perf_counter()-t0:.1f}s", flush=True)
    voices = ["af_heart", "af_bella", "am_michael", "am_fenrir", "bm_george"] if device == "cpu" else ["af_heart"]
    for voice in voices:
        pipe = en if not voice.startswith("b") else KPipeline(lang_code="b", repo_id="hexgrad/Kokoro-82M", model=model)
        run(f"en_v10_{voice}_{device}", pipe, voice, EN)

# --- Mandarin: v1.0 voices ---
model10 = KModel(repo_id="hexgrad/Kokoro-82M").to("cpu").eval()
zh10 = KPipeline(lang_code="z", repo_id="hexgrad/Kokoro-82M", model=model10)
for voice in ["zf_xiaoxiao", "zm_yunxi"]:
    run(f"zh_v10_{voice}_cpu", zh10, voice, ZH)

# --- Mandarin: v1.1-zh (official en_callable + speed_callable from samples/make_zh.py) ---
REPO = "hexgrad/Kokoro-82M-v1.1-zh"
en_g2p = KPipeline(lang_code="a", repo_id=REPO, model=False)
def en_callable(text):
    return next(en_g2p(text)).phonemes
def speed_callable(len_ps):
    speed = 0.8
    if len_ps <= 83: speed = 1
    elif len_ps < 183: speed = 1 - (len_ps - 83) / 500
    return speed * 1.1
for device in DEVICES:
    t0 = time.perf_counter()
    model11 = KModel(repo_id=REPO).to(device).eval()
    zh11 = KPipeline(lang_code="z", repo_id=REPO, model=model11, en_callable=en_callable)
    list(zh11("预热。", voice="zf_001", speed=speed_callable))
    print(f"[{device}] v1.1-zh load+warmup {time.perf_counter()-t0:.1f}s", flush=True)
    for voice in (["zf_001", "zf_003", "zm_010", "zm_009"] if device == "cpu" else ["zf_001"]):
        run(f"zh_v11_{voice}_{device}", zh11, voice, ZH, speed=speed_callable)

(OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
print("done")
