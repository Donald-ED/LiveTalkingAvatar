#!/usr/bin/env python3
import os
import sys
import argparse
import time
import threading
import multiprocessing
from queue import Queue
import traceback

# TTS import
try:
    from tts import TTSEngine
    TTS_AVAILABLE = True
except ImportError:
    TTS_AVAILABLE = False

def setup_model(model_name):
    """
    Set up the language model for chat.
    Downloads the model if needed.
    
    Args:
        model_name: Name or path of the model to use
        
    Returns:
        The model and tokenizer objects
    """
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer
        import torch
        
        print(f"Loading model: {model_name}")
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # Try to use GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {device}")
        
        # Load model with appropriate settings based on device
        if device == "cuda":
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                device_map="auto"
            )
        else:
            # For CPU, try 8-bit quantization if available
            try:
                import bitsandbytes
                model = AutoModelForCausalLM.from_pretrained(
                    model_name,
                    load_in_8bit=True,
                    device_map="auto"
                )
                print("Using 8-bit quantization")
            except Exception as e:
                print(f"8-bit quantization failed: {e}")
                # Fall back to regular loading
                model = AutoModelForCausalLM.from_pretrained(model_name)
                print("Using standard model loading")
        
        return model, tokenizer
    
    except Exception as e:
        print(f"Error loading model: {e}")
        sys.exit(1)

def format_prompt(message, history=None):
    """
    Format the user message and conversation history as a prompt for the model.
    
    Args:
        message: The current user message
        history: List of previous message pairs [(user_msg, assistant_msg), ...]
        
    Returns:
        The formatted prompt string
    """
    # Improved prompt format that works better with most models
    prompt = "This is a conversation with an AI assistant. The assistant gives helpful, detailed responses without adding any labels like 'Human:' or 'User:' at the beginning or end of its replies.\n\n"
    
    # Add conversation history if provided
    if history:
        for user_msg, assistant_msg in history:
            prompt += f"User: {user_msg}\n{assistant_msg}\n\n"
    
    # Add the current message - use "User:" without an "Assistant:" label
    prompt += f"User: {message}\n"
    
    return prompt

