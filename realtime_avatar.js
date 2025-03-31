/**
 * AI Talking Avatar
 */

// Global variables
let avatar = null;
let loadingScreen = null;
let statusElement = null;
let isListeningForResponse = false;
let avatarShimmer = null;
let currentUser = "Donald"; // Default user name

// DOM Elements
let speakButton = null;
let listenButton = null;
let configButton = null;
let welcomeButton = null;
let configPanel = null;

document.addEventListener('DOMContentLoaded', function() {
  initRealtimeAvatar();
});

/**
 * Initialize the real-time avatar system
 */
async function initRealtimeAvatar() {
  try {
    // Get DOM elements
    loadingScreen = document.getElementById('loadingScreen');
    statusElement = document.getElementById('status');
    avatarShimmer = document.getElementById('avatarShimmer');
    
    // Get buttons
    speakButton = document.getElementById('speakButton');
    listenButton = document.getElementById('listenButton');
    configButton = document.getElementById('configButton');
    welcomeButton = document.getElementById('welcomeButton');
    configPanel = document.getElementById('llmConfig');
    
    // Update status
    updateStatus('Loading avatar...');
    
    // Create avatar instance
    avatar = new Avatar('canvasContainer');
    
    updateStatus('Loading avatar model...');
    console.log('Loading avatar model from:', 'models/avatar.glb');
    
    // Load the model
    await avatar.loadModel('models/avatar.glb');
    console.log('Model loaded successfully');
    
    // Debug: Log available morphs
    console.log('Available morphs:', avatar.morphTargetDictionary ? Object.keys(avatar.morphTargetDictionary) : 'None found');
    console.log('Mapped morphs:', avatar.morphTargets ? Object.keys(avatar.morphTargets) : 'None mapped');
    
    // Set default expression
    avatar.setDefaultExpression();
    
    // Enable blinking
    avatar.animationState.blinking = true;
    
    // Setup LLM
    setupLLM();
    
    // Setup Speech Recognition
    setupSpeechRecognition();
    
    // Setup event listeners
    setupEventListeners();
    
    // Enable UI elements once avatar is loaded
    speakButton.disabled = false;
    listenButton.disabled = false;
    
    // Hide loading screen
    hideLoadingScreen();
    
    // Update status
    updateStatus('Avatar ready');
    
    // Try a test utterance to ensure speech works
    setTimeout(() => {
      console.log("Testing speech...");
      avatar.speak("Hello, I'm your AI assistant. How can I help you today?");
    }, 1000);
  } catch (error) {
    console.error('Error initializing avatar:', error);
    updateStatus('Error loading avatar: ' + error.message, true);
  }
}

/**
 * Setup the LLM connection
 */
function setupLLM() {
  // Get config elements
  const apiUrlInput = document.getElementById('apiUrl');
  const modelNameInput = document.getElementById('modelName');
  
  // Configure LLM with default values
  llmConnector.configure(apiUrlInput.value, modelNameInput.value);
  
  // Event listeners for LLM config - already set up in setupEventListeners()
}

/**
 * Setup speech recognition configuration
 */
function setupSpeechRecognition() {
  // Configure speech recognition
  speechRecognition.init({
    language: 'en-US',
    continuous: false,
    interimResults: true,
    onResult: function(text, isFinal) {
      if (isFinal && text.trim() !== '') {
        addMessageToHistory(text, 'user');
        sendMessageToLLM(text);
      }
    },
    onEnd: function() {
      isListeningForResponse = false;
      updateStatus('Ready');
      const listenButton = document.getElementById('listenButton');
      if (listenButton) {
        listenButton.textContent = 'Listen & Respond';
        listenButton.disabled = false;
      }
    }
  });
}

/**
 * Add a message to the chat history
 */
