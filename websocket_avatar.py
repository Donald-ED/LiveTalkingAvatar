#!/usr/bin/env python3
import os
import sys
import json
import time
import asyncio
import threading
import tempfile
import subprocess
import websockets
from datetime import datetime
import shutil
import uuid

class WebSocketTalkingAvatar:
    def __init__(self, 
                 source_image,
                 sadtalker_path="SadTalker",
                 output_dir="realtime_results",
                 voice="Samantha", 
                 rate=175,
                 quality="low",
                 host="localhost",
                 port=8765):
        """
        Initialize a more responsive talking avatar system using websockets
        
        Args:
            source_image (str): Path to source image
            sadtalker_path (str): Path to SadTalker directory
            output_dir (str): Directory to save output files
            voice (str): macOS voice name (e.g., "Samantha")
            rate (int): Speech rate (words per minute)
            quality (str): Quality of processing - affects speed
            host (str): WebSocket host
            port (int): WebSocket port
        """
        self.source_image = os.path.abspath(source_image)
        self.sadtalker_path = os.path.abspath(sadtalker_path)
        self.output_dir = os.path.abspath(output_dir)
        self.voice = voice
        self.rate = rate
        self.quality = quality
        self.host = host
        self.port = port
        
        # Create output directory
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Temporary directory for processing
        self.temp_dir = tempfile.mkdtemp()
        print(f"Using temporary directory: {self.temp_dir}")
        
        # For tracking connected clients
        self.clients = set()
        
        # Parameters for SadTalker based on quality
        self.sadtalker_params = self._get_quality_params(quality)
        
        # Status tracking
        self.processing = False
        self.stopping = False
    
    def _get_quality_params(self, quality):
        """Get SadTalker parameters based on quality setting"""
        params = {
            "low": [
                "--still", 
                "--preprocess", "crop"
            ],
            "medium": [
                "--still", 
                "--preprocess", "crop"
            ],
            "high": [
                "--preprocess", "full",
                "--enhancer", "gfpgan"
            ]
        }
        return params.get(quality, params["medium"])
    
    async def handler(self, websocket, path):
        """Handle WebSocket connection"""
        # Register client
        self.clients.add(websocket)
        client_id = str(uuid.uuid4())
        print(f"Client {client_id} connected")
        
        try:
            # Send initial status
            await websocket.send(json.dumps({
                "type": "status",
                "message": "Connected to talking avatar server"
            }))
            
            # Receive and process messages
            async for message in websocket:
                data = json.loads(message)
                message_type = data.get("type", "")
                
                if message_type == "speak":
                    text = data.get("text", "")
                    if text:
                        print(f"Received text: {text}")
                        # Process text in a separate thread to avoid blocking
                        threading.Thread(
                            target=self.process_text, 
                            args=(text, client_id, websocket),
                            daemon=True
                        ).start()
                elif message_type == "stop":
                    print("Stopping current processing")
                    self.stopping = True
        
        except websockets.exceptions.ConnectionClosed:
            print(f"Client {client_id} disconnected")
        finally:
            # Unregister client
            self.clients.remove(websocket)
    
    def process_text(self, text, client_id, websocket):
        """Process text to generate talking avatar"""
        if self.processing:
            asyncio.run(self.send_message(websocket, {
                "type": "status",
                "message": "Already processing a request, please wait"
            }))
            return
        
        self.processing = True
        self.stopping = False
        
        try:
            # Generate unique IDs for this request
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            request_id = f"{timestamp}_{client_id[-6:]}"
            
            # Notify client we're starting
            asyncio.run(self.send_message(websocket, {
                "type": "status",
                "message": "Starting processing"
            }))
            
            # 1. Convert text to speech using macOS say command
            audio_file = self.text_to_audio(text, request_id)
            if not audio_file or self.stopping:
                return
            
            # Notify progress
            asyncio.run(self.send_message(websocket, {
                "type": "status",
                "message": "Audio generated, creating animation"
            }))
            
            # 2. Process with SadTalker
            video_file = self.run_sadtalker(audio_file, request_id)
            if not video_file or self.stopping:
                return
            
            # 3. Notify client that processing is complete
            # Get a file path that will work in the browser
            filename = os.path.basename(video_file)
            # Use a relative path that points to the output directory
            video_url = f"realtime_results/{filename}"
            
            asyncio.run(self.send_message(websocket, {
                "type": "result",
                "message": "Processing complete",
                "video_url": video_url,
                "video_file": filename
            }))
            
        except Exception as e:
            print(f"Error processing request: {e}")
            asyncio.run(self.send_message(websocket, {
                "type": "error",
                "message": f"Error: {str(e)}"
            }))
        finally:
            self.processing = False
    
    async def send_message(self, websocket, message):
        """Send message to websocket client"""
        try:
            await websocket.send(json.dumps(message))
        except:
            pass
    
    def text_to_audio(self, text, request_id):
        """Convert text to audio using macOS say command"""
        try:
            # First create AIFF file (native format for macOS)
            aiff_file = os.path.join(self.temp_dir, f"tts_{request_id}.aiff")
            wav_file = os.path.join(self.temp_dir, f"tts_{request_id}.wav")
            
            # Use macOS say command
            say_cmd = [
                "say", 
                "-v", self.voice, 
                "-r", str(self.rate), 
                "-o", aiff_file, 
                text
            ]
            
            print(f"Generating speech with command: {' '.join(say_cmd)}")
            subprocess.run(say_cmd, check=True)
            
            # Convert AIFF to WAV using ffmpeg
            ffmpeg_cmd = [
                "ffmpeg", 
                "-i", aiff_file, 
                "-y",  # Overwrite output file if it exists
                wav_file
            ]
            
            print(f"Converting to WAV with command: {' '.join(ffmpeg_cmd)}")
            subprocess.run(ffmpeg_cmd, check=True)
            
            return wav_file
        except subprocess.CalledProcessError as e:
            print(f"Error generating audio: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error generating audio: {e}")
            return None
    
    def run_sadtalker(self, audio_file, request_id):
        """Run SadTalker with the given audio file"""
        try:
            result_dir = os.path.join(self.temp_dir, request_id)
            os.makedirs(result_dir, exist_ok=True)
            
            # Construct SadTalker command
            cmd = [
                "python", 
                os.path.join(self.sadtalker_path, "inference.py"),
                "--driven_audio", audio_file,
                "--source_image", self.source_image,
                "--result_dir", result_dir
            ] + self.sadtalker_params
            
            print(f"Running SadTalker with command: {' '.join(cmd)}")
            
            # Change to SadTalker directory
            current_dir = os.getcwd()
            os.chdir(self.sadtalker_path)
            
            subprocess.run(cmd, check=True)
            
            # Change back to original directory
            os.chdir(current_dir)
            
            # Find the output video
            for root, dirs, files in os.walk(result_dir):
                for file in files:
                    if file.endswith('.mp4'):
                        video_path = os.path.join(root, file)
                        output_path = os.path.join(self.output_dir, f"avatar_{request_id}.mp4")
                        
                        # Copy to output directory
                        shutil.copy2(video_path, output_path)
                        print(f"Generated video saved to: {output_path}")
                        return output_path
            
            print(f"No video file found in {result_dir}")
            return None
        except subprocess.CalledProcessError as e:
            print(f"Error running SadTalker: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error running SadTalker: {e}")
            return None
    
    async def start_server(self):
        """Start the WebSocket server"""
        server = await websockets.serve(self.handler, self.host, self.port)
        print(f"WebSocket server started at ws://{self.host}:{self.port}")
        return server
    
    def start(self):
        """Start the WebSocket server and run forever"""
        try:
            # Start WebSocket server
            asyncio.run(self.run_server())
        except KeyboardInterrupt:
            print("Shutting down...")
        finally:
            # Clean up
            try:
                shutil.rmtree(self.temp_dir)
                print(f"Removed temporary directory: {self.temp_dir}")
            except Exception as e:
                print(f"Error removing temporary directory: {e}")
    
    async def run_server(self):
        """Run the WebSocket server"""
        server = await self.start_server()
        print("Server is running, press Ctrl+C to stop")
        await asyncio.Future()  # Run forever