def generate_response(model, tokenizer, prompt, stream=True, tts_engine=None, tts_chunk_size=150):
    """
    Generate a response from the model for the given prompt.
    
    Args:
        model: The language model
        tokenizer: The tokenizer
        prompt: The formatted prompt string
        stream: Whether to stream the output token by token
        tts_engine: Optional TTSEngine instance for speech output
        tts_chunk_size: Character limit for TTS chunking
        
    Returns:
        The generated response
    """
    import torch
    from transformers import TextIteratorStreamer
    from threading import Thread
    
    # Tokenize the prompt
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    
    # Set generation parameters (improved for better responses)
    gen_kwargs = {
        "max_new_tokens": 500,
        "temperature": 0.8,
        "top_p": 0.95,
        "top_k": 50,
        "do_sample": True,
        "repetition_penalty": 1.1
    }
    
    # Add a newline before response
    print()
    
    if stream:
        # Use the streamer for token-by-token generation
        streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)
        gen_kwargs["streamer"] = streamer
        
        # Start a separate thread to generate text
        thread = Thread(target=model.generate, kwargs={**gen_kwargs, **inputs})
        thread.start()
        
        # Prepare for TTS
        tts_buffer = ""
        
        # Collect the generated text
        generated_text = ""
        for text in streamer:
            print(text, end="", flush=True)
            generated_text += text
            
            # Accumulate text for TTS
            if tts_engine:
                tts_buffer += text
                
                # Check if we have a complete sentence or reached the chunk size
                # Improved sentence detection with more sophisticated buffering
                if has_sentence_end(tts_buffer) and len(tts_buffer) > 20:
                    # Get a clean sentence break
                    sentence, remaining = extract_complete_sentence(tts_buffer)
                    
                    # Only speak if we have a complete sentence
                    if sentence:
                        # Queue the sentence for speaking
                        tts_engine.speak(sentence)
                        
                    # Keep any remaining text in the buffer
                    tts_buffer = remaining
                    
                # Also check for chunk size threshold
                elif len(tts_buffer) >= tts_chunk_size:
                    # Clean up the buffer for speaking
                    clean_buffer = tts_buffer.strip()
                    tts_buffer = ""
                    
                    # Speak the buffer if it's not empty
                    if clean_buffer:
                        tts_engine.speak(clean_buffer)
            
            # Stop if we generate text that indicates the end of the assistant's turn
            # Check for various forms of user markers
            markers = ["\nUser:", "\nHuman:", "User:", "Human:", "\nuser", "\nhuman", "\n>"]
            if any(marker in generated_text for marker in markers):
                # Find where the next user turn starts
                end_pos = len(generated_text)
                for marker in markers:
                    pos = generated_text.find(marker)
                    if pos > 0 and pos < end_pos:
                        end_pos = pos
                
                # Truncate the text
                generated_text = generated_text[:end_pos].strip()
                break
        
        # Speak any remaining text
        if tts_engine and tts_buffer:
            tts_engine.speak(tts_buffer.strip())
        
        # Add a final newline
        print("\n")
        
        # Clean up any user markers that might have been generated
        clean_response = clean_model_response(generated_text)
        return clean_response
    else:
        # Generate the full response at once
        with torch.no_grad():
            output = model.generate(**inputs, **gen_kwargs)
        
        # Decode the generated text
        generated_text = tokenizer.decode(output[0], skip_special_tokens=True)
        
        # Extract only the assistant's response
        try:
            # Remove the prompt from the beginning
            response = generated_text[len(tokenizer.decode(inputs["input_ids"][0], skip_special_tokens=True)):]
            
            # Find where the next user turn starts
            markers = ["\nUser:", "\nHuman:", "User:", "Human:", "\nuser", "\nhuman", "\n>"]
            end_pos = len(response)
            for marker in markers:
                pos = response.find(marker)
                if pos > 0 and pos < end_pos:
                    end_pos = pos
            
            # Truncate the response
            response = response[:end_pos].strip()
                
            # Clean the response
            clean_response = clean_model_response(response)
            
            print(clean_response.strip())
            print()
            
            # Speak the response if TTS is enabled
            if tts_engine:
                tts_engine.speak_streaming(clean_response.strip(), tts_chunk_size)
                
            return clean_response.strip()
        except Exception as e:
            print(f"Error processing response: {e}")
            return generated_text

def clean_model_response(text):
    """
    Clean up model responses to remove any unwanted prefixes or artifacts
    
    Args:
        text: The model-generated text to clean
        
    Returns:
        The cleaned text
    """
    # Remove any labels that might have been generated
    unwanted_texts = [
        "User:", "Human:", "USER:", "HUMAN:", 
        "Assistant:", "ASSISTANT:", "Assistant", "AI:", "AI Assistant:",
        "> "
    ]
    
    # Clean up lines one by one
    lines = text.split('\n')
    cleaned_lines = []
    
    for line in lines:
        cleaned_line = line
        
        # Check for unwanted text at the beginning of the line
        for prefix in unwanted_texts:
            if line.strip().startswith(prefix):
                # Extract the part after the prefix
                cleaned_line = line.split(prefix, 1)[1].strip()
        
        # Check for unwanted text at the end of the line
        for suffix in ["Human:", "User:"]:
            if cleaned_line.strip().endswith(suffix):
                # Remove the suffix
                cleaned_line = cleaned_line.strip()[:-len(suffix)].strip()
        
        cleaned_lines.append(cleaned_line)
    
    # Rejoin the lines
    cleaned_text = '\n'.join(cleaned_lines)
    
    return cleaned_text

def has_sentence_end(text):
    """Check if text contains a sentence ending"""
    for marker in ['.', '!', '?', ':', ';', '\n']:
        if marker in text:
            return True
    return False

