# -*- coding: utf-8 -*-
"""GPU-транскрипция чанков HR Q&A → data/hr-video-analysis/chunk-*.txt"""
import importlib.util
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_SPEC = importlib.util.spec_from_file_location(
    "transcribe_meeting", _ROOT / "scripts" / "transcribe-meeting.py"
)
_tm = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_tm)

HR_PROMPT = (
    "HeadHunter, hh.ru, сопроводительное письмо, рекрутер, HR BP, собеседование, скрининг, "
    "оффер, грейд, Яндекс, Авито, LinkedIn, рефералка, системный аналитик, DevOps, "
    "Product Manager, этичный хакинг карьеры, Вита Зайбумба, Яна Гойдукова."
)


def transcribe_wav(wav: Path, model_name: str) -> tuple[list, str]:
    from faster_whisper import WhisperModel

    device, compute_type = _tm.pick_device()
    print(f"[whisper] {wav.name} model={model_name} device={device}")
    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    segments_iter, info = model.transcribe(
        str(wav),
        language="ru",
        beam_size=8,
        vad_filter=True,
        initial_prompt=HR_PROMPT,
    )
    segments = []
    for seg in segments_iter:
        text = seg.text.strip()
        if text:
            segments.append(
                {"startSec": round(seg.start, 3), "endSec": round(seg.end, 3), "text": text}
            )
    return segments, info.language


def main() -> None:
    force = "--force" in sys.argv
    out_dir = _ROOT / "data" / "hr-video-analysis"
    model_name = "large-v3"

    chunks = sorted(out_dir.glob("chunk-*.wav"))
    if not chunks:
        print("[error] no chunk-*.wav in data/hr-video-analysis", file=sys.stderr)
        sys.exit(1)

    for wav in chunks:
        txt = out_dir / f"{wav.stem}.txt"
        json_out = out_dir / f"{wav.stem}.transcript.json"
        if not force and txt.exists() and txt.stat().st_size > 5000:
            print(f"[skip] {wav.name}")
            continue
        print(f"=== {wav.name} ===")
        segments, language = transcribe_wav(wav, model_name)
        lines = [s["text"] for s in segments]
        txt.write_text("\n".join(lines) + "\n", encoding="utf-8")
        json_out.write_text(
            json.dumps({"segments": segments, "language": language}, ensure_ascii=False, indent=2)
            + "\n",
            encoding="utf-8",
        )
        print(f"[done] {len(segments)} segments -> {txt.name}")

    print("[all done]")


if __name__ == "__main__":
    main()