# HTML page for testing
HTML_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>Talking Avatar Demo</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        #controls {
            margin-bottom: 20px;
        }
        textarea {
            width: 100%;
            height: 100px;
            margin-bottom: 10px;
        }
        button {
            padding: 10px 15px;
            background-color: #4CAF50;
            color: white;
            border: none;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover {
            background-color: #45a049;
        }
        #status {
            margin: 20px 0;
            padding: 10px;
            background-color: #f8f8f8;
            border-left: 5px solid #4CAF50;
        }
        #video-container {
            margin-top: 20px;
        }
        video {
            max-width: 100%;
        }
    </style>
</head>
<body>
    <h1>Real-time Talking Avatar</h1>
    
    <div id="controls">
        <textarea id="text-input" placeholder="Type what you want the avatar to say..."></textarea>
        <button id="speak-button">Generate Avatar</button>
        <button id="stop-button">Stop</button>
    </div>
    
    <div id="status">Ready</div>
    
    <div id="video-container"></div>

    <script>
        const ws = new WebSocket('ws://localhost:8765');
        const speakButton = document.getElementById('speak-button');
        const stopButton = document.getElementById('stop-button');
        const textInput = document.getElementById('text-input');
        const statusDiv = document.getElementById('status');
        const videoContainer = document.getElementById('video-container');
        
        // WebSocket event handlers
        ws.onopen = function(event) {
            statusDiv.textContent = 'Connected to server';
            speakButton.disabled = false;
        };
        
        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log('Received message:', data);
            
            if (data.type === 'status') {
                statusDiv.textContent = data.message;
            } else if (data.type === 'result') {
                statusDiv.textContent = data.message;
                
                // Add video to page
                const videoUrl = data.video_url;
                console.log('Video URL:', videoUrl);
                
                const videoElement = document.createElement('video');
                videoElement.controls = true;
                videoElement.src = videoUrl;
                videoElement.style.display = 'block';
                videoElement.style.marginTop = '10px';
                
                // Add video with timestamp
                const timestamp = new Date().toLocaleTimeString();
                const videoWrapper = document.createElement('div');
                videoWrapper.innerHTML = `<h3>Generated at ${timestamp}</h3>`;
                videoWrapper.appendChild(videoElement);
                
                videoContainer.prepend(videoWrapper);
                
                // Enable speak button
                speakButton.disabled = false;
            } else if (data.type === 'error') {
                statusDiv.textContent = data.message;
                statusDiv.style.borderLeftColor = 'red';
                // Enable speak button
                speakButton.disabled = false;
            }
        };
        
        ws.onclose = function(event) {
            statusDiv.textContent = 'Disconnected from server';
            statusDiv.style.borderLeftColor = 'orange';
            speakButton.disabled = true;
        };
        
        ws.onerror = function(error) {
            statusDiv.textContent = 'WebSocket error';
            statusDiv.style.borderLeftColor = 'red';
            console.error('WebSocket error:', error);
        };
        
        // Button event handlers
        speakButton.addEventListener('click', function() {
            const text = textInput.value.trim();
            if (text) {
                // Disable button while processing
                speakButton.disabled = true;
                statusDiv.style.borderLeftColor = '#4CAF50';
                
                // Send text to server
                ws.send(JSON.stringify({
                    type: 'speak',
                    text: text
                }));
            } else {
                statusDiv.textContent = 'Please enter some text';
                statusDiv.style.borderLeftColor = 'orange';
            }
        });
        
        stopButton.addEventListener('click', function() {
            ws.send(JSON.stringify({
                type: 'stop'
            }));
            statusDiv.textContent = 'Stopping current process';
        });
    </script>
