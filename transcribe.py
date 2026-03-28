from faster_whisper import WhisperModel
from datetime import datetime

print("transcription.py has been sucessfully callled")

# audio_file = "./sound-recorder/output.wav"
audio_file = "D:\BIG ONE\heimdall-meeting-summarizer\electron\output.wav"
output_file = "./meeting.txt"

print("Transcribing...")
model = WhisperModel("base", device="cpu", compute_type="int8")

segments, info = model.transcribe(audio_file, beam_size=5)

with open("transcription.txt", "a", encoding="utf-8") as f:
        for segment in segments:    
             text = segment.text.strip()
             if text:
                  f.write(f" {text} \n")

# for segment in segments:
#     print(f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}")
print("Done! Sucessfully")