function addMessageToHistory(text, role) {
  const chatHistory = document.getElementById('chatHistory');
  const messageDiv = document.createElement('div');
  
  messageDiv.classList.add('chat-message');
  messageDiv.classList.add(role === 'user' ? 'user-message' : 'bot-message');
  messageDiv.textContent = text;
  
  chatHistory.appendChild(messageDiv);
  
  // Scroll to bottom
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

/**
 * Clear the chat history display
 */
function clearChatHistory() {
  const chatHistory = document.getElementById('chatHistory');
  chatHistory.innerHTML = '';
}

/**
 * Update the status display
 */
function updateStatus(message, isError = false) {
  if (statusElement) {
    statusElement.textContent = message;
    
    // Reset classes and add error class if needed
    statusElement.className = 'status';
    if (isError) {
      statusElement.classList.add('error');
    }
  }
}

/**
 * Hide the loading screen
 */
function hideLoadingScreen() {
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
}

/**
 * Setup event listeners for UI controls
 */
function setupEventListeners() {
  if (!speakButton || !listenButton || !configButton || !welcomeButton) {
    console.error('Required UI elements not found');
    return;
  }
  
  // Speak response button
  speakButton.addEventListener('click', () => {
    const lastBotMessage = getLastBotMessage();
    if (lastBotMessage) {
      avatar.speak(lastBotMessage);
      activateDigitalEffects();
    } else {
      alert('No response to speak yet');
    }
  });
  
  // Listen button
  listenButton.addEventListener('click', () => {
    if (!isListeningForResponse) {
      startListening();
      activateDigitalEffects();
    } else {
      stopListening();
      deactivateDigitalEffects();
    }
  });
  
  // LLM Config button
  configButton.addEventListener('click', () => {
    configPanel.classList.toggle('visible');
  });
  
  // Welcome button for greeting
  welcomeButton.addEventListener('click', () => {
    playWelcomeAnimation();
  });
  
  // Text input and speak button
  const speechInput = document.getElementById('speechInput');
  const speakBtn = document.getElementById('speakBtn');
  
  if (speechInput && speakBtn) {
    speakBtn.addEventListener('click', () => {
      const text = speechInput.value.trim();
      if (text) {
        sendMessageToLLM(text);
        speechInput.value = '';
      }
    });
    
    // Enter key in speech input
    speechInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        speakBtn.click();
      }
    });
  }
  
  // Save LLM config button
  const saveLLMConfigButton = document.getElementById('saveLLMConfig');
  if (saveLLMConfigButton) {
    saveLLMConfigButton.addEventListener('click', () => {
      const apiUrl = document.getElementById('apiUrl').value;
      const model = document.getElementById('modelName').value;
      
      llmConnector.configure(apiUrl, model);
      updateStatus(`LLM configured: ${model}`);
      configPanel.classList.remove('visible');
    });
  }
  
  // Clear chat history
  const clearHistoryButton = document.getElementById('clearHistory');
  if (clearHistoryButton) {
    clearHistoryButton.addEventListener('click', () => {
      clearChatHistory();
      llmConnector.clearHistory();
      updateStatus('Chat history cleared');
    });
  }
}

/**
 * Start listening for speech input
 */
function startListening() {
  isListeningForResponse = true;
  const listenBtn = document.getElementById('listenButton') || document.getElementById('listenBtn');
  if (listenBtn) {
    listenBtn.textContent = 'Stop Listening';
  }
  updateStatus('Listening...');
  speechRecognition.start();
}

/**
 * Stop listening for speech input
 */
function stopListening() {
  isListeningForResponse = false;
  const listenBtn = document.getElementById('listenButton') || document.getElementById('listenBtn');
  if (listenBtn) {
    listenBtn.textContent = 'Listen & Respond';
  }
  updateStatus('Ready');
  speechRecognition.stop();
}

/**
 * Send a message to the LLM and handle the response
 * @param {string} text - The message to send
 */
