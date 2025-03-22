#!/usr/bin/env python3
import pyttsx3
import time
import multiprocessing
from multiprocessing import Process, Queue
import os
import signal
from typing import List, Optional

class TTSEngine:
    """
    Text-to-Speech engine that supports real-time audio generation and playback.
    Uses multiprocessing to completely isolate the pyttsx3 engine.
    """
    
    def __init__(self, voice_id: Optional[str] = None, rate: int = 175, volume: float = 1.0):
        """
        Initialize the TTS engine with specified parameters.
        
        Args:
            voice_id: Optional voice identifier (use list_voices() to see available voices)
            rate: Speech rate (words per minute)
            volume: Volume level (0.0 to 1.0)
        """
        # Store settings for the TTS process
        self.voice_id = voice_id
        self.rate = rate
        self.volume = volume
        
        # Set up multiprocessing communication
        self.speech_queue = Queue()
        self.control_queue = Queue()
        self.result_queue = Queue()
        
        # Status flags
        self.is_speaking = False
        self.process_running = False
        
        # Start the TTS process
        self._start_tts_process()
        
        # Get the default voice and available voices
        self._populate_voices()
    
    def _populate_voices(self):
        """Request voices from the TTS process"""
        # Request the list of voices
        self.control_queue.put(("list_voices", None))
        
        # Wait for response
        self.voices = self.result_queue.get(timeout=5)
        
        # Get the default voice
        self.current_voice = self.voice_id or self.voices[0]['id'] if self.voices else None
    
    def _start_tts_process(self):
        """Start the TTS process"""
        if not self.process_running:
            self.tts_process = Process(
                target=self._tts_process_main,
                args=(self.speech_queue, self.control_queue, self.result_queue, 
                      self.voice_id, self.rate, self.volume),
                daemon=True
            )
            self.tts_process.start()
            self.process_running = True
    
    @staticmethod
    def _tts_process_main(speech_queue, control_queue, result_queue, voice_id, rate, volume):
        """
        Main function for the TTS process.
        Runs in a separate process to isolate the pyttsx3 engine.
        """
        # Import queue.Empty here to properly catch it
        from queue import Empty
        
        # Initialize pyttsx3 in this process
        engine = pyttsx3.init()
        
        # Configure the engine
        engine.setProperty('rate', rate)
        engine.setProperty('volume', volume)
        
        # Set voice if specified
        if voice_id:
            engine.setProperty('voice', voice_id)
        
        # Function to get all voices
        def get_voices():
            voices = []
            for voice in engine.getProperty('voices'):
                voices.append({
                    'id': voice.id,
                    'name': voice.name,
                    'languages': voice.languages,
                    'gender': voice.gender
                })
            return voices
        
        # Handle termination gracefully
        def handle_signal(signum, frame):
            exit(0)
        
        signal.signal(signal.SIGTERM, handle_signal)
        
        # Process loop
        try:
            while True:
                # Check for control commands first with a timeout
                try:
                    cmd, data = control_queue.get(block=False)
                    
                    if cmd == "stop":
                        break
                    elif cmd == "list_voices":
                        result_queue.put(get_voices())
                    elif cmd == "adjust_settings":
                        rate, volume, voice_id = data
                        if rate is not None:
                            engine.setProperty('rate', rate)
                        if volume is not None:
                            engine.setProperty('volume', volume)
                        if voice_id is not None:
                            engine.setProperty('voice', voice_id)
                except Empty:
                    # No control commands, continue silently
                    pass
                except Exception as e:
                    # Other exceptions, not queue empty
                    print(f"TTS control error: {str(e)}")
                
                # Check for text to speak
                try:
                    text = speech_queue.get(timeout=0.1)
                    if text:
                        engine.say(text)
                        engine.runAndWait()
                except Empty:
                    # No text to speak, just continue silently
                    pass
                except Exception as e:
                    # Only print other errors, not Empty exceptions
                    print(f"TTS speak error: {str(e)}")
                    time.sleep(0.1)
                    
                # Brief sleep to prevent tight CPU loop
                time.sleep(0.01)
        
        except KeyboardInterrupt:
            # Clean exit on CTRL+C
            pass
        except Exception as e:
            print(f"TTS process error: {str(e)}")
        finally:
            # Make sure we exit cleanly
            pass
    
    def list_voices(self) -> List[dict]:
        """
        List all available voices.
        
        Returns:
            List of dictionaries with voice information
        """
        return self.voices if hasattr(self, 'voices') else []
    
    def get_default_voice(self) -> str:
        """Get the default voice ID"""
        return self.current_voice
    
    def speak(self, text: str) -> None:
        """
        Queue text to be spoken.
        
        Args:
            text: The text to speak
        """
        if not text or not text.strip():
            return
        
        # Add text to the speech queue
        self.speech_queue.put(text.strip())
        self.is_speaking = True
    
    def speak_streaming(self, text: str, chunk_size: int = 150) -> None:
        """
        Speak text in a streaming fashion by breaking it into chunks.
        
        Args:
            text: The text to speak
            chunk_size: Maximum number of characters per chunk
        """
        if not text or not text.strip():
            return
            
        # Break text into chunks (at sentence boundaries)
        chunks = self._chunk_text(text, chunk_size)
        
        # Process each chunk
        for chunk in chunks:
            if chunk and chunk.strip():
                self.speak(chunk.strip())
    
    def _chunk_text(self, text: str, chunk_size: int) -> List[str]:
        """
        Break text into chunks, trying to break at sentence boundaries.
        
        Args:
            text: The text to chunk
            chunk_size: Maximum chunk size in characters
            
        Returns:
            List of text chunks
        """
        # First try to split by sentences
        sentences = []
        for sentence in text.replace('!', '.').replace('?', '.').split('.'):
            if sentence.strip():
                sentences.append(sentence.strip() + '.')
        
        # Then combine sentences into chunks of appropriate size
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            # If adding this sentence would exceed the chunk size, 
            # finalize the current chunk and start a new one
            if len(current_chunk) + len(sentence) > chunk_size and current_chunk:
                chunks.append(current_chunk)
                current_chunk = sentence
            else:
                current_chunk += " " + sentence if current_chunk else sentence
        
        # Add the last chunk if there's anything left
        if current_chunk:
            chunks.append(current_chunk)
            
        return chunks
    
    def adjust_settings(self, rate: Optional[int] = None, volume: Optional[float] = None, 
                       voice_id: Optional[str] = None) -> None:
        """
        Adjust TTS settings.
        
        Args:
            rate: Speech rate (words per minute)
            volume: Volume level (0.0 to 1.0)
            voice_id: Voice identifier
        """
        # Update our local settings
        if rate is not None:
            self.rate = rate
        
        if volume is not None:
            self.volume = volume
        
        if voice_id is not None:
            self.voice_id = voice_id
            self.current_voice = voice_id
        
        # Send the settings to the TTS process
        self.control_queue.put(("adjust_settings", (rate, volume, voice_id)))
    
    def stop(self):
        """Stop the TTS engine and clean up resources"""
        # Tell the process to stop
        if self.process_running:
            self.control_queue.put(("stop", None))
            
            # Wait briefly for the process to clean up
            self.tts_process.join(timeout=2.0)
            
            # If it's still running, terminate it
            if self.tts_process.is_alive():
                self.tts_process.terminate()
                self.tts_process.join(timeout=1.0)
            
            self.process_running = False

# Example usage
if __name__ == "__main__":
    # Set up multiprocessing for macOS
    multiprocessing.set_start_method('spawn')
    
    # Create a TTS engine
    tts = TTSEngine()
    
    # List available voices
    print("Available voices:")
    for voice in tts.list_voices():
        print(f"ID: {voice['id']}")
        print(f"Name: {voice['name']}")
        print(f"Gender: {voice['gender']}")
        print("---")
    
    # Test streaming speech
    test_text = "This is a test of real-time streaming text to speech. "
    test_text += "The system breaks text into chunks and processes them sequentially. "
    test_text += "This allows for a more natural conversational flow."
    
    print("\nStreaming TTS test:")
    tts.speak_streaming(test_text)
    
    # Allow time for speech to complete
    time.sleep(10)
    
    # Clean up
    tts.stop()
    
    print("\nTest complete.") 