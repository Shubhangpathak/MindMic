# Heimdall Meeting Summarizer

A desktop application that records microphone and system audio, transcribes meetings locally using Whisper, and generates structured notes.

## Current Status

- System and mic audio recording using FFmpeg (Working with windows for windows)
- Local Whisper transcription
- Node.js pipeline orchestration
- Preparing lightweight Electron UI

## Tech Stack

- FFmpeg (audio capture)
- Node.js (process orchestration)
- Python and Whisper (speech-to-text)
- Electron (UI shell)

## Goal

Record meetings, lectures, or live discussions and automatically generate notes on it.

## Roadmap

- Electron UI (Start / Stop / Status)
- Show transcript in app
- Note summarization

## Prerequisites
- Node.js (v18+ recommended)
- Python (3.8+)
- FFmpeg installed and available in PATH
- faster-whisper Python package

**Installation**
- Install FFmpeg:
- Windows: Download from ffmpeg.org or use winget install ffmpeg
   - Open environment variable and add the location for ffmpeg in PATH
   - After cloning repo go to electron & run npm i then npm start to start the application
   - As of now it's not doing much but should be able to record yours and system audio

--App is currently under development--