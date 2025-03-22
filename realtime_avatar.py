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

class RealtimeTalkingAvatar:
    def __init__(self, 
                 source_image,
                 sadtalker_path="SadTalker",
                 output_dir="realtime_results",
                 chunk_duration=3,  # seconds per chunk
                 quality="low"):  # low, medium, high
        """
        Initialize a near real-time talking avatar processor
        
        Args:
            source_image (str): Path to source image
            sadtalker_path (str): Path to SadTalker directory
            output_dir (str): Directory to save output files
            chunk_duration (int): Duration of each audio chunk in seconds
            quality (str): Quality of processing - affects speed
        """
        self.source_image = os.path.abspath(source_image)
        self.sadtalker_path = os.path.abspath(sadtalker_path)
        self.output_dir = os.path.abspath(output_dir)
        self.chunk_duration = chunk_duration
        self.quality = quality
        
        # Create output directory
        os.makedirs(self.output_dir, exist_ok=True)
        
        # For communicating between threads
        self.audio_queue = queue.Queue()
        self.video_queue = queue.Queue()
        self.running = False
        
        # Temporary directory for chunks
        self.temp_dir = tempfile.mkdtemp()
        print(f"Using temporary directory: {self.temp_dir}")
        
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
    
    def record_audio_chunk(self, duration=3, output_file=None):
        """Record an audio chunk using the system microphone"""
        if output_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = os.path.join(self.temp_dir, f"audio_chunk_{timestamp}.wav")
        
        # Using macOS' built-in audio recording
        cmd = ["rec", "-r", "16000", "-c", "1", output_file, "trim", "0", str(duration)]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            print(f"Recorded audio chunk: {output_file}")
            return output_file
        except subprocess.CalledProcessError as e:
            print(f"Error recording audio: {e}")
            return None
        except FileNotFoundError:
            print("Error: 'rec' command not found. Please install SoX: brew install sox")
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
    
    def audio_recorder_thread(self):
        """Thread for recording audio chunks"""
        print("Starting audio recorder thread...")
        while self.running:
            # Record audio chunk
            chunk_file = self.record_audio_chunk(duration=self.chunk_duration)
            if chunk_file:
                self.audio_queue.put(chunk_file)
            time.sleep(0.1)  # Small sleep to reduce CPU usage
        print("Audio recorder thread stopped")
    
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
        self.recorder = threading.Thread(target=self.audio_recorder_thread)
        self.processor = threading.Thread(target=self.processor_thread)
        self.player = threading.Thread(target=self.player_thread)
        
        self.recorder.daemon = True
        self.processor.daemon = True
        self.player.daemon = True
        
        self.recorder.start()
        self.processor.start()
        self.player.start()
        
        print("Real-time talking avatar system started")
        
        try:
            # Keep the main thread running
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("Stopping...")
            self.stop()
    
    def stop(self):
        """Stop the real-time talking avatar system"""
        self.running = False
        
        # Wait for threads to finish
        if hasattr(self, 'recorder') and self.recorder.is_alive():
            self.recorder.join(timeout=2)
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
    
    parser = argparse.ArgumentParser(description="Real-time talking avatar system using SadTalker")
    parser.add_argument("--image", type=str, required=True, help="Path to source image")
    parser.add_argument("--sadtalker-path", type=str, default="SadTalker", help="Path to SadTalker directory")
    parser.add_argument("--output-dir", type=str, default="realtime_results", help="Output directory")
    parser.add_argument("--chunk-duration", type=int, default=3, help="Duration of each audio chunk in seconds")
    parser.add_argument("--quality", type=str, choices=["low", "medium", "high"], default="low", 
                        help="Quality of processing - affects speed")
    
    args = parser.parse_args()
    
    # Check if source image exists
    if not os.path.exists(args.image):
        print(f"Error: Source image not found: {args.image}")
        sys.exit(1)
    
    # Create and start the real-time talking avatar system
    avatar = RealtimeTalkingAvatar(
        source_image=args.image,
        sadtalker_path=args.sadtalker_path,
        output_dir=args.output_dir,
        chunk_duration=args.chunk_duration,
        quality=args.quality
    )
    
    print(f"Starting real-time talking avatar with:")
    print(f"  Source image: {args.image}")
    print(f"  Quality: {args.quality}")
    print(f"  Chunk duration: {args.chunk_duration} seconds")
    print(f"  Output directory: {args.output_dir}")
    print("Press Ctrl+C to stop")
    
    avatar.start() 