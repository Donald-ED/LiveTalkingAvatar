#!/usr/bin/env python3
from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import time
import json
import os
import sys
import traceback

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
DEFAULT_RESPONSES = [
    "Hi there! How can I help you today?",
    "That's an interesting question. Let me think about that.",
    "I understand what you're asking. Here's my perspective...",
    "Thanks for sharing that with me. I appreciate your thoughts.",
    "I'd be happy to assist you with that request.",
    "I'm still learning, but I'll do my best to provide a helpful answer.",
    "Could you clarify what you mean by that?",
    "That's a great point! I hadn't considered that angle before.",
    "I'm not sure about that, but here's what I do know..."
]

try:
    # Try to import Ollama
    import ollama
    OLLAMA_AVAILABLE = True
    print("Ollama found, will use local LLM capability")
except ImportError:
    OLLAMA_AVAILABLE = False
    print("Ollama not found, will use simulated responses")

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        
        # Extract the user's message
        if 'messages' in data and len(data['messages']) > 0:
            user_message = data['messages'][-1]['content']
        elif 'message' in data:
            user_message = data['message']
        else:
            return jsonify({"error": "No message found in request"}), 400
        
        model_name = data.get('model', 'llama3')
        
        print(f"\nReceived request for model '{model_name}'")
        print(f"User message: '{user_message}'")
        
        # Try to use Ollama if available
        if OLLAMA_AVAILABLE:
            try:
                print(f"Calling Ollama with model: {model_name}")
                ollama_response = ollama.chat(
                    model=model_name,
                    messages=data['messages'] if 'messages' in data else [{"role": "user", "content": user_message}]
                )
                
                # Convert Ollama response object to a serializable dictionary
                response = {
                    "model": model_name,
                    "message": {
                        "role": "assistant", 
                        "content": ollama_response['message']['content']
                    },
                    "done": True
                }
                
                print(f"LLM response: '{response['message']['content'][:100]}...'")
                return jsonify(response)
            except Exception as e:
                print(f"Error using Ollama: {e}")
                traceback.print_exc()
                # Fall back to simulated response
        
        # Simulate thinking time
        time.sleep(1)
        
        # Generate a simulated response
        response = DEFAULT_RESPONSES[random.randint(0, len(DEFAULT_RESPONSES)-1)]
        
        # Make it more personalized
        if "name" in user_message.lower():
            response = "My name is AI Assistant. I'm here to help you with any questions or tasks."
        
        if "how are you" in user_message.lower():
            response = "I'm doing well, thanks for asking! I'm ready to assist you today."
        
        if "hello" in user_message.lower() or "hi" in user_message.lower():
            response = "Hello! It's great to meet you. How can I assist you today?"
        
        print(f"Simulated response: '{response}'")
        
        # Return in Ollama format
        return jsonify({
            "model": model_name,
            "message": {"role": "assistant", "content": response},
            "done": True
        })
        
    except Exception as e:
        print(f"Error processing request: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/models', methods=['GET'])
def models():
    if OLLAMA_AVAILABLE:
        try:
            models_list = ollama.list()
            return jsonify(models_list)
        except Exception as e:
            print(f"Error listing models: {e}")
    
    # Return fake models if Ollama not available
    return jsonify({
        "models": [
            {"name": "llama3"},
            {"name": "mistral"},
            {"name": "gemma"}
        ]
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    print(f"Starting local LLM server on port {port}")
    print(f"API endpoint available at: http://localhost:{port}/api/chat")
    app.run(host='0.0.0.0', port=port, debug=True) 