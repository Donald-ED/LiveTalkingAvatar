/**
 * Speech Recognition Handler
 * Uses the Web Speech API to convert speech to text
 */

class SpeechRecognitionHandler {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.continuous = false;
    this.interimResults = true;
    this.onResultCallback = null;
    this.onEndCallback = null;
    this.language = 'en-US';
    
    // Don't initialize in constructor, wait for init call
  }
  
  /**
   * Initialize speech recognition
   * @param {Object} config - Configuration options
   */
  init(config = {}) {
    // Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported in this browser');
      return;
    }
    
    // Apply configuration
    if (config.language) this.language = config.language;
    if (config.continuous !== undefined) this.continuous = config.continuous;
    if (config.interimResults !== undefined) this.interimResults = config.interimResults;
    if (config.onResult) this.onResultCallback = config.onResult;
    if (config.onEnd) this.onEndCallback = config.onEnd;
    
    // Initialize recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // Configure recognition
    this.recognition.continuous = this.continuous;
    this.recognition.interimResults = this.interimResults;
    this.recognition.lang = this.language;
    
    // Set up event handlers
    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
    };
    
    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isListening = false;
      
      // Call the onEnd callback if set
      if (this.onEndCallback && typeof this.onEndCallback === 'function') {
        this.onEndCallback();
      }
    };
    
    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      // Process results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      console.log(`Speech recognized: "${finalTranscript || interimTranscript}"`);
      
      // Call the onResult callback if set
      if (this.onResultCallback && typeof this.onResultCallback === 'function') {
        this.onResultCallback(finalTranscript || interimTranscript, finalTranscript !== '');
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // End the recognition session on error
      this.isListening = false;
      if (this.onEndCallback && typeof this.onEndCallback === 'function') {
        this.onEndCallback();
      }
    };
    
    console.log('Speech recognition initialized', {
      language: this.language,
      continuous: this.continuous,
      interimResults: this.interimResults
    });
  }
  
  /**
   * Start speech recognition
   */
  start() {
    if (!this.recognition) {
      console.error('Speech recognition not initialized');
      return;
    }
    
    if (this.isListening) {
      console.warn('Speech recognition already active');
      return;
    }
    
    try {
      this.recognition.start();
      console.log('Starting speech recognition');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  }
  
  /**
   * Stop speech recognition
   */
  stop() {
    if (!this.recognition || !this.isListening) {
      return;
    }
    
    try {
      this.recognition.stop();
      console.log('Stopping speech recognition');
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  }
  
  /**
   * Set recognition configuration
   * @param {Object} config - Configuration options
   */
  configure(config = {}) {
    if (!this.recognition) return;
    
    if (config.continuous !== undefined) {
      this.continuous = config.continuous;
      this.recognition.continuous = config.continuous;
    }
    
    if (config.interimResults !== undefined) {
      this.interimResults = config.interimResults;
      this.recognition.interimResults = config.interimResults;
    }
    
    if (config.language) {
      this.language = config.language;
      this.recognition.lang = config.language;
    }
  }
  
  /**
   * Set callback for speech recognition results
   * @param {Function} callback - Function to call with results
   */
  setResultCallback(callback) {
    this.onResultCallback = callback;
  }
  
  /**
   * Set callback for when speech recognition ends
   * @param {Function} callback - Function to call when recognition ends
   */
  setEndCallback(callback) {
    this.onEndCallback = callback;
  }
}

// Create a global instance
const speechRecognition = new SpeechRecognitionHandler(); 