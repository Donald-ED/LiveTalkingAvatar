#!/usr/bin/env python3
import os
import sys
import time
import subprocess
import threading
import tempfile
import queue
from datetime import datetime
import shutil
import pyttsx3

class TtsRealtimeTalkingAvatar:
    def __init__(self, 
                 source_image,
                 sadtalker_path="SadTalker",
                 output_dir="realtime_results",
                 voice_id=None,
                 speech_rate=175,
                 quality="low"):  # low, medium, high
        """
        Initialize a near real-time talking avatar processor using TTS
        
        Args:
            source_image (str): Path to source image
            sadtalker_path (str): Path to SadTalker directory
            output_dir (str): Directory to save output files
            voice_id (str): Voice ID for TTS
            speech_rate (int): Speech rate for TTS
            quality (str): Quality of processing - affects speed
        """
        self.source_image = os.path.abspath(source_image)
        self.sadtalker_path = os.path.abspath(sadtalker_path)
        self.output_dir = os.path.abspath(output_dir)
        self.voice_id = voice_id
        self.speech_rate = speech_rate
        self.quality = quality
        
        # Create output directory
        os.makedirs(self.output_dir, exist_ok=True)
        
        # For communicating between threads
        self.text_queue = queue.Queue()
        self.audio_queue = queue.Queue()
        self.video_queue = queue.Queue()
        self.running = False
        
        # Temporary directory for chunks
        self.temp_dir = tempfile.mkdtemp()
        print(f"Using temporary directory: {self.temp_dir}")
        
        # Initialize TTS engine
        self.engine = pyttsx3.init()
        if voice_id:
            self.engine.setProperty('voice', voice_id)
        self.engine.setProperty('rate', speech_rate)
        
        # Parameters for SadTalker based on quality
        self.sadtalker_params = self._get_quality_params(quality)
    
    def _get_quality_params(self, quality):
        """Get SadTalker parameters based on quality setting"""
        params = {
            "low": [
                "--still", 
                "--preprocess", "crop", 
                "--enhancer", "none"
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
    
    def list_available_voices(self):
        """List all available voices"""
        voices = self.engine.getProperty('voices')
        print(f"Found {len(voices)} voices:")
        for i, voice in enumerate(voices):
            print(f"{i+1}. ID: {voice.id}")
            print(f"   Name: {voice.name}")
            print(f"   Languages: {voice.languages}")
            print(f"   Gender: {voice.gender}")
            print()
        return voices
    
    def text_to_audio_file(self, text):
        """Convert text to an audio file using TTS"""
        if not text or text.strip() == "":
            return None
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(self.temp_dir, f"tts_chunk_{timestamp}.wav")
        
        # Create a new engine instance each time to avoid "run loop already started" error
        engine = pyttsx3.init()
        if self.voice_id:
            engine.setProperty('voice', self.voice_id)
        engine.setProperty('rate', self.speech_rate)
        
        # Save TTS output to file
        try:
            engine.save_to_file(text, output_file)
            engine.runAndWait()
            print(f"Generated TTS audio: {output_file}")
            return output_file
        except Exception as e:
            print(f"Error generating TTS audio: {e}")
            return None
    
    def process_audio_chunk(self, audio_file):
        """Process an audio chunk with SadTalker"""
        timestamp = os.path.basename(audio_file).split('.')[0]
        result_dir = os.path.join(self.temp_dir, timestamp)
        os.makedirs(result_dir, exist_ok=True)
        
        # Construct SadTalker command
        cmd = [
            "python", 
            os.path.join(self.sadtalker_path, "inference.py"),
            "--driven_audio", audio_file,
            "--source_image", self.source_image,
            "--result_dir", result_dir
        ] + self.sadtalker_params
        
        print(f"Processing chunk: {audio_file}")
        try:
            # Change to SadTalker directory
            current_dir = os.getcwd()
            os.chdir(self.sadtalker_path)
            
            subprocess.run(cmd, check=True, capture_output=True)
            
            # Change back to original directory
            os.chdir(current_dir)
            
            # Find the output video
            for root, dirs, files in os.walk(result_dir):
                for file in files:
                    if file.endswith('.mp4'):
                        video_path = os.path.join(root, file)
                        print(f"Generated video: {video_path}")
                        return video_path
            
            print(f"No video file found in {result_dir}")
            return None
        except subprocess.CalledProcessError as e:
            print(f"Error processing audio chunk: {e}")
            print(f"stdout: {e.stdout.decode('utf-8')}")
            print(f"stderr: {e.stderr.decode('utf-8')}")
            # Change back to original directory
            os.chdir(current_dir)
            return None
    
    def tts_generator_thread(self):
        """Thread for generating TTS audio from text"""
        print("Starting TTS generator thread...")
        while self.running:
            try:
                # Get text from queue with timeout
                text = self.text_queue.get(timeout=1)
                
                # Convert text to audio
                audio_file = self.text_to_audio_file(text)
                if audio_file:
                    self.audio_queue.put(audio_file)
                
                # Mark task as done
                self.text_queue.task_done()
            except queue.Empty:
                # Queue is empty, just continue
                pass
            except Exception as e:
                print(f"Error in TTS generator thread: {e}")
        print("TTS generator thread stopped")
    
    def processor_thread(self):
        """Thread for processing audio chunks"""
        print("Starting processor thread...")
        while self.running:
            try:
                # Get audio chunk from queue with timeout
                audio_file = self.audio_queue.get(timeout=1)
                
                # Process the chunk
                video_file = self.process_audio_chunk(audio_file)
                if video_file:
                    self.video_queue.put(video_file)
                
                # Mark task as done
                self.audio_queue.task_done()
            except queue.Empty:
                # Queue is empty, just continue
                pass
            except Exception as e:
                print(f"Error in processor thread: {e}")
        print("Processor thread stopped")
    
    def player_thread(self):
        """Thread for playing generated videos"""
        print("Starting player thread...")
        while self.running:
            try:
                # Get video file from queue with timeout
                video_file = self.video_queue.get(timeout=1)
                
                # Play the video (this will depend on your system)
                # For macOS:
                cmd = ["open", video_file]
                subprocess.run(cmd, check=True)
                
                # Copy to output directory
                output_file = os.path.join(self.output_dir, os.path.basename(video_file))
                shutil.copy2(video_file, output_file)
                print(f"Saved video to: {output_file}")
                
                # Mark task as done
                self.video_queue.task_done()
            except queue.Empty:
                # Queue is empty, just continue
                pass
            except Exception as e:
                print(f"Error in player thread: {e}")
        print("Player thread stopped")
    
    def start(self):
        """Start the real-time talking avatar system"""
        if self.running:
            print("Already running")
            return
        
        self.running = True
        
        # Start threads
        self.tts_generator = threading.Thread(target=self.tts_generator_thread)
        self.processor = threading.Thread(target=self.processor_thread)
        self.player = threading.Thread(target=self.player_thread)
        
        self.tts_generator.daemon = True
        self.processor.daemon = True
        self.player.daemon = True
        
        self.tts_generator.start()
        self.processor.start()
        self.player.start()
        
        print("Real-time talking avatar system started")
        print("Type text and press Enter to generate speech, or 'quit' to exit")
        
        try:
            # Interactive mode
            while True:
                text = input("> ")
                if text.lower() in ['quit', 'exit', 'q']:
                    break
                self.text_queue.put(text)
        except KeyboardInterrupt:
            print("\nStopping...")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the real-time talking avatar system"""
        self.running = False
        
        # Wait for threads to finish
        if hasattr(self, 'tts_generator') and self.tts_generator.is_alive():
            self.tts_generator.join(timeout=2)
        if hasattr(self, 'processor') and self.processor.is_alive():
            self.processor.join(timeout=2)
        if hasattr(self, 'player') and self.player.is_alive():
            self.player.join(timeout=2)
        
        # Clean up
        try:
            shutil.rmtree(self.temp_dir)
            print(f"Removed temporary directory: {self.temp_dir}")
        except Exception as e:
            print(f"Error removing temporary directory: {e}")
        
        print("Real-time talking avatar system stopped")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Real-time talking avatar system using TTS and SadTalker")
    parser.add_argument("--image", type=str, required=True, help="Path to source image")
    parser.add_argument("--sadtalker-path", type=str, default="SadTalker", help="Path to SadTalker directory")
    parser.add_argument("--output-dir", type=str, default="realtime_results", help="Output directory")
    parser.add_argument("--list-voices", action="store_true", help="List available TTS voices and exit")
    parser.add_argument("--voice-id", type=str, help="Voice ID for TTS")
    parser.add_argument("--speech-rate", type=int, default=175, help="Speech rate for TTS")
    parser.add_argument("--quality", type=str, choices=["low", "medium", "high"], default="low", 
                        help="Quality of processing - affects speed")
    
    args = parser.parse_args()
    
    # Create avatar instance
    avatar = TtsRealtimeTalkingAvatar(
        source_image=args.image,
        sadtalker_path=args.sadtalker_path,
        output_dir=args.output_dir,
        voice_id=args.voice_id,
        speech_rate=args.speech_rate,
        quality=args.quality
    )
    
    # List voices if requested
    if args.list_voices:
        avatar.list_available_voices()
        sys.exit(0)
    
    # Check if source image exists
    if not os.path.exists(args.image):
        print(f"Error: Source image not found: {args.image}")
        sys.exit(1)
    
    print(f"Starting real-time talking avatar with:")
    print(f"  Source image: {args.image}")
    print(f"  Quality: {args.quality}")
    print(f"  Speech rate: {args.speech_rate}")
    if args.voice_id:
        print(f"  Voice ID: {args.voice_id}")
    print(f"  Output directory: {args.output_dir}")
    
    # Start the avatar system
    avatar.start() 