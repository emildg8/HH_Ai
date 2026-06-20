# -*- coding: utf-8 -*-
"""Smoke-тест: faster_whisper на CUDA (encode, не только load)."""
import importlib.util
import subprocess
import sys
import tempfile
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("transcribe_meeting", _SCRIPTS / "transcribe-meeting.py")
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

from faster_whisper import WhisperModel  # noqa: E402


def main() -> None:
    wav = Path(tempfile.mktemp(suffix=".wav"))
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "2", str(wav)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        print("[test] loading tiny on cuda...")
        model = WhisperModel("tiny", device="cuda", compute_type="float16")
        print("[test] transcribing 2s audio...")
        segments, info = model.transcribe(str(wav), language="ru")
        list(segments)
        print(f"[test] OK cuda encode, language={info.language}")
    finally:
        if wav.exists():
            wav.unlink()


if __name__ == "__main__":
    main()
