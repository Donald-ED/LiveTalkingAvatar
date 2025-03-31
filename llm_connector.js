/**
 * LLM Connector - Handles communication with local LLM
 */

class LLMConnector {
  constructor() {
    this.apiUrl = 'http://localhost:8000/api/chat'; // Default Ollama API endpoint
    this.model = 'llama3'; // Default model
    this.messageHistory = [];
    this.isProcessing = false;
    this.onResponse = null;
  }

  /**
   * Configure the LLM connection
   * @param {string} apiUrl - The API URL
   * @param {string} model - The model name
   */
  configure(apiUrl, model) {
    if (apiUrl) this.apiUrl = apiUrl;
    if (model) this.model = model;
    
    console.log(`LLM Connector configured: API=${this.apiUrl}, Model=${this.model}`);
  }

  /**
   * Send a message to the LLM and get a response
   * @param {string} message - User message
   * @returns {Promise<string>} - LLM response
   */
  async sendMessage(message) {
    if (this.isProcessing) {
      console.warn('Already processing a message, please wait');
      return Promise.resolve("I'm still thinking about your last question. Please wait a moment.");
    }

    this.isProcessing = true;
    console.log(`Sending message to LLM: "${message}"`);
    
    // Add message to history
    this.messageHistory.push({
      role: 'user',
      content: message
    });
    
    try {
      // Set up fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // First try Ollama API format
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: this.messageHistory,
          stream: false
        }),
        signal: controller.signal
      });
      
      // Clear the timeout since we got a response
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`API returned status ${response.status}`);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      let responseText = '';
      
      console.log('Raw LLM response:', data);
      
      // Handle different API response formats
      if (data.message && data.message.content) {
        // Ollama API format
        responseText = data.message.content;
      } else if (data.response) {
        // Simple API format
        responseText = data.response;
      } else if (data.choices && data.choices.length > 0) {
        // OpenAI-like API format
        responseText = data.choices[0].message.content;
      } else if (typeof data === 'string') {
        // Plain text response
        responseText = data;
      } else {
        // Check any property that might contain the response
        for (const key in data) {
          if (typeof data[key] === 'string' && data[key].length > 10) {
            responseText = data[key];
            break;
          }
        }
        
        if (!responseText) {
          responseText = 'I received your message, but I\'m having trouble formulating a response.';
        }
      }
      
      // Add response to history
      this.messageHistory.push({
        role: 'assistant',
        content: responseText
      });
      
      console.log(`Received response from LLM: "${responseText}"`);
      
      // Call the onResponse callback if set
      if (this.onResponse && typeof this.onResponse === 'function') {
        this.onResponse(responseText);
      }
      
      this.isProcessing = false;
      return responseText;
      
    } catch (error) {
      console.error('Error communicating with LLM:', error);
      
      // Different responses based on error type
      let fallbackResponse;
      if (error.name === 'AbortError') {
        fallbackResponse = "I'm sorry, the request took too long to complete. Let me try a different approach.";
      } else if (error.message.includes('Failed to fetch')) {
        fallbackResponse = "I'm having trouble connecting to my knowledge base. Let me try a simpler response.";
      } else {
        fallbackResponse = "I understand your question, but I'm having some technical difficulties right now. Let me try again.";
      }
      
      // Add fallback response to history
      this.messageHistory.push({
        role: 'assistant',
        content: fallbackResponse
      });
      
      // Call the onResponse callback if set
      if (this.onResponse && typeof this.onResponse === 'function') {
        this.onResponse(fallbackResponse);
      }
      
      this.isProcessing = false;
      return fallbackResponse;
    }
  }
  
  /**
   * Clear the message history
   */
  clearHistory() {
    this.messageHistory = [];
    console.log('Message history cleared');
  }
  
  /**
   * Set callback for when a response is received
   * @param {Function} callback - Function to call with response
   */
  setResponseCallback(callback) {
    this.onResponse = callback;
  }
}

// Create a global instance
const llmConnector = new LLMConnector(); 