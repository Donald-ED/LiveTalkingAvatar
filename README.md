# AI Talking Avatar

A web-based application that provides a 3D talking avatar with real-time responses powered by an LLM (Language Learning Model). The avatar features realistic facial expressions, lip-syncing, and natural movements.

## Features

- 3D animated avatar with facial expressions
- Real-time speech synthesis and lip-syncing
- LLM-powered responses
- Speech recognition for voice input
- Customizable API endpoint for different LLM models

## Installation

### Prerequisites

- Python 3.x
- Web browser with WebGL support

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/talking-avatar.git
   cd talking-avatar
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install the required dependencies:
   ```bash
   pip install flask flask-cors ollama
   ```

## Usage

1. Start the LLM server:
   ```bash
   python local_llm_server.py
   ```
   This will start a Flask server on port 8000 that handles communication with the LLM.

2. In a separate terminal, start a web server:
   ```bash
   python -m http.server 8080
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8080/realtime_avatar.html
   ```

4. In the web interface, ensure the API URL is set to:
   ```
   http://localhost:8000/api/chat
   ```

5. Start interacting with the avatar using the provided buttons.

## LLM Integration

The application uses Ollama for local LLM capabilities if available. If Ollama is not installed, it will fall back to simulated responses.

To use a different LLM:
1. Modify the API URL in the web interface
2. Adjust the `local_llm_server.py` to connect to your preferred model

## Customizing the Avatar

The 3D avatar model is stored in `models/avatar.glb`. You can replace this file with a different GLB model to change the avatar's appearance. The model should include:

- Proper head bones for animation
- Facial morph targets (especially for mouth movements for lip-sync)
- Standard naming conventions for facial features

## License

[Add appropriate license information here] 