#!/usr/bin/env python3
import os
import subprocess
import time

def create_test_audio(text, output_file, voice="Samantha"):
    """Create a test audio file using the macOS 'say' command"""
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    
    # Use macOS 'say' command to create audio file in AIFF format
    aiff_file = output_file.replace(".wav", ".aiff")
    say_cmd = ["say", "-v", voice, "-o", aiff_file, text]
    
    try:
        subprocess.run(say_cmd, check=True)
        print(f"AIFF audio file created at: {aiff_file}")
        
        # Convert AIFF to WAV using ffmpeg
        if os.path.exists("/opt/homebrew/bin/ffmpeg") or os.path.exists("/usr/local/bin/ffmpeg") or os.path.exists("/usr/bin/ffmpeg"):
            ffmpeg_cmd = ["ffmpeg", "-i", aiff_file, "-y", output_file]
            subprocess.run(ffmpeg_cmd, check=True)
            print(f"Converted to WAV file: {output_file}")
            
            # Remove the temporary AIFF file
            os.remove(aiff_file)
            return True
        else:
            print("Warning: ffmpeg not found. Keeping AIFF file.")
            return False
            
    except subprocess.CalledProcessError as e:
        print(f"Error creating audio file: {e}")
        return False

if __name__ == "__main__":
    # Create a test audio file
    output_dir = "audio_samples"
    os.makedirs(output_dir, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(output_dir, f"test_audio_{timestamp}.wav")
    
    text = "Hello, I am a talking avatar created with SadTalker. This is a demonstration of how the system works."
    
    if create_test_audio(text, output_file):
        print("Now you can use this audio file with the generate_talking_avatar.py script:")
        print(f"python generate_talking_avatar.py --audio {output_file} --image sample_images/sample_face.jpg")
    else:
        print("Failed to create test audio file. If you have an AIFF file, you can convert it to WAV manually using ffmpeg.") 