</body>
</html>
"""

def create_html_page(output_dir="web"):
    """Create HTML page for testing the WebSocket server"""
    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, "index.html"), "w") as f:
        f.write(HTML_PAGE)
    print(f"Created HTML page at {os.path.join(output_dir, 'index.html')}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="WebSocket-based talking avatar system")
    parser.add_argument("--image", type=str, help="Path to source image")
    parser.add_argument("--sadtalker-path", type=str, default="SadTalker", help="Path to SadTalker directory")
    parser.add_argument("--output-dir", type=str, default="realtime_results", help="Output directory")
    parser.add_argument("--voice", type=str, default="Samantha", help="macOS voice name")
    parser.add_argument("--rate", type=int, default=175, help="Speech rate")
    parser.add_argument("--quality", type=str, choices=["low", "medium", "high"], default="low", 
                        help="Quality of processing - affects speed")
    parser.add_argument("--host", type=str, default="localhost", help="WebSocket host")
    parser.add_argument("--port", type=int, default=8765, help="WebSocket port")
    parser.add_argument("--create-html", action="store_true", help="Create HTML test page and exit")
    
    args = parser.parse_args()
    
    # Create HTML page if requested
    if args.create_html:
        create_html_page()
        sys.exit(0)
    
    # Now check for required image argument for normal operation
    if not args.image:
        parser.error("--image is required unless using --create-html")
    
    # Check if source image exists
    if not os.path.exists(args.image):
        print(f"Error: Source image not found: {args.image}")
        sys.exit(1)
    
    # Create and start the WebSocket server
    avatar = WebSocketTalkingAvatar(
        source_image=args.image,
        sadtalker_path=args.sadtalker_path,
        output_dir=args.output_dir,
        voice=args.voice,
        rate=args.rate,
        quality=args.quality,
        host=args.host,
        port=args.port
    )
    
    print(f"Starting WebSocket talking avatar with:")
    print(f"  Source image: {args.image}")
    print(f"  Quality: {args.quality}")
    print(f"  Voice: {args.voice}")
    print(f"  Speech rate: {args.rate}")
    print(f"  Output directory: {args.output_dir}")
    print(f"  WebSocket: ws://{args.host}:{args.port}")
    
    # Start the avatar system
    avatar.start() 