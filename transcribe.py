import sys
from pathlib import Path


def main() -> int:
    try:
        from faster_whisper import WhisperModel
    except ModuleNotFoundError:
        print(
            "Missing Python dependency: faster-whisper.\n"
            "Install it in your project environment with:\n"
            "  .\\.venv\\Scripts\\python.exe -m pip install faster-whisper",
            file=sys.stderr,
        )
        return 1

    base_dir = Path(__file__).resolve().parent
    default_audio_file = base_dir / "electron" / "output.wav"
    audio_file = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else default_audio_file
    output_file = base_dir / "transcription.txt"

    if not audio_file.exists():
        print(f"Audio file not found: {audio_file}", file=sys.stderr)
        return 1

    print(f"Transcribing: {audio_file}")
    model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(str(audio_file), beam_size=5)

    collected = []
    for segment in segments:
        text = segment.text.strip()
        if text:
            start = round(segment.start, 2)
            collected.append(f"{start}s {text}")

    with output_file.open("a", encoding="utf-8") as handle:
        for line in collected:
            handle.write(f"{line}\n")

    print(f"Done! Wrote {len(collected)} segment(s) to {output_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
