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

    # We need exactly 3 things: the script name, the audio path, and the output path :>
    if len(sys.argv) < 3:
        print("Error: Missing file paths from Electron Manager.", file=sys.stderr)
        return 1

    # Read the exact paths sent by Electron asapppp
    audio_file = Path(sys.argv[1]).resolve()
    output_file = Path(sys.argv[2]).resolve()

    if not audio_file.exists():
        print(f"Audio file not found: {audio_file}", file=sys.stderr)
        return 1

    print(f"Transcribing: {audio_file}")
    
    # Run your Whisper model
    model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(str(audio_file), beam_size=5)

    collected = []
    for segment in segments:
        text = segment.text.strip()
        if text:
            start = round(segment.start, 2)
            collected.append(f"{start}s {text}")

    # Save it to the new meeting folder using "w" (write fresh, no more appending!)
    with output_file.open("w", encoding="utf-8") as handle:
        for line in collected:
            handle.write(f"{line}\n")

    print(f"Done! Wrote {len(collected)} segment(s) to {output_file}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())