#!/usr/bin/env python3
import os
import sys
import argparse
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime

# Import audio_utils for text-to-speech functionality
try:
    from audio_utils import text_to_wav, list_available_voices
except ImportError:
    print("Warning: audio_utils module not found. Text-to-speech functionality will be limited.")
    
    def text_to_wav(text, output_path, voice_id=None, rate=175, volume=1.0):
        """Fallback function if audio_utils is not available"""
        print(f"Error: Cannot convert text to speech. Please install audio_utils module.")
        return None
    
    def list_available_voices():
        """Fallback function if audio_utils is not available"""
        print("Error: Cannot list available voices. Please install audio_utils module.")
        return []

def generate_talking_avatar(audio_file, image_file, output_dir=None, enhancer=True, 
                           pose_style=0, expression_scale=1.0, use_ref_video=None):
    """
    Generate a talking avatar video using SadTalker.
    
    Args:
        audio_file (str): Path to the audio file (.wav)
        image_file (str): Path to the source image file
        output_dir (str, optional): Directory to save the output video
        enhancer (bool): Whether to use face enhancer
        pose_style (int): Pose style (0 for still, 1-9 for different head movements)
        expression_scale (float): Expression scale factor
        use_ref_video (str, optional): Path to reference video for pose
    
    Returns:
        str: Path to the generated video file, or None if generation failed
    """
    # Check if required files exist
    if not os.path.exists(audio_file):
        print(f"Error: Audio file not found: {audio_file}")
        return None
    
    if not os.path.exists(image_file):
        print(f"Error: Image file not found: {image_file}")
        return None
    
    # Check if SadTalker directory exists
    sadtalker_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "SadTalker")
    if not os.path.exists(sadtalker_dir):
        print(f"Error: SadTalker directory not found at {sadtalker_dir}")
        print("Please run setup_sadtalker.sh first to set up SadTalker.")
        return None
    
    # Default output directory if not specified
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")
        os.makedirs(output_dir, exist_ok=True)
    
    # Build SadTalker command
    cmd = [
        "python", 
        os.path.join(sadtalker_dir, "inference.py"),
        "--driven_audio", audio_file,
        "--source_image", image_file,
        "--result_dir", output_dir,
        "--pose_style", str(pose_style),
        "--expression_scale", str(expression_scale)
    ]
    
    if enhancer:
        cmd.append("--enhancer")
        cmd.append("gfpgan")
    
    if use_ref_video:
        if os.path.exists(use_ref_video):
            cmd.extend(["--ref_pose", use_ref_video])
        else:
            print(f"Warning: Reference video not found: {use_ref_video}")
    
    print(f"Running SadTalker with command: {' '.join(cmd)}")
    
    # Change to SadTalker directory and run the command
    current_dir = os.getcwd()
    os.chdir(sadtalker_dir)
    
    try:
        result = subprocess.run(cmd, check=True, text=True, capture_output=True)
        print(result.stdout)
        if result.stderr:
            print(f"Warnings/Errors: {result.stderr}")
    except subprocess.CalledProcessError as e:
        print(f"Error running SadTalker: {e}")
        print(f"Output: {e.stdout}")
        print(f"Error: {e.stderr}")
        os.chdir(current_dir)
        return None
    
    # Change back to original directory
    os.chdir(current_dir)
    
    # Find the generated video file
    # SadTalker output follows the pattern: {result_dir}/{source_image_name}_{timestamp}/{source_image_name}###{driven_audio_name}.mp4
    image_name = os.path.splitext(os.path.basename(image_file))[0]
    for root, dirs, files in os.walk(output_dir):
        for file in files:
            if file.endswith(".mp4") and image_name in file:
                return os.path.join(root, file)
    
    print("Warning: Could not find generated video file.")
    return None

def generate_from_text(text, image_file, output_dir=None, voice_id=None, rate=175, 
                      volume=1.0, enhancer=True, pose_style=0, expression_scale=1.0):
    """
    Generate a talking avatar video from text using SadTalker.
    
    Args:
        text (str): Text to convert to speech
        image_file (str): Path to the source image file
        output_dir (str, optional): Directory to save the output video
        voice_id (str, optional): TTS voice ID to use
        rate (int): Speech rate
        volume (float): Speech volume
        enhancer (bool): Whether to use face enhancer
        pose_style (int): Pose style (0 for still, 1-9 for different head movements)
        expression_scale (float): Expression scale factor
    
    Returns:
        str: Path to the generated video file, or None if generation failed
    """
    # Create a temporary directory for the audio file
    with tempfile.TemporaryDirectory() as temp_dir:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        audio_file = os.path.join(temp_dir, f"speech_{timestamp}.wav")
        
        # Convert text to speech
        success = text_to_wav(text, audio_file, voice_id, rate, volume)
        if not success:
            print("Failed to generate speech from text.")
            return None
        
        # Generate talking avatar
        return generate_talking_avatar(
            audio_file=audio_file,
            image_file=image_file,
            output_dir=output_dir,
            enhancer=enhancer,
            pose_style=pose_style,
            expression_scale=expression_scale
        )

def main():
    parser = argparse.ArgumentParser(description="Generate talking avatar videos using SadTalker")
    
    # Input options
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--text", type=str, help="Text to convert to speech")
    input_group.add_argument("--audio", type=str, help="Path to audio file (.wav)")
    
    # Required arguments
    parser.add_argument("--image", type=str, required=True, help="Path to source image file")
    
    # Optional arguments
    parser.add_argument("--output-dir", type=str, help="Directory to save the output video")
    parser.add_argument("--voice-id", type=str, help="TTS voice ID to use (only with --text)")
    parser.add_argument("--list-voices", action="store_true", help="List available TTS voices and exit")
    parser.add_argument("--rate", type=int, default=175, help="Speech rate (only with --text)")
    parser.add_argument("--volume", type=float, default=1.0, help="Speech volume (only with --text)")
    parser.add_argument("--no-enhancer", action="store_true", help="Disable face enhancer")
    parser.add_argument("--pose-style", type=int, default=0, 
                       help="Pose style (0 for still, 1-9 for different head movements)")
    parser.add_argument("--expression-scale", type=float, default=1.0, help="Expression scale factor")
    parser.add_argument("--ref-video", type=str, help="Path to reference video for pose")
    
    args = parser.parse_args()
    
    # List available voices and exit
    if args.list_voices:
        voices = list_available_voices()
        print("Available TTS voices:")
        for voice in voices:
            print(f"  ID: {voice['id']}")
            print(f"  Name: {voice['name']}")
            print(f"  Language: {voice['language']}")
            print(f"  Gender: {voice['gender']}")
            print("")
        return 0
    
    output_video = None
    
    # Generate talking avatar from text
    if args.text:
        output_video = generate_from_text(
            text=args.text,
            image_file=args.image,
            output_dir=args.output_dir,
            voice_id=args.voice_id,
            rate=args.rate,
            volume=args.volume,
            enhancer=not args.no_enhancer,
            pose_style=args.pose_style,
            expression_scale=args.expression_scale
        )
    
    # Generate talking avatar from audio file
    elif args.audio:
        output_video = generate_talking_avatar(
            audio_file=args.audio,
            image_file=args.image,
            output_dir=args.output_dir,
            enhancer=not args.no_enhancer,
            pose_style=args.pose_style,
            expression_scale=args.expression_scale,
            use_ref_video=args.ref_video
        )
    
    if output_video:
        print(f"Success! Talking avatar video generated: {output_video}")
        return 0
    else:
        print("Failed to generate talking avatar video.")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 