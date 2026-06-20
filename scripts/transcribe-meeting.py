# -*- coding: utf-8 -*-
"""Транскрибация встречи (faster_whisper, CUDA) → JSON + txt + srt + timed txt."""
import json
import os
import platform
import subprocess
import sys
import tempfile
from pathlib import Path


def prepend_nvidia_cuda_paths() -> None:
    """Добавить nvidia/cublas/bin и nvidia/cudnn/bin в PATH до загрузки DLL CTranslate2."""
    import site

    paths: list[Path] = []
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
    print("[cuda] DLL paths:", ", ".join(path_strs))


prepend_nvidia_cuda_paths()

import ctranslate2  # noqa: E402
from faster_whisper import WhisperModel  # noqa: E402

DOMAIN_PROMPT = (
    "Иннотех, T1, Dion, таунхолл, премия, грейд, KPI, TКRС, TKRS, HR BP, "
    "оценка A B C D, DevOps, стрим, Confluence, Сервионика, ВТБ, Copilot, "
    "цифровой помощник, оверперформер, корпоративные ценности."
)


def fmt_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def pick_device() -> tuple[str, str]:
    forced = os.environ.get("WHISPER_DEVICE", "").strip().lower()
    if forced == "cpu":
        return "cpu", "int8"
    try:
        if ctranslate2.get_cuda_device_count() > 0:
            cuda_types = ctranslate2.get_supported_compute_types("cuda")
            if cuda_types:
                compute = "float16" if "float16" in cuda_types else "int8_float16"
                return "cuda", compute
    except Exception as e:
        print(f"[cuda] warning: {e}", file=sys.stderr)
    if forced == "cuda":
        print(
            "[error] WHISPER_DEVICE=cuda, но GPU недоступен. "
            "Установите: pip install nvidia-cublas-cu12 nvidia-cudnn-cu12",
            file=sys.stderr,
        )
        sys.exit(3)
    return "cpu", "int8"


def extract_wav(video: Path) -> Path:
    tmp = Path(tempfile.gettempdir()) / f"meeting-{video.stem[:40]}.wav"
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video),
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        str(tmp),
    ]
    print("[ffmpeg] extract 16kHz mono:", tmp.name)
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return tmp


def write_outputs(out_dir: Path, base: str, suffix: str, segments: list, language: str) -> None:
    json_out = out_dir / f"{base}.transcript{suffix}.json"
    json_out.write_text(
        json.dumps({"segments": segments, "language": language}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    timed_lines: list[str] = []
    srt_lines: list[str] = []
    plain_lines: list[str] = []
    idx = 1
    for seg in segments:
        text = seg["text"]
        start = seg["startSec"]
        end = seg["endSec"]
        timed_lines.append(f"[{fmt_ts(start)} -> {fmt_ts(end)}] {text}")
        plain_lines.append(text)
        srt_lines.extend([str(idx), f"{fmt_ts(start)} --> {fmt_ts(end)}", text, ""])
        idx += 1

    tag = suffix or ""
    (out_dir / f"transcript{tag}.txt").write_text("\n".join(plain_lines) + "\n", encoding="utf-8")
    (out_dir / f"transcript{tag}-timed.txt").write_text("\n".join(timed_lines) + "\n", encoding="utf-8")
    (out_dir / f"transcript{tag}.srt").write_text("\n".join(srt_lines) + "\n", encoding="utf-8")
    print(f"[done] segments={len(segments)}")
    print(f"[done] {json_out}")


def transcribe_audio(wav_path: Path, model_name: str, device: str, compute_type: str) -> tuple[list, str]:
    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    segments_iter, info = model.transcribe(
        str(wav_path),
        language="ru",
        beam_size=8,
        vad_filter=True,
        initial_prompt=DOMAIN_PROMPT,
    )
    print(f"[whisper] language={info.language} ({info.language_probability:.2f})")

    segments = []
    idx = 1
    for seg in segments_iter:
        text = seg.text.strip()
        if not text:
            continue
        segments.append(
            {"startSec": round(seg.start, 3), "endSec": round(seg.end, 3), "text": text}
        )
        if idx % 50 == 0:
            print(f"  ... {idx} segments")
        idx += 1
    return segments, info.language


def main() -> None:
    args = sys.argv[1:]
    force = "--force" in args
    args = [a for a in args if a != "--force"]
    v2 = "--v2" in args
    args = [a for a in args if a != "--v2"]

    if len(args) < 2:
        print("Usage: transcribe-meeting.py [--force] [--v2] <video> <out_dir> [model]", file=sys.stderr)
        sys.exit(1)

    video = Path(args[0]).resolve()
    out_dir = Path(args[1]).resolve()
    model_name = args[2] if len(args) > 2 else "large-v3"
    suffix = "-v2" if v2 else ""

    if not video.is_file():
        print(f"Video not found: {video}", file=sys.stderr)
        sys.exit(1)

    out_dir.mkdir(parents=True, exist_ok=True)
    base = video.stem
    json_out = out_dir / f"{base}.transcript{suffix}.json"

    if not force and json_out.exists() and json_out.stat().st_size > 100:
        print(f"[skip] cached {json_out}")
        return

    device, compute_type = pick_device()
    print(f"[whisper] model={model_name} device={device} compute={compute_type} video={video.name}")

    wav_path = None
    try:
        wav_path = extract_wav(video)
        try:
            segments, language = transcribe_audio(wav_path, model_name, device, compute_type)
        except RuntimeError as e:
            if device == "cuda" and "cublas" in str(e).lower():
                print(
                    f"\n[error] CUDA encode failed: {e}\n"
                    "Установите: pip install nvidia-cublas-cu12 nvidia-cudnn-cu12\n"
                    "Или задайте WHISPER_DEVICE=cpu для принудительного CPU.",
                    file=sys.stderr,
                )
                sys.exit(4)
            raise
        if not segments:
            print("[error] empty transcript", file=sys.stderr)
            sys.exit(2)
        write_outputs(out_dir, base, suffix, segments, language)
    finally:
        if wav_path and wav_path.exists():
            try:
                wav_path.unlink()
            except OSError:
                pass


if __name__ == "__main__":
    main()