async function sendMessageToLLM(text) {
  if (!text || text.trim() === '') return;
  
  try {
    // Stop any ongoing speech and listening
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    
    if (isListeningForResponse) {
      stopListening();
    }
    
    // Disable buttons during processing
    speakButton.disabled = true;
    listenButton.disabled = true;
    
    // Add user message to chat history
    addMessageToHistory(text, 'user');
    
    // Update status
    updateStatus('Thinking...');
    
    // Activate "thinking" digital effects
    activateDigitalEffects();
    
    // Show "thinking" expression on avatar
    if (avatar && avatar.morphTargetDictionary) {
      // Find thoughtful expression morph targets
      const thoughtfulMorphs = {
        browInnerUp: 0.3,
        browOuterUpLeft: 0.1,
        browOuterUpRight: 0.1,
        eyeSquintLeft: 0.1,
        eyeSquintRight: 0.1
      };
      
      // Apply thinking expression
      for (const [morphName, value] of Object.entries(thoughtfulMorphs)) {
        if (avatar.morphTargetDictionary[morphName] !== undefined) {
          const index = avatar.morphTargetDictionary[morphName];
          avatar.faceFeatures.morphTargetInfluences[index] = value;
        }
      }
    }
    
    // Send message to LLM
    const response = await llmConnector.sendMessage(text);
    
    if (response) {
      // Add bot response to chat history
      addMessageToHistory(response, 'bot');
      
      // Set a slight delay before speaking for natural pause
      setTimeout(() => {
        // Speak the response
        avatar.speak(response);
        
        // Enable buttons after response
        speakButton.disabled = false;
        listenButton.disabled = false;
        
        // Update status
        updateStatus('Ready');
      }, 500);
    }
  } catch (error) {
    console.error('Error sending message to LLM:', error);
    updateStatus('Error: ' + error.message);
    
    // Provide fallback response
    const fallbackResponse = "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
    addMessageToHistory(fallbackResponse, 'bot');
    avatar.speak(fallbackResponse);
    
    // Re-enable buttons
    speakButton.disabled = false;
    listenButton.disabled = false;
    
    // Deactivate effects
    deactivateDigitalEffects();
  }
}

/**
 * Get the last bot message from the chat history
 * @returns {string} The last bot message
 */
function getLastBotMessage() {
  const chatHistory = document.getElementById('chatHistory');
  if (!chatHistory) return null;
  
  const botMessages = chatHistory.querySelectorAll('.bot-message');
  if (botMessages.length === 0) return null;
  
  return botMessages[botMessages.length - 1].textContent;
}

/**
 * Play welcome animation with personalized greeting
 */
function playWelcomeAnimation() {
  // Stop any ongoing speech
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  
  // Activate digital effects
  activateDigitalEffects();
  
  // Get current time to personalize greeting
  const currentHour = new Date().getHours();
  let timeGreeting = "Hello";
  
  if (currentHour < 12) {
    timeGreeting = "Good morning";
  } else if (currentHour < 18) {
    timeGreeting = "Good afternoon";
  } else {
    timeGreeting = "Good evening";
  }
  
  // Create personalized greeting message
  const welcomeMessage = `${timeGreeting} ${currentUser}, I'm your AI assistant. How can I help you today?`;
  
  // Add message to chat history
  addMessageToHistory(welcomeMessage, 'bot');
  
  // Speak the welcome message
  avatar.speak(welcomeMessage);
}

/**
 * Activate digital effects during speech/listening
 */
function activateDigitalEffects() {
  avatarShimmer.classList.add('active');
}

/**
 * Deactivate digital effects
 */
function deactivateDigitalEffects() {
  avatarShimmer.classList.remove('active');
}

/**
 * Analyze audio for better lip sync
 * @param {Float32Array} audioData - Audio data to analyze
 * @returns {number} - Mouth opening value 0-1
 */
function analyzeAudioForLipSync(audioData) {
  if (!audioData) return 0;
  
  // Get frequency data
  const bufferLength = audioAnalyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  audioAnalyser.getByteFrequencyData(dataArray);
  
  // Focus on speech frequencies (500-4000 Hz)
  const speechStart = Math.floor(500 * bufferLength / audioContext.sampleRate);
  const speechEnd = Math.floor(4000 * bufferLength / audioContext.sampleRate);
  
  let sum = 0;
  for (let i = speechStart; i < speechEnd; i++) {
    sum += dataArray[i];
  }
  
  // Normalize and apply non-linear mapping for more natural movement
  const avg = sum / (speechEnd - speechStart) / 255;
  const mouthValue = Math.pow(avg, 0.8) * 1.2; // Non-linear mapping
  
  // Clamp between 0-1
  return Math.max(0, Math.min(1, mouthValue));
}

