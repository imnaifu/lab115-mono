#!/usr/bin/env bash
# One-off setup for the local Kokoro TTS: a Python 3.12 venv in .venv-tts (git-ignored).
# Free and offline after the first run; the model (~330 MB per version) downloads from
# Hugging Face on first use into ~/.cache/huggingface.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required (it fetches a Python 3.12 that kokoro supports): brew install uv  — or see https://docs.astral.sh/uv/" >&2
  exit 1
fi
if ! command -v espeak-ng >/dev/null 2>&1; then
  echo "warning: espeak-ng not found. Install it (macOS: brew install espeak-ng, Debian/Ubuntu: sudo apt install espeak-ng);" >&2
  echo "         Kokoro uses it for words missing from its English dictionary." >&2
fi

uv venv --python 3.12 .venv-tts
VIRTUAL_ENV="$PWD/.venv-tts" uv pip install -r tts/requirements.txt
echo "Downloading the model and running a self-test…"
.venv-tts/bin/python tts/kokoro_worker.py --self-test
