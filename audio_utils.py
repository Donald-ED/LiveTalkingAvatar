#!/usr/bin/env python3
import os
import time
from typing import Optional
import pyttsx3

def text_to_wav(text: str, output_path: str, voice_id: Optional[str] = None, 
               rate: int = 175, volume: float = 1.0) -> bool:
    """
    Convert text to speech and save as a WAV file
    
    Args:
        text (str): The text to convert to speech
        output_path (str): Path where the WAV file will be saved
        voice_id (str, optional): ID of the voice to use
        rate (int): Speech rate (words per minute)
        volume (float): Volume (0.0 to 1.0)
        
    Returns:
        bool: True if conversion was successful, False otherwise
    """
    try:
        # Initialize the TTS engine
        engine = pyttsx3.init()
        
        # Set properties
        engine.setProperty('rate', rate)
        engine.setProperty('volume', volume)
        
        # Set voice if specified
        if voice_id:
            voices = engine.getProperty('voices')
            for voice in voices:
                if voice.id == voice_id:
                    engine.setProperty('voice', voice.id)
                    break
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        
        # Save to file
        engine.save_to_file(text, output_path)
        engine.runAndWait()
        
        # Verify file was created
        if os.path.exists(output_path):
            return True
        return False
    except Exception as e:
        print(f"Error converting text to speech: {str(e)}")
        return False

def list_available_voices():
    """
    List all available TTS voices
    
    Returns:
        list: List of dictionaries containing voice information
    """
    engine = pyttsx3.init()
    voices = engine.getProperty('voices')
    
    voice_list = []
    for voice in voices:
        voice_info = {
            'id': voice.id,
            'name': voice.name,
            'language': voice.languages[0] if voice.languages else 'Unknown',
            'gender': voice.gender
        }
        voice_list.append(voice_info)
    
    return voice_list

# Example usage:
if __name__ == "__main__":
    # Generate a unique filename based on timestamp
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    output_dir = "audio_samples"
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, f"sample_{timestamp}.wav")
    
    # Convert text to speech
    text = "Hello, this is a test of the text to speech conversion utility."
    result = text_to_wav(text, output_file)
    
    if result:
        print(f"Successfully converted text to speech. File saved to: {output_file}")
    else:
        print("Failed to convert text to speech.")
    
    # List available voices
    voices = list_available_voices()
    print(f"\nAvailable voices ({len(voices)}):")
    for voice in voices:
        print(f"ID: {voice['id']}")
        print(f"Name: {voice['name']}")
        print(f"Language: {voice['language']}")
        print(f"Gender: {voice['gender']}")
        print("") 