// Update avatar.speak function to use our enhanced lip sync
avatar.speak = function(text) {
  if (!text || text.trim() === '') return;
  
  // Stop any current speech
  if (this.currentSpeech) {
    window.speechSynthesis.cancel();
  }
  
  // Create a new speech synthesis utterance
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Set voice if specified
  if (this.voice) {
    utterance.voice = this.voice;
  }
  
  // Setup audio processing for lip sync
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioAnalyser = audioContext.createAnalyser();
  audioAnalyser.fftSize = 1024;
  
  // Connect audio source when speech starts
  utterance.onstart = () => {
    this.animationState.talking = true;
    
    // Try to get audio source from speech synthesis
    try {
      // This is browser specific and may not work in all browsers
      const audioSource = audioContext.createMediaStreamSource(
        new MediaStream([speechSynthesis.getAudioTracks()[0]])
      );
      audioSource.connect(audioAnalyser);
    } catch (error) {
      console.warn("Could not access speech audio for lip sync:", error);
      // Fallback to simplified lip sync
      this.useFallbackLipSync = true;
    }
  };
  
  // Clean up when speech ends
  utterance.onend = () => {
    this.animationState.talking = false;
    this.mouthOpenValue = 0;
    audioContext.close();
  };
  
  // Start speaking
  this.currentSpeech = utterance;
  window.speechSynthesis.speak(utterance);
};

/**
 * Update mouth debug visualization
 * @param {number} value - Current mouth open value (0-1)
 */
function updateMouthDebug(value) {
  // Create debug element if it doesn't exist
  let debugEl = document.getElementById('mouthDebug');
  if (!debugEl) {
    debugEl = document.createElement('div');
    debugEl.id = 'mouthDebug';
    debugEl.style.position = 'absolute';
    debugEl.style.bottom = '10px';
    debugEl.style.left = '10px';
    debugEl.style.padding = '5px';
    debugEl.style.backgroundColor = 'rgba(0,0,0,0.5)';
    debugEl.style.color = 'white';
    debugEl.style.borderRadius = '5px';
    debugEl.style.fontSize = '12px';
    debugEl.style.zIndex = '1000';
    document.body.appendChild(debugEl);
  }
  
  // Update content and visualization
  const percentage = Math.round(value * 100);
  const barWidth = Math.max(1, Math.round(value * 100));
  debugEl.innerHTML = `
    <div>Mouth: ${percentage}%</div>
    <div style="background: #333; width: 100px; height: 10px; margin-top: 5px;">
      <div style="background: #4CAF50; width: ${barWidth}px; height: 10px;"></div>
    </div>
  `;
}

// Make it globally available
window.updateMouthDebug = updateMouthDebug;

// Modify the applyMouthOpenValue function in avatar.js to call updateMouthDebug
avatar.applyMouthOpenValue = function(value) {
  // Update debug visualization
  updateMouthDebug(value);
  
  // Try standard mouth open morph target first
  if (this.morphTargets && this.morphTargets.mouthOpen) {
    this.morphTargets.mouthOpen.morphTargetInfluences[this.morphTargets.mouthOpen.index] = value;
    
    // Also apply to related shapes if available
    if (this.morphTargets.mouthWide) {
      this.morphTargets.mouthWide.morphTargetInfluences[this.morphTargets.mouthWide.index] = value * 0.5;
    }
    console.log(`Applied mouth open value: ${value.toFixed(2)} to ${this.morphTargets.mouthOpen.name}`);
  }
  // If no standard targets found, try fallback
  else if (this.fallbackMouthTarget) {
    this.faceFeatures.morphTargetInfluences[this.fallbackMouthTarget.index] = value;
    console.log(`Applied mouth open value: ${value.toFixed(2)} to fallback: ${this.fallbackMouthTarget.name}`);
  }
  // Last resort - apply to all mouth-related morphs
  else if (this.faceFeatures && this.morphTargetDictionary) {
    for (const name in this.morphTargetDictionary) {
      if (name.toLowerCase().includes('mouth') || name.toLowerCase().includes('jaw')) {
        const index = this.morphTargetDictionary[name];
        this.faceFeatures.morphTargetInfluences[index] = value;
        console.log(`Applied mouth open value: ${value.toFixed(2)} to found target: ${name}`);
      }
    }
  } else {
    console.warn("No mouth targets available for speech");
  }
} 