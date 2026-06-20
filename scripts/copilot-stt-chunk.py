# -*- coding: utf-8 -*-
"""Быстрый STT одного wav-чанка (faster_whisper) для live copilot."""
import json
import os
import platform
import sys
from pathlib import Path

_MODEL = None


def prepend_nvidia_cuda_paths() -> None:
    import site

    paths = []
    for base in site.getsitepackages() + [site.getusersitepackages()]:
        if not base:
            continue
        root = Path(base)
        for sub in ("nvidia/cublas/bin", "nvidia/cudnn/bin", "nvidia/cuda_nvrtc/bin"):
            p = root / sub.replace("/", os.sep)
            if p.is_dir() and any(p.glob("*.dll")):
                paths.append(p)
    if not paths:
        return
    path_strs = [str(p) for p in paths]
    os.environ["PATH"] = os.pathsep.join(path_strs) + os.pathsep + os.environ.get("PATH", "")
    if platform.system() == "Windows":
        for p in paths:
            try:
                os.add_dll_directory(str(p))
            except (OSError, FileNotFoundError):
                pass


def pick_device():
    forced = os.environ.get("WHISPER_DEVICE", "").strip().lower()
    if forced == "cpu":
        return "cpu", "int8"
    try:
        import ctranslate2

        if ctranslate2.get_cuda_device_count() > 0:
            cuda_types = ctranslate2.get_supported_compute_types("cuda")
            if cuda_types:
                compute = "float16" if "float16" in cuda_types else "int8_float16"
                return "cuda", compute
    except Exception:
        pass
    return "cpu", "int8"


def get_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    prepend_nvidia_cuda_paths()
    from faster_whisper import WhisperModel

    model_name = os.environ.get("COPILOT_WHISPER_MODEL", "small")
    device, compute = pick_device()
    _MODEL = WhisperModel(model_name, device=device, compute_type=compute)
    return _MODEL


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: copilot-stt-chunk.py <wav>"}), file=sys.stderr)
        sys.exit(1)
    wav = Path(sys.argv[1])
    if not wav.is_file():
        print(json.dumps({"error": f"not found: {wav}"}), file=sys.stderr)
        sys.exit(2)
    model = get_model()
    segments, _info = model.transcribe(
        str(wav),
        language="ru",
        beam_size=3,
        vad_filter=True,
        without_timestamps=True,
    )
    parts = [s.text.strip() for s in segments if s.text.strip()]
    text = " ".join(parts).strip()
    print(json.dumps({"text": text}, ensure_ascii=False))


if __name__ == "__main__":
    main()