def extract_complete_sentence(text):
    """Extract a complete sentence from text, returning sentence and remaining text"""
    # Find the last sentence ending
    last_ending = -1
    for marker in ['.', '!', '?']:
        pos = text.rfind(marker)
        if pos > last_ending:
            last_ending = pos
    
    # If we found a sentence ending
    if last_ending >= 0:
        # Include the ending marker
        sentence = text[:last_ending+1].strip()
        remaining = text[last_ending+1:].strip()
        return sentence, remaining
    
    # No complete sentence yet
    return "", text

def main():
    # Initialize multiprocessing properly for macOS
    if sys.platform == 'darwin':
        multiprocessing.set_start_method('spawn')
    
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Simple LLM Chat Interface with TTS")
    parser.add_argument("--model", default="TinyLlama/TinyLlama-1.1B-Chat-v1.0", 
                      help="Model name or path (default: TinyLlama/TinyLlama-1.1B-Chat-v1.0)")
    parser.add_argument("--no-stream", action="store_true", 
                      help="Disable streaming of responses")
    parser.add_argument("--no-tts", action="store_true",
                      help="Disable text-to-speech")
    parser.add_argument("--tts-voice", type=str, 
                      help="Voice ID for TTS (use 'list' to show available voices)")
    parser.add_argument("--tts-rate", type=int, default=175,
                      help="Speech rate for TTS (words per minute, default: 175)")
    parser.add_argument("--tts-volume", type=float, default=1.0,
                      help="Volume for TTS (0.0-1.0, default: 1.0)")
    parser.add_argument("--tts-chunk-size", type=int, default=150,
                      help="Character chunk size for streaming TTS (default: 150)")
    args = parser.parse_args()
    
    # Check if TTS was requested but not available
    if not args.no_tts and not TTS_AVAILABLE:
        print("Warning: TTS requested but not available. Install the required dependencies.")
        args.no_tts = True
    
    # Initialize TTS engine if enabled
    tts_engine = None
    if not args.no_tts and TTS_AVAILABLE:
        try:
            # Create a new TTSEngine for each session
            tts_engine = TTSEngine(
                voice_id=args.tts_voice if args.tts_voice and args.tts_voice != "list" else None,
                rate=args.tts_rate,
                volume=args.tts_volume
            )
            
            # Handle voice listing
            if args.tts_voice == "list":
                print("\nAvailable TTS voices:")
                for voice in tts_engine.list_voices():
                    print(f"ID: {voice['id']}")
                    print(f"Name: {voice['name']}")
                    print(f"Gender: {voice['gender']}")
                    print("---")
                # Clean up TTS resources before exiting
                tts_engine.stop()
                sys.exit(0)
                
            print("TTS enabled.")
        except Exception as e:
            print(f"Error initializing TTS: {e}")
            traceback.print_exc()
            tts_engine = None
            args.no_tts = True
    
    # Load the model
    model, tokenizer = setup_model(args.model)
    
    # Track conversation history
    history = []
    
    print("\n💬 Chat Interface with Real-Time Text-to-Speech")
    print("Type 'quit', 'exit', or 'q' to end the conversation")
    
    try:
        # Main conversation loop
        while True:
            # Get user input
            user_message = input("\n> ")
            
            # Check if user wants to quit
            if user_message.lower() in ["quit", "exit", "q"]:
                break
            
            # Skip empty messages
            if not user_message.strip():
                continue
            
            # Format the prompt with conversation history
            prompt = format_prompt(user_message, history)
            
            # Generate and print response
            try:
                response = generate_response(
                    model, 
                    tokenizer, 
                    prompt, 
                    not args.no_stream,
                    tts_engine=tts_engine,
                    tts_chunk_size=args.tts_chunk_size
                )
                
                # Add to conversation history
                history.append((user_message, response))
                
                # Limit history length to prevent context overflow
                if len(history) > 10:
                    history = history[-10:]
            except Exception as e:
                print(f"Error generating response: {e}")
                traceback.print_exc()
    
    except KeyboardInterrupt:
        print("\nExiting chat...")
    
    finally:
        # Clean up TTS resources
        if tts_engine:
            print("Cleaning up TTS resources...")
            tts_engine.stop()
            print("TTS resources cleaned up.")

if __name__ == "__main__":
    main() 