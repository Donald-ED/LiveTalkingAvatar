# Live Talking Avatar

A real-time conversational avatar with text-to-speech capabilities. This project implements a local LLM chat interface with streaming responses and synchronized real-time speech output.

## Features

- **Real-time Text-to-Speech**: Converts streaming text output to natural speech as it's generated
- **Local LLM Integration**: Works with any HuggingFace compatible model
- **Voice Selection**: Choose from any system voice available on macOS
- **Multiprocessing Architecture**: Robust speech engine that prevents UI blocking
- **Low Latency**: Optimized for real-time performance with minimal delay
- **Sentence-Aware Chunking**: Natural speech flow with proper phrasing

## Requirements

- Python 3.7+
- macOS (for native speech synthesis)
- HuggingFace transformers library
- pyttsx3 for Text-to-Speech

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/livetalkingavatar.git
cd livetalkingavatar
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Basic Usage

Run the chat interface with default settings:

```bash
python chat.py
```

This will use the TinyLlama-1.1B-Chat model and the default system voice.

### Voice Selection

List available voices:

```bash
python chat.py --tts-voice list
```

Use a specific voice:

```bash
python chat.py --tts-voice com.apple.voice.compact.en-US.Samantha
```

### Model Selection

Use a different language model:

```bash
python chat.py --model facebook/opt-1.3b
```

### Additional Options

```
--no-tts                Disable text-to-speech
--no-stream             Disable streaming (generate full response at once)
--tts-rate RATE         Speech rate in words per minute (default: 175)
--tts-volume VOLUME     Volume level from 0.0 to 1.0 (default: 1.0)
--tts-chunk-size SIZE   Character chunk size for TTS (default: 150)
```

## Architecture

### Components

1. **chat.py**: Main chat interface that integrates the LLM with TTS
2. **tts.py**: Text-to-speech engine that runs in a separate process

### Text-to-Speech Implementation

- Uses multiprocessing to prevent blocking and resource conflicts
- Isolates the pyttsx3 engine to avoid "run loop already started" errors
- Implements smart buffering to handle streaming text in natural chunks

## Future Development

- Visual avatar with lip sync
- Emotion and expression support
- Support for additional TTS engines
- Cross-platform compatibility
- WebUI interface

## License

MIT

## Credits

- HuggingFace for the transformers library
- pyttsx3 for text-to-speech functionality 