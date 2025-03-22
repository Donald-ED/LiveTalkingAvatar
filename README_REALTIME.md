# Real-time Talking Avatar System

This project implements near real-time talking avatar generation using SadTalker. The system processes audio in small chunks and generates corresponding video segments with facial animations synchronized to the speech.

## Prerequisites

- Python 3.x
- SadTalker (properly installed and configured)
- SoX (`brew install sox`) - for microphone recording
- pyttsx3 (`pip install pyttsx3`) - for text-to-speech

## Files Overview

1. **realtime_avatar.py** - Microphone-based real-time processing
2. **tts_realtime_avatar.py** - Text-to-speech based real-time processing
3. **websocket_avatar.py** - WebSocket-based interface with a web UI

## Quick Start - Microphone Input

The microphone-based system records audio in small chunks and processes them to generate talking avatar videos:

```bash
python realtime_avatar.py --image path/to/image.jpg --quality low
```

Options:
- `--image`: Path to the source image (required)
- `--sadtalker-path`: Path to SadTalker directory (default: "SadTalker")
- `--output-dir`: Directory to save output videos (default: "realtime_results")
- `--chunk-duration`: Duration of each audio chunk in seconds (default: 3)
- `--quality`: Quality of processing - affects speed (choices: low, medium, high; default: low)

## Quick Start - Text Input

The TTS-based system converts text input to speech and then generates talking avatar videos:

```bash
python tts_realtime_avatar.py --image path/to/image.jpg --quality low
```

Additional options:
- `--list-voices`: List all available TTS voices and exit
- `--voice-id`: Voice ID for TTS (e.g., "com.apple.voice.compact.en-US.Samantha")
- `--speech-rate`: Speech rate for TTS (default: 175)

## WebSocket-Based Approach (Most Responsive)

This approach provides a web interface to interact with the talking avatar system, allowing for the most user-friendly experience.

```bash
# First, create the HTML test page
python websocket_avatar.py --create-html

# Then run the WebSocket server
python websocket_avatar.py --image sample_images/sample_face.jpg --quality low
```

Once the server is running, open `web/index.html` in your browser to interact with the avatar system.

Options:
- `--image`: Path to the source image (required)
- `--sadtalker-path`: Path to SadTalker directory (default: "SadTalker")
- `--output-dir`: Directory to save output videos (default: "realtime_results")
- `--voice`: macOS voice name (default: "Samantha")
- `--rate`: Speech rate in words per minute (default: 175)
- `--quality`: Quality of processing (choices: low, medium, high; default: low)
- `--host`: WebSocket host (default: "localhost")
- `--port`: WebSocket port (default: 8765)
- `--create-html`: Create HTML test page and exit

## Comparison of Approaches

| Approach | Pros | Cons |
|----------|------|------|
| Microphone-based | Direct voice input | Can't edit/retry speech |
| TTS-based | Text input can be edited | Requires restarting for multiple inputs |
| WebSocket-based | Web UI, most user-friendly | Requires browser to use |

## How It Works

Both systems use a multi-threaded pipeline approach:

### Microphone-Based System
1. Audio recording thread captures chunks of audio from the microphone
2. Processor thread takes audio chunks and runs them through SadTalker
3. Player thread displays the generated videos as they become available

### TTS-Based System
1. TTS generator thread converts text input to speech audio files
2. Processor thread takes audio files and runs them through SadTalker
3. Player thread displays the generated videos as they become available

## Quality Settings

The quality parameter affects processing speed and output quality:

- **low**: Fastest processing, uses `--still --preprocess crop --enhancer none`
- **medium**: Balanced, uses `--still --preprocess crop`
- **high**: Best quality but slowest, uses `--preprocess full --enhancer gfpgan`

## Limitations

- There's a delay between input and output due to processing time
- Video segments are not stitched together into a continuous stream
- SadTalker was not designed for real-time processing and has significant latency

## Improving Real-Time Performance

For better real-time performance:
- Use shorter audio chunks (1-2 seconds)
- Use the "low" quality setting
- Run on a machine with GPU support
- Consider optimizing SadTalker for faster inference

## Example Usage

### Microphone Input
```bash
python realtime_avatar.py --image sample_images/sample_face.jpg --quality low --chunk-duration 2
```

### Text Input
```bash
python tts_realtime_avatar.py --image sample_images/sample_face.jpg --quality low --voice-id "com.apple.voice.compact.en-US.Samantha"
```
When prompted, type text and press Enter to generate speech and animation. 