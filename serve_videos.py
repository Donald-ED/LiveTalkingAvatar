#!/usr/bin/env python3
import http.server
import socketserver
import os
import argparse

def run_server(directory=".", port=8000):
    """Run a simple HTTP server to serve files"""
    # Change to the specified directory
    os.chdir(directory)
    
    # Set up the HTTP server
    handler = http.server.SimpleHTTPRequestHandler
    
    # Create the server
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Serving files from {os.path.abspath(directory)} at http://localhost:{port}")
        print("Press Ctrl+C to stop")
        
        # Serve until interrupted
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run a simple HTTP server to serve files")
    parser.add_argument("--directory", "-d", type=str, default=".", 
                        help="Directory to serve files from (default: current directory)")
    parser.add_argument("--port", "-p", type=int, default=8000, 
                        help="Port to run the server on (default: 8000)")
    
    args = parser.parse_args()
    
    run_server(args.directory, args.port) 