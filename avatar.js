/**
 * Avatar class - handles 3D model and animations
 */
class Avatar {
  constructor(container) {
    // Get container element or ID
    if (typeof container === 'string') {
      this.container = document.getElementById(container);
    } else {
      this.container = container;
    }
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.model = null;
    this.mixer = null;
    this.clock = new THREE.Clock();
    this.isLoaded = false;
    this.blendShapes = {};
    this.morphTargetDictionary = null;
    this.faceFeatures = null;
    this.headBone = null;
    this.neckBone = null;
    this.morphTargets = {};
    this.animationState = {
      talking: false,
      blinking: false,
      breathing: false,
      lookingAround: false  // Disable idle head movements
    };
    
    // Speech recognition related
    this.speechRecognitionActive = false;
    
    // Timing variables
    this.lastBlink = Date.now();
    this.blinkDuration = 150; // milliseconds
    this.blinkInterval = 3000; // milliseconds
    this.breathingPhase = 0;
    this.idleMovementPhase = 0;
    
    // Animation parameters
    this.lookAtTarget = new THREE.Vector3(0, 0.8, 2.0);
    this.targetRotation = new THREE.Euler(0, 0, 0);
    this.currentRotation = new THREE.Euler(0, 0, 0);
    this.rotationSpeed = 0.05;
    
    // Speech-related variables
    this.currentSpeech = null;
    this.mouthOpenValue = 0;
    this.targetMouthOpenValue = 0;
    this.mouthSpeed = 0.3; // Increased for more responsiveness
    this.audioContext = null;
    this.audioAnalyser = null;
    this.audioDataArray = null;
    this.lastAudioUpdate = 0;
    
    // Initial setup
    this.init();
  }
  
  /**
   * Initialize the 3D scene
   */
  init() {
    // Setup scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);
    
    // Setup camera
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    // Position camera higher to look slightly downward at the avatar
    this.camera.position.set(0, 1.0, 2.0);
    this.camera.lookAt(0, 0.7, 0);
    
    // Setup lighting for better face illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 1);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-1, 1, 0.5);
    this.scene.add(fillLight);
    
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(1, 0.5, -0.5);
    this.scene.add(rimLight);
    
    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    
    // Add OrbitControls
    this.setupOrbitControls();
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
    
    // Initialize audio context for speech analysis
    this.setupAudioAnalysis();
    
    // Initialize face tracking
    this.setupFaceTracking();
    
    // Start animation loop
    this.animate();
  }
  
  /**
   * Setup AudioContext for speech analysis
   */
  setupAudioAnalysis() {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 1024;
      this.audioDataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
      
      console.log("Audio analysis setup successful");
    } catch (error) {
      console.warn("Could not setup audio analysis:", error);
    }
  }
  
  /**
   * Setup orbit controls for camera movement
   */
  setupOrbitControls() {
    if (window.THREE && window.THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.25;
      this.controls.rotateSpeed = 0.35;
      this.controls.minDistance = 1;
      this.controls.maxDistance = 5;
      this.controls.enablePan = false;
      this.controls.target.set(0, 0.8, 0);
    } else {
      // If OrbitControls is not available, load it dynamically
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/three@0.132.2/examples/js/controls/OrbitControls.js';
      script.onload = () => {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
        this.controls.rotateSpeed = 0.35;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 5;
        this.controls.enablePan = false;
        this.controls.target.set(0, 0.8, 0);
      };
      document.head.appendChild(script);
    }
  }
  
  /**
   * Load a 3D model
   * @param {string} modelPath - Path to the model file
   */
  async loadModel(modelPath) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.GLTFLoader();
      loader.load(
        modelPath,
        (gltf) => {
          this.model = gltf.scene;
          
          // Reset position and rotation
          this.model.position.set(0, -0.9, 0);
          
          // Face forward with a slight downward tilt
          this.model.rotation.y = 0;
          this.model.rotation.x = 0.1; // Add slight downward tilt
          
          this.scene.add(this.model);
          
          // Setup model
          this.setupModel(gltf);
          
          // Enable shadows
          this.model.traverse((object) => {
            if (object.isMesh) {
              object.castShadow = true;
              object.receiveShadow = true;
            }
          });
          
          this.isLoaded = true;
          resolve();
        },
        (progress) => {
          // Loading progress
        },
        (error) => {
          console.error('Error loading model:', error);
          reject(error);
        }
      );
    });
  }
  
  /**
   * Setup the model after loading
   * @param {Object} gltf - The loaded GLTF object
   */
  setupModel(gltf) {
    // Log model structure for debugging
    console.log("=== Model Structure ===");
    console.log("Model loaded:", gltf);
    
    // Add extensive model inspection
    console.log("=== Scanning Model For Details ===");
    const meshes = [];
    const bones = [];
    const morphs = [];
    
    gltf.scene.traverse((object) => {
      if (object.isMesh) {
        meshes.push({
          name: object.name,
          type: 'Mesh',
          hasMorphs: !!object.morphTargetDictionary,
          morphCount: object.morphTargetDictionary ? Object.keys(object.morphTargetDictionary).length : 0
        });
        
        // If it has morph targets, log them
        if (object.morphTargetDictionary) {
          const morphNames = Object.keys(object.morphTargetDictionary);
          console.log(`Found mesh "${object.name}" with ${morphNames.length} morph targets:`, morphNames);
          
          // Store individual morph details
          for (const morphName of morphNames) {
            morphs.push({
              name: morphName,
              mesh: object.name,
              index: object.morphTargetDictionary[morphName]
            });
          }
        }
      }
      
      if (object.isBone) {
        bones.push({
          name: object.name,
          type: 'Bone'
        });
      }
    });
    
    // Print summary
    console.log(`Model contains: ${meshes.length} meshes, ${bones.length} bones, ${morphs.length} morph targets`);
    console.table(meshes);
    console.table(bones);
    console.table(morphs);
    
    // Find the head bone with a more robust search
    const possibleHeadBones = ['Head', 'head', 'mixamorigHead', 'Neck', 'neck', 'mixamorigNeck'];
    
    // Find the head bone
    gltf.scene.traverse((object) => {
      if (object.isBone) {
        // Check for head bone
        if (!this.headBone && possibleHeadBones.some(name => object.name.includes(name))) {
          this.headBone = object;
          console.log("Found head bone:", object.name);
        }
        
        // Store references to key bones
        if (object.name.toLowerCase().includes('spine')) {
          this.spineBone = object;
          console.log("Found spine bone:", object.name);
        }
      }
    });
    
    if (!this.headBone) {
      console.warn("No head bone found - head animations will not work");
    }
    
    // Find the face/skin mesh with morph targets
    let meshWithMostMorphs = null;
    let maxMorphCount = 0;
    
    gltf.scene.traverse((object) => {
      if (object.isMesh && object.morphTargetDictionary) {
        const morphCount = Object.keys(object.morphTargetDictionary).length;
        
        // If this mesh has more morphs than we've seen, or it's the first one
        if (morphCount > maxMorphCount || !meshWithMostMorphs) {
          meshWithMostMorphs = object;
          maxMorphCount = morphCount;
        }
        
        // If mesh name contains "face", "head" or similar, prioritize it
        if (object.name.toLowerCase().includes('face') || 
            object.name.toLowerCase().includes('head')) {
        this.faceFeatures = object;
        this.morphTargetDictionary = object.morphTargetDictionary;
          console.log("Selected face mesh based on name:", object.name);
        }
      }
    });
    
    // If we didn't find a face-specific mesh, use the one with most morphs
    if (!this.faceFeatures && meshWithMostMorphs) {
      this.faceFeatures = meshWithMostMorphs;
      this.morphTargetDictionary = meshWithMostMorphs.morphTargetDictionary;
      console.log("Selected mesh with most morphs as face:", meshWithMostMorphs.name);
    }
    
    // Force head to look straight or slightly down initially
    if (this.headBone) {
      this.headBone.rotation.x = 0.1; // Slight downward tilt
      this.headBone.rotation.y = 0;
      this.headBone.rotation.z = 0;
      console.log("Forced head orientation to look straight/slightly downward");
    }
    
    if (this.faceFeatures) {
      console.log("Found mesh with morph targets:", this.faceFeatures.name);
        console.log("Available morph targets:", Object.keys(this.morphTargetDictionary));
        
      // Group morph targets by category for better understanding
      const categories = {
        mouth: [],
        eyes: [],
        brows: [],
        cheeks: [],
        other: []
      };
      
      for (const name of Object.keys(this.morphTargetDictionary)) {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('mouth') || lowerName.includes('jaw') || lowerName.includes('lip')) {
          categories.mouth.push(name);
        } else if (lowerName.includes('eye') || lowerName.includes('blink')) {
          categories.eyes.push(name);
        } else if (lowerName.includes('brow')) {
          categories.brows.push(name);
        } else if (lowerName.includes('cheek') || lowerName.includes('smile')) {
          categories.cheeks.push(name);
        } else {
          categories.other.push(name);
        }
      }
      
      console.log("Morph targets by category:", categories);
      
      // Initialize morph targets object
      this.morphTargets = {};
      
      // Map common morph target names to standardized properties
      // For mouth movement
      const mouthMorphs = ['mouthOpen', 'jawOpen', 'JawOpen', 'jawDown', 'MouthOpen', 'mouth_open', 'openMouth', 'open_mouth'];
      
      // For eye blinks
      const eyeMorphs = ['eyesClosed', 'eyeBlink', 'EyesClosed', 'eyeClosed', 'eye_blink', 'blinkEyes'];
      
      // For smiling
      const smileMorphs = ['mouthSmile', 'smile', 'Smile', 'mouthSmileLeft', 'mouthSmileRight', 'mouth_smile'];
      
      // For rounded mouth like 'O' sound
      const roundMorphs = ['mouthRound', 'mouthO', 'mouth_o', 'O', 'oMouth', 'pucker'];
      
      // For wide mouth like 'E' sound
      const wideMorphs = ['mouthWide', 'mouthE', 'mouth_e', 'E', 'eMouth', 'mouthStretch'];
      
      // Try all possible morph target names and map them
      this.findAndMapMorphTarget(mouthMorphs, 'mouthOpen');
      this.findAndMapMorphTarget(eyeMorphs, 'eyesClosed');
      this.findAndMapMorphTarget(smileMorphs, 'mouthSmile');
      this.findAndMapMorphTarget(roundMorphs, 'mouthRound');
      this.findAndMapMorphTarget(wideMorphs, 'mouthWide');
      
      // Debug what was found
      console.log("Mapped morph targets:", Object.keys(this.morphTargets));
      
      // Test all available morph targets to see which ones move the mouth
      console.log("=== Testing morph targets for mouth movement ===");
      this.testMorphTargetsForMouth();
    }
    
    // Look for animations
    if (gltf.animations && gltf.animations.length > 0) {
      console.log("Found animations:", gltf.animations.map(a => a.name));
      
      // Create an animation mixer
      this.mixer = new THREE.AnimationMixer(gltf.scene);
      
      // Store references to all animations
      this.animations = {};
      gltf.animations.forEach((animation) => {
        this.animations[animation.name] = animation;
      });
    }
  }
  
  /**
   * Test all morph targets to see which ones affect the mouth
   */
  testMorphTargetsForMouth() {
    if (!this.faceFeatures || !this.morphTargetDictionary) return;
    
    // Reset all morph targets to 0
    const resetMorphs = () => {
      for (const name in this.morphTargetDictionary) {
        const index = this.morphTargetDictionary[name];
        this.faceFeatures.morphTargetInfluences[index] = 0;
      }
    };
    
    // Store possible mouth morphs
    this.possibleMouthMorphs = [];
    
    // Test each morph target
    for (const name in this.morphTargetDictionary) {
      // Reset all morphs first
      resetMorphs();
      
      // Then apply this morph at full value
      const index = this.morphTargetDictionary[name];
      this.faceFeatures.morphTargetInfluences[index] = 1.0;
      
      // Check if name matches typical mouth morphs
      const lowerName = name.toLowerCase();
      if (lowerName.includes('mouth') || 
          lowerName.includes('jaw') || 
          lowerName.includes('lip') ||
          lowerName.includes('smile') ||
          lowerName.includes('speak')) {
        console.log(`Morph "${name}" is likely a mouth morph based on name`);
        this.possibleMouthMorphs.push(name);
      }
      
      // Reset back to 0 after a brief delay
      setTimeout(() => {
        this.faceFeatures.morphTargetInfluences[index] = 0;
      }, 10);
    }
    
    console.log("Identified possible mouth morphs:", this.possibleMouthMorphs);
    
    // If no standard mapping was found, use the first possible mouth morph
    if (!this.morphTargets.mouthOpen && this.possibleMouthMorphs.length > 0) {
      const name = this.possibleMouthMorphs[0];
      const index = this.morphTargetDictionary[name];
      
      this.morphTargets.mouthOpen = {
        name: name,
        index: index,
        morphTargetInfluences: this.faceFeatures.morphTargetInfluences
      };
      
      console.log(`Using "${name}" as primary mouth morph target`);
    }
  }
  
  /**
   * Find and map a morph target from possible names
   * @param {Array} possibleNames - Array of possible morph target names
   * @param {String} standardName - Standard name to map to
   */
  findAndMapMorphTarget(possibleNames, standardName) {
    if (!this.morphTargetDictionary || !this.faceFeatures) return;
    
    // Try exact matches first
    for (const name of possibleNames) {
      if (this.morphTargetDictionary[name] !== undefined) {
        const index = this.morphTargetDictionary[name];
        this.morphTargets[standardName] = {
          name: name,
          index: index,
          morphTargetInfluences: this.faceFeatures.morphTargetInfluences
        };
        console.log(`Mapped ${name} to ${standardName} at index ${index}`);
        return;
      }
    }
    
    // If no exact match, try substring matches
    for (const name of Object.keys(this.morphTargetDictionary)) {
      for (const possibleName of possibleNames) {
        if (name.toLowerCase().includes(possibleName.toLowerCase())) {
          const index = this.morphTargetDictionary[name];
          this.morphTargets[standardName] = {
            name: name,
            index: index,
            morphTargetInfluences: this.faceFeatures.morphTargetInfluences
          };
          console.log(`Mapped ${name} to ${standardName} at index ${index} (substring match)`);
          return;
        }
      }
    }
    
    console.warn(`Could not find a morph target for ${standardName}`);
  }
  
  /**
   * Reset face to neutral expression
   */
  resetFace() {
    if (!this.faceFeatures || !this.morphTargetDictionary) {
      return;
    }
    
    // Reset all morph targets to 0
    for (const key in this.morphTargetDictionary) {
      const index = this.morphTargetDictionary[key];
      if (this.faceFeatures.morphTargetInfluences) {
        this.faceFeatures.morphTargetInfluences[index] = 0;
      }
    }
    
    // Set default values for common expressions
    // Values are between 0 and 1
    this.blendShapes = {
      eyeBlinkLeft: 0,
      eyeBlinkRight: 0,
      jawOpen: 0,
      mouthSmile: 0.1, // Slight smile
      mouthClose: 0
    };
    
    this.mapBlendShapesToMorphTargets(this.blendShapes);
  }
  
  /**
   * Set a default expression for the avatar
   */
  setDefaultExpression() {
    if (!this.faceFeatures || !this.morphTargetDictionary) {
      return;
    }
    
    console.log("Setting up humanlike animation system");
    
    // Set up subtle idle animations
    this.setupIdleAnimations();
    
    // Start autonomous behaviors
    this.startAutonomousBehaviors();
  }
  
  /**
   * Set up idle animations for continuous life-like movement
   */
  setupIdleAnimations() {
    // Set up periodic blinking
    this.blinkInterval = 2000 + Math.random() * 3000; // Random interval between 2-5 seconds
    this.lastBlink = Date.now();
    
    // Set up subtle breathing
    this.breathingPhase = 0;
    this.breathingSpeed = 0.3; // Speed of breathing cycle
    
    // Set up random micro-expressions and movements
    this.microExpressionInterval = 4000 + Math.random() * 3000; // 4-7 seconds
    this.lastMicroExpression = Date.now();
    
    // Configure emotional state
    this.emotionalState = {
      happiness: 0.2,   // Slight pleasant look
      surprise: 0,
      thoughtfulness: 0.1,
      engagement: 0.3   // Attentive baseline
    };
    
    // Apply a default pleasant expression
    this.applyEmotionalState();
  }
  
  /**
   * Start continuous autonomous behaviors
   */
  startAutonomousBehaviors() {
    // Cancel any existing animation loop
    if (this.behaviorLoop) {
      clearInterval(this.behaviorLoop);
    }
    
    // Set up loop for human-like autonomous behaviors (every 3 seconds)
    this.behaviorLoop = setInterval(() => {
      // Skip if currently speaking
      if (this.animationState.talking) return;
      
      // Choose a random behavior
      const behaviors = [
        () => this.doThoughtfulGesture(),  // Look thoughtful briefly
        () => this.doAttentiveGesture(),   // Look at user/camera 
        () => this.doSubtleNod(),          // Subtle head nod
        () => this.doLookAway()            // Briefly look away then back
      ];
      
      // Randomly select behavior with 30% chance
      if (Math.random() < 0.3) {
        const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        behavior();
      }
    }, 3000);
  }
  
  /**
   * Apply the current emotional state to facial expressions
   */
  applyEmotionalState() {
    if (!this.faceFeatures || !this.morphTargetDictionary) return;
    
    // Reset expressions first
    this.resetExpressions();
    
    // Track what was found for fallback
    let foundExpressions = {
      brows: false,
      eyes: false,
      mouth: false
    };
    
    // Apply eyebrow expressions based on emotional state
    if (this.morphTargetDictionary['browInnerUp'] !== undefined) {
      const index = this.morphTargetDictionary['browInnerUp'];
      // Combine thoughtfulness and surprise for brow raising
      const browRaise = this.emotionalState.thoughtfulness * 0.3 + 
                       this.emotionalState.surprise * 0.7;
      this.faceFeatures.morphTargetInfluences[index] = browRaise;
      foundExpressions.brows = true;
    }
    
    // Apply eye expressions
    if (this.morphTargetDictionary['eyeWideLeft'] !== undefined && 
        this.morphTargetDictionary['eyeWideRight'] !== undefined) {
      const leftIndex = this.morphTargetDictionary['eyeWideLeft'];
      const rightIndex = this.morphTargetDictionary['eyeWideRight'];
      // Widen eyes based on surprise and engagement
      const eyeWiden = this.emotionalState.surprise * 0.5 + 
                      this.emotionalState.engagement * 0.2;
      this.faceFeatures.morphTargetInfluences[leftIndex] = eyeWiden;
      this.faceFeatures.morphTargetInfluences[rightIndex] = eyeWiden;
      foundExpressions.eyes = true;
    }
    
    // Apply smile based on happiness
    if (this.morphTargetDictionary['mouthSmile'] !== undefined) {
      const index = this.morphTargetDictionary['mouthSmile'];
      this.faceFeatures.morphTargetInfluences[index] = this.emotionalState.happiness;
      foundExpressions.mouth = true;
    }
    
    // Fallbacks for models with different morph targets
    if (!foundExpressions.brows || !foundExpressions.eyes || !foundExpressions.mouth) {
      this.applyEmotionalStateFallback();
    }
  }
  
  /**
   * Fallback for applying emotional states on avatars with non-standard morph targets
   */
  applyEmotionalStateFallback() {
    if (!this.faceFeatures || !this.morphTargetDictionary) return;
    
    // Try to find any targets that might work for key expressions
    const targetPatterns = {
      browUp: ['browUp', 'browRaise', 'eyebrow', 'surprised'],
      smile: ['smile', 'happy', 'joy'],
      eyesWide: ['eyeWide', 'eyeOpen']
    };
    
    // For each expression type, find and apply to matching targets
    for (const [type, patterns] of Object.entries(targetPatterns)) {
      for (const pattern of patterns) {
        // Find any morph target containing this pattern
        for (const targetName in this.morphTargetDictionary) {
          if (targetName.toLowerCase().includes(pattern.toLowerCase())) {
            const index = this.morphTargetDictionary[targetName];
            
            // Apply appropriate value based on type
            if (type === 'browUp') {
              const value = this.emotionalState.thoughtfulness * 0.3 + 
                            this.emotionalState.surprise * 0.5;
              this.faceFeatures.morphTargetInfluences[index] = value;
            } else if (type === 'smile') {
              this.faceFeatures.morphTargetInfluences[index] = this.emotionalState.happiness;
            } else if (type === 'eyesWide') {
              this.faceFeatures.morphTargetInfluences[index] = this.emotionalState.surprise * 0.5;
            }
            
            // Found a match for this type, move to next
            break;
          }
        }
      }
    }
  }
  
  /**
   * Perform a thoughtful-looking gesture
   */
  doThoughtfulGesture() {
    // Save current state
    const previousState = { ...this.emotionalState };
    
    // Update emotional state to look thoughtful
    this.emotionalState.thoughtfulness = 0.7;
    this.emotionalState.happiness = 0.1;
    this.applyEmotionalState();
    
    // Look to the side (no upward look)
    if (this.headBone) {
      gsap.to(this.headBone.rotation, {
        x: 0,     // No upward tilt
        y: 0.2,   // Look to the side
        duration: 0.8,
        ease: "power2.inOut"
      });
    }
    
    // Return to normal after a moment
    setTimeout(() => {
      // Restore previous state
      this.emotionalState = { ...previousState };
      this.applyEmotionalState();
      
      // Return head to neutral position
      if (this.headBone) {
        gsap.to(this.headBone.rotation, {
          x: 0,
          y: 0,
          duration: 1,
          ease: "power2.inOut"
        });
      }
    }, 2500); // Last for 2.5 seconds
  }
  
  /**
   * Perform an attentive gesture, looking at user
   */
  doAttentiveGesture() {
    // Save current state
    const previousState = { ...this.emotionalState };
    
    // Update emotional state to look engaged
    this.emotionalState.engagement = 0.8;
    this.emotionalState.happiness = 0.3;
    this.emotionalState.thoughtfulness = 0.2;
    this.applyEmotionalState();
    
    // Look directly at camera with slight head tilt
    if (this.headBone) {
      gsap.to(this.headBone.rotation, {
        x: 0.05,  // Slight downward tilt (attentive)
        y: 0,     // Center
        z: 0.05,  // Slight head tilt
        duration: 0.6,
        ease: "power2.out"
      });
    }
    
    // Add a micro-nod during this state
    setTimeout(() => {
      if (this.headBone) {
        gsap.to(this.headBone.rotation, {
          x: 0.08, // Nod slightly down
          duration: 0.3,
          yoyo: true,
          repeat: 1,
          ease: "power2.inOut"
        });
      }
    }, 800);
    
    // Return to normal after a moment
    setTimeout(() => {
      // Restore previous state
      this.emotionalState = { ...previousState };
      this.applyEmotionalState();
      
      // Return head to neutral position
      if (this.headBone) {
        gsap.to(this.headBone.rotation, {
          x: 0,
          y: 0,
          z: 0,
          duration: 0.8,
          ease: "power2.inOut"
        });
      }
    }, 3000); // Last for 3 seconds
  }
  
  /**
   * Perform a subtle nod
   */
  doSubtleNod() {
    if (!this.headBone) return;
    
    // Create a natural-looking nod animation
    gsap.to(this.headBone.rotation, {
      x: 0.1, // Nod down
      duration: 0.4,
      ease: "power2.inOut",
      onComplete: () => {
        gsap.to(this.headBone.rotation, {
          x: 0,  // Return to neutral
          duration: 0.4,
          ease: "power3.out"
        });
      }
    });
    
    // Slightly raise eyebrows during nod
    if (this.morphTargetDictionary && this.morphTargetDictionary['browInnerUp'] !== undefined) {
      const index = this.morphTargetDictionary['browInnerUp'];
      const currentValue = this.faceFeatures.morphTargetInfluences[index];
      
      gsap.to(this.faceFeatures.morphTargetInfluences, {
        [index]: currentValue + 0.2,
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut"
      });
    }
  }
  
  /**
   * Look away briefly, then return attention to user
   * Simulates natural momentary distraction and refocusing
   */
  doLookAway() {
    if (!this.headBone) return;
    
    // Look away (randomly left or right)
    const lookDirection = Math.random() > 0.5 ? 0.3 : -0.3;
    
    gsap.to(this.headBone.rotation, {
      y: lookDirection, // Look to side
      duration: 0.7,
      ease: "power2.inOut",
      onComplete: () => {
        // Brief pause then look back
        setTimeout(() => {
          gsap.to(this.headBone.rotation, {
            y: 0, // Return to center
            duration: 0.9,
            ease: "power2.inOut"
          });
        }, 700);
      }
    });
  }
  
  /**
   * Make the avatar speak the given text
   * @param {string} text - The text for the avatar to speak
   */
  speak(text) {
    if (!text || text.trim() === '') return;
    
    // Stop any current speech
    if (this.currentSpeech) {
      window.speechSynthesis.cancel();
    }
    
    // Debug: Check if morphTargets is properly initialized
    console.log("Speaking with morph targets:", this.morphTargets);
    
    // Find any mouth-related morph target if the standard ones aren't mapped
    if (!this.morphTargets || !this.morphTargets.mouthOpen) {
      this.findFallbackMouthTarget();
      
      // If still no mouth targets, use direct animation
      if ((!this.morphTargets || !this.morphTargets.mouthOpen) && 
          !this.fallbackMouthTarget && 
          !this.usesDirectMouthAnimation) {
        console.log("No mouth targets found, switching to direct animation");
        this.setupDirectMouthAnimation();
      }
    }
    
    // Create speech utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice if specified
    if (this.voice) {
      utterance.voice = this.voice;
    }
    
    // Store last audio update time
    this.lastAudioUpdate = Date.now();
    
    // Start mouth movement simulation
    utterance.onstart = () => {
      this.animationState.talking = true;
      console.log("Speech started, animating mouth");
      
      // Simulate speech by starting a timer to update mouth movements
      this.lipSyncInterval = setInterval(() => {
        // Generate a semi-random mouth opening value based on syllable timing
        // Typical syllable rate is ~4-6 per second
        const now = Date.now();
        const timeSinceStart = now - this.lastAudioUpdate;
        
        // Oscillate between open and partially closed at a natural rate (~5Hz)
        // With some randomness for natural variation
        const syllablePhase = (timeSinceStart / 200) % 1; // ~5Hz cycle
        
        if (syllablePhase < 0.4) {
          // Opening phase - mouth opens quickly
          this.targetMouthOpenValue = 0.1 + Math.random() * 0.5; // Random between 0.1-0.6
        } else if (syllablePhase < 0.6) {
          // Peak open phase
          this.targetMouthOpenValue = 0.4 + Math.random() * 0.3; // Random between 0.4-0.7
        } else {
          // Closing phase - gradual close
          this.targetMouthOpenValue = 0.05 + Math.random() * 0.2; // Random between 0.05-0.25
        }
        
        // Smooth the movement
        this.mouthOpenValue += (this.targetMouthOpenValue - this.mouthOpenValue) * 0.3;
        
        // Apply the mouth opening value to the avatar
        this.applyMouthOpenValue(this.mouthOpenValue);
        
        this.lastAudioUpdate = now;
      }, 30); // Update at ~30fps
    };
    
    // Clean up when speech ends
    utterance.onend = () => {
      console.log("Speech ended, stopping mouth animation");
      this.animationState.talking = false;
      clearInterval(this.lipSyncInterval);
      
      // Close mouth gradually
      const closeMouth = () => {
        if (this.mouthOpenValue > 0.01) {
          this.mouthOpenValue *= 0.8; // Exponential decay
          
          // Apply the mouth open value
          this.applyMouthOpenValue(this.mouthOpenValue);
          
          requestAnimationFrame(closeMouth);
        } else {
          this.mouthOpenValue = 0;
          this.applyMouthOpenValue(0);
        }
      };
      
      requestAnimationFrame(closeMouth);
    };
    
    // Start speaking
    this.currentSpeech = utterance;
    window.speechSynthesis.speak(utterance);
  }
  
  /**
   * Apply mouth open value to any available mouth morph
   * @param {number} value - Mouth open value (0-1)
   */
  applyMouthOpenValue(value) {
    // Store last value for debugging
    this.lastMouthValue = value;
    
    // Update debug visualization (from realtime_avatar.js)
    if (window.updateMouthDebug) {
      window.updateMouthDebug(value);
    }
    
    // Try direct mouth animation first if enabled
    if (this.usesDirectMouthAnimation) {
      this.applyDirectMouthAnimation(value);
      return;
    }
    
    // Try standard mouth open morph target first
    if (this.morphTargets && this.morphTargets.mouthOpen) {
      this.morphTargets.mouthOpen.morphTargetInfluences[this.morphTargets.mouthOpen.index] = value;
      
      // Also apply to related shapes if available
      if (this.morphTargets.mouthWide) {
        this.morphTargets.mouthWide.morphTargetInfluences[this.morphTargets.mouthWide.index] = value * 0.5;
      }
      console.log(`Applied mouth value: ${value.toFixed(2)} to ${this.morphTargets.mouthOpen.name}`);
    }
    // If no standard targets found, try fallback
    else if (this.fallbackMouthTarget) {
      this.faceFeatures.morphTargetInfluences[this.fallbackMouthTarget.index] = value;
      console.log(`Applied mouth value: ${value.toFixed(2)} to fallback: ${this.fallbackMouthTarget.name}`);
    }
    // Last resort - apply to all mouth-related morphs
    else if (this.faceFeatures && this.morphTargetDictionary) {
      let applied = false;
      for (const name in this.morphTargetDictionary) {
        if (name.toLowerCase().includes('mouth') || name.toLowerCase().includes('jaw')) {
          const index = this.morphTargetDictionary[name];
          this.faceFeatures.morphTargetInfluences[index] = value;
          console.log(`Applied mouth value: ${value.toFixed(2)} to found target: ${name}`);
          applied = true;
        }
      }
      
      // If nothing worked, fall back to direct animation
      if (!applied && !this.usesDirectMouthAnimation) {
        this.setupDirectMouthAnimation();
        this.applyDirectMouthAnimation(value);
      }
      } else {
      // If we have no morph targets at all, use direct animation
      if (!this.usesDirectMouthAnimation) {
        this.setupDirectMouthAnimation();
        this.applyDirectMouthAnimation(value);
      }
    }
  }
  
  /**
   * Find any available mouth-related morph target as a fallback
   */
  findFallbackMouthTarget() {
    if (!this.faceFeatures || !this.morphTargetDictionary) return;
    
    console.log("Looking for fallback mouth targets...");
    
    // Keywords that might be related to mouth movement
    const mouthKeywords = ['mouth', 'jaw', 'open', 'talk', 'speak', 'lips'];
    
    // Check all morph targets for anything mouth-related
    for (const name in this.morphTargetDictionary) {
      const lowerName = name.toLowerCase();
      
      for (const keyword of mouthKeywords) {
        if (lowerName.includes(keyword)) {
          const index = this.morphTargetDictionary[name];
          this.fallbackMouthTarget = { name, index };
          console.log(`Found fallback mouth target: ${name} at index ${index}`);
          return;
        }
      }
    }
    
    console.warn("No mouth-related morph targets found at all. Speech animation will not work.");
  }
  
  /**
   * Update loading status
   * @param {string} message - Status message
   * @param {number} progress - Progress percentage (0-100)
   */
  updateLoadingStatus(message, progress) {
    const loadingStatus = document.getElementById('loadingStatus');
    const loadingBar = document.getElementById('loadingBar');
    
    if (loadingStatus) {
      loadingStatus.textContent = message;
    }
    
    if (loadingBar) {
      loadingBar.style.width = `${progress}%`;
    }
  }
  
  /**
   * Window resize handler
   */
  onWindowResize() {
    if (!this.camera || !this.renderer || !this.container) return;
    
    // Update camera
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    
    // Update renderer
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
  
  /**
   * Animation loop
   */
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    
    // Update mixer animations if available
    if (this.mixer) {
      this.mixer.update(delta);
    }
    
    // Update avatar animations
    this.updateAnimation(delta);
    
    // Update orbit controls if available
    if (this.controls) {
      this.controls.update();
    }
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Update the avatar's animation state
   * @param {number} deltaTime - Time since last frame in seconds
   */
  updateAnimation(deltaTime) {
    if (!this.model) return;
    
    // Handle talking and lip sync
    if (this.animationState.talking) {
      // Get current audio data if available
      if (this.audioAnalyser && this.audioDataArray) {
        this.audioAnalyser.getByteFrequencyData(this.audioDataArray);
        
        // Calculate average frequency intensity, focusing on speech frequencies
        const speechStart = Math.floor(500 * this.audioDataArray.length / this.audioContext.sampleRate);
        const speechEnd = Math.floor(4000 * this.audioDataArray.length / this.audioContext.sampleRate);
        
        let sum = 0;
        for (let i = speechStart; i < speechEnd; i++) {
          sum += this.audioDataArray[i];
        }
        
        // Normalize and apply non-linear mapping for better mouth movement
        const avg = sum / (speechEnd - speechStart) / 255;
        this.targetMouthOpenValue = Math.pow(avg, 0.7) * 1.2; // Non-linear curve for more natural movement
        this.targetMouthOpenValue = Math.min(1, Math.max(0, this.targetMouthOpenValue));
      } else {
        // Fallback method if audio analysis isn't available
        // Use sine wave that varies between values
        this.targetMouthOpenValue = 0.3 + (Math.sin(Date.now() * 0.01) * 0.2);
      }
    } else {
      // Not talking, close mouth
      this.targetMouthOpenValue = 0;
    }
    
    // Smooth transitions for mouth movements (important for natural look)
    this.mouthOpenValue += (this.targetMouthOpenValue - this.mouthOpenValue) * this.mouthSpeed;
    
    // Apply mouth shapes (visemes) - adjust based on your model's specific morph targets
    if (this.morphTargets.mouthOpen) {
      this.morphTargets.mouthOpen.morphTargetInfluences[this.morphTargets.mouthOpen.index] = this.mouthOpenValue;
    }
    
    // Advanced: Apply additional mouth shapes based on speech patterns
    if (this.animationState.talking && this.morphTargets.mouthWide) {
      // Wider mouth on emphasized syllables
      const wideAmount = this.mouthOpenValue * 0.7 * (0.5 + Math.sin(Date.now() * 0.008) * 0.5);
      this.morphTargets.mouthWide.morphTargetInfluences[this.morphTargets.mouthWide.index] = wideAmount;
    }
    
    // Blinking
    if (this.animationState.blinking) {
    const now = Date.now();
      if (now - this.lastBlink > this.blinkInterval) {
        // Start a blink
        this.lastBlink = now;
        this.blinkProgress = 0;
        
        // Randomize next blink interval (more natural)
        this.blinkInterval = 2000 + Math.random() * 4000; // 2-6 seconds between blinks
      }
      
      // Blink animation is in progress
      if (now - this.lastBlink < this.blinkDuration) {
        // Blink animation curve (fast close, slight hold, fast open)
        const t = (now - this.lastBlink) / this.blinkDuration;
        let blinkValue;
        
        if (t < 0.3) {
          // Fast close
          blinkValue = t / 0.3;
        } else if (t < 0.7) {
          // Slight hold
          blinkValue = 1;
        } else {
          // Fast open
          blinkValue = 1 - ((t - 0.7) / 0.3);
        }
        
        // Apply eyelid morphs
        if (this.morphTargets.eyesClosed) {
          this.morphTargets.eyesClosed.morphTargetInfluences[this.morphTargets.eyesClosed.index] = blinkValue;
        }
      } else if (this.morphTargets.eyesClosed) {
        // Ensure eyes are open when not blinking
        this.morphTargets.eyesClosed.morphTargetInfluences[this.morphTargets.eyesClosed.index] = 0;
      }
    }
    
    // Subtle breathing - FIXED: Only affect the chest/spine, not the whole model
    if (this.animationState.breathing) {
      this.breathingPhase += deltaTime * 0.3; // Slower breathing rate
      const breathAmount = Math.sin(this.breathingPhase) * 0.005; // Small amplitude
      
      // Try to find any spine or chest bones to apply breathing to
      let breathingApplied = false;
      
      // Check for specific bones to apply breathing to
      if (this.spineBone) {
        // Apply subtle scaling to the spine for breathing effect
        this.spineBone.scale.y = 1 + breathAmount * 4;
        this.spineBone.scale.z = 1 + breathAmount * 2;
        breathingApplied = true;
        } else {
        // Try to find chest or spine bones dynamically
        this.model.traverse((object) => {
          if (object.isBone && !breathingApplied) {
            const name = object.name.toLowerCase();
            if (name.includes('spine') || name.includes('chest') || name.includes('torso')) {
              // Apply subtle movement to this bone
              if (object.position) {
                object.position.y += breathAmount;
              }
              if (object.scale) {
                object.scale.y = 1 + breathAmount * 2;
              }
              breathingApplied = true;
            }
          }
        });
      }
      
      // If no appropriate bones found, use a morph target approach
      if (!breathingApplied && this.faceFeatures && this.morphTargetDictionary) {
        // Look for any morph target related to breathing
        for (const name in this.morphTargetDictionary) {
          if (name.toLowerCase().includes('breath') || 
              name.toLowerCase().includes('chest') || 
              name.toLowerCase().includes('inhale')) {
            const index = this.morphTargetDictionary[name];
            // Use absolute value of sin for natural breathing cycle
            this.faceFeatures.morphTargetInfluences[index] = Math.abs(Math.sin(this.breathingPhase));
            breathingApplied = true;
            break;
          }
        }
      }
      
      // Last resort: apply VERY subtle movement to the model position only if nothing else worked
      if (!breathingApplied) {
        // Apply extremely subtle shift that won't be noticeable at the landscape level
        const minimalBreathAmount = breathAmount * 0.001; // Drastically reduce the amount
        this.model.position.y += minimalBreathAmount;
      }
    }
  }

  /**
   * Set up webcam and face tracking
   */
  setupFaceTracking() {
    // Create video element for webcam
    this.video = document.createElement('video');
    this.video.style.display = 'none';
    document.body.appendChild(this.video);
    
    // Face detection configuration
    this.faceDetectionConfig = {
      video: this.video,
      scoreThreshold: 0.5,
      maxFaces: 1
    };
    
    // Start webcam and face tracking
    this.startWebcam();
  }

  /**
   * Start webcam and face tracking
   */
  async startWebcam() {
    try {
      // Check if MediaPipe is available
      if (typeof FaceMesh === 'undefined') {
        console.log('Loading MediaPipe FaceMesh...');
        await this.loadFaceMeshLibrary();
      }
      
      // Get webcam access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        }
      });
      
      this.video.srcObject = stream;
      this.video.play();
      
      // Wait for video to start playing
      await new Promise(resolve => {
        this.video.onloadedmetadata = () => {
          resolve();
        };
      });
      
      console.log('Webcam started successfully');
      
      // Initialize face mesh
      this.setupFaceMesh();
      
    } catch (error) {
      console.error('Error starting webcam:', error);
      // Continue without webcam if it fails
      alert('Could not access webcam. The avatar will use simple animations instead.');
    }
  }

  /**
   * Load MediaPipe FaceMesh library dynamically
   */
  async loadFaceMeshLibrary() {
    return new Promise((resolve, reject) => {
      // Load MediaPipe libraries
      const script1 = document.createElement('script');
      script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js';
      
      script1.onload = () => {
        const script2 = document.createElement('script');
        script2.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/face-landmarks-detection@0.0.3/dist/face-landmarks-detection.js';
        
        script2.onload = () => {
          console.log('MediaPipe libraries loaded');
          resolve();
        };
        
        script2.onerror = (error) => {
          console.error('Error loading TensorFlow face-landmarks:', error);
          reject(error);
        };
        
        document.head.appendChild(script2);
      };
      
      script1.onerror = (error) => {
        console.error('Error loading MediaPipe face_mesh:', error);
        reject(error);
      };
      
      document.head.appendChild(script1);
    });
  }

  /**
   * Setup MediaPipe Face Mesh
   */
  async setupFaceMesh() {
    try {
      // Initialize face landmarks detector
      this.faceMesh = await faceLandmarksDetection.load(
        faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
        { maxFaces: 1 }
      );
      
      console.log('FaceMesh initialized successfully');
      
      // Start tracking
      this.isTrackingFace = true;
      this.updateFaceTracking();
      
    } catch (error) {
      console.error('Error setting up FaceMesh:', error);
    }
  }

  /**
   * Process face tracking results and apply to avatar
   */
  async updateFaceTracking() {
    if (!this.isTrackingFace || !this.faceMesh || !this.video || !this.video.videoWidth) {
      // Skip if tracking is disabled or not ready
      requestAnimationFrame(() => this.updateFaceTracking());
      return;
    }
    
    try {
      // Detect face landmarks
      const predictions = await this.faceMesh.estimateFaces({
        input: this.video
      });
      
      if (predictions.length > 0) {
        // Process first face only
        const face = predictions[0];
        
        // Extract key points
        // Note: Different systems use different landmark indices
        // These are for MediaPipe Face Mesh
        
        // Map face landmarks to blend shapes
        this.mapFaceLandmarksToBlendShapes(face);
        
        // Show the "speaking" effect when mouth is open
        if (document.getElementById('avatarShimmer')) {
          if (this.blendShapes.jawOpen > 0.3) {
            document.getElementById('avatarShimmer').classList.add('active');
          } else {
            document.getElementById('avatarShimmer').classList.remove('active');
          }
        }
      }
      
      // Continue tracking loop
      requestAnimationFrame(() => this.updateFaceTracking());
      
    } catch (error) {
      console.error('Error in face tracking:', error);
      requestAnimationFrame(() => this.updateFaceTracking());
    }
  }

  /**
   * Map face landmarks to blend shapes
   * @param {Object} face - Face data from FaceMesh
   */
  mapFaceLandmarksToBlendShapes(face) {
    if (!face.scaledMesh || !this.faceFeatures) return;
    
    const landmarks = face.scaledMesh;
    const blendShapes = {};
    
    // Get normalized coordinates
    const normalizedLandmarks = this.normalizeCoordinates(landmarks);
    
    // Calculate mouth openness (vertical distance between upper and lower lip)
    // Upper lip: point 13
    // Lower lip: point 14
    const upperLip = normalizedLandmarks[13] || { y: 0 };
    const lowerLip = normalizedLandmarks[14] || { y: 0 };
    const mouthHeight = Math.abs(lowerLip.y - upperLip.y);
    const mouthOpen = Math.min(1, mouthHeight * 10); // Scale appropriately
    
    // Calculate eye openness
    // Left eye: upper = 386, lower = 374
    // Right eye: upper = 159, lower = 145
    const leftEyeUpper = normalizedLandmarks[386] || { y: 0 };
    const leftEyeLower = normalizedLandmarks[374] || { y: 0 };
    const rightEyeUpper = normalizedLandmarks[159] || { y: 0 };
    const rightEyeLower = normalizedLandmarks[145] || { y: 0 };
    
    const leftEyeOpen = 1 - Math.min(1, Math.abs(leftEyeUpper.y - leftEyeLower.y) * 10);
    const rightEyeOpen = 1 - Math.min(1, Math.abs(rightEyeUpper.y - rightEyeLower.y) * 10);
    
    // Calculate eyebrow positions
    // Left eyebrow: 282
    // Right eyebrow: 52
    // Eye center left: 468
    // Eye center right: 473
    const leftEyebrow = normalizedLandmarks[282] || { y: 0 };
    const rightEyebrow = normalizedLandmarks[52] || { y: 0 };
    const leftEyeCenter = normalizedLandmarks[468] || { y: 0 };
    const rightEyeCenter = normalizedLandmarks[473] || { y: 0 };
    
    const leftEyebrowRaise = Math.min(1, Math.max(0, (leftEyeCenter.y - leftEyebrow.y) * 10));
    const rightEyebrowRaise = Math.min(1, Math.max(0, (rightEyeCenter.y - rightEyebrow.y) * 10));
    
    // Calculate smile
    // Mouth corners: left = 61, right = 291
    const leftCorner = normalizedLandmarks[61] || { x: 0, y: 0 };
    const rightCorner = normalizedLandmarks[291] || { x: 0, y: 0 };
    const mouthCenter = { 
      y: (upperLip.y + lowerLip.y) / 2 
    };
    
    const smileAmount = Math.min(1, Math.max(0, 
      ((leftCorner.y - mouthCenter.y) + (rightCorner.y - mouthCenter.y)) * 5
    ));
    
    // Set blend shapes
    blendShapes.eyeBlinkLeft = leftEyeOpen;
    blendShapes.eyeBlinkRight = rightEyeOpen;
    blendShapes.jawOpen = mouthOpen;
    blendShapes.browInnerUp = (leftEyebrowRaise + rightEyebrowRaise) / 2;
    blendShapes.browOuterUpLeft = leftEyebrowRaise;
    blendShapes.browOuterUpRight = rightEyebrowRaise;
    blendShapes.mouthSmile = smileAmount;
    
    // Calculate head rotation from face orientation
    if (face.boundingBox && this.headBone) {
      const box = face.boundingBox;
      const centerX = (box.topLeft[0] + box.bottomRight[0]) / 2;
      const centerY = (box.topLeft[1] + box.bottomRight[1]) / 2;
      
      // Normalize to -1 to 1 range based on video dimensions
      const normalizedX = (centerX / this.video.videoWidth) * 2 - 1;
      const normalizedY = (centerY / this.video.videoHeight) * 2 - 1;
      
      // Apply to head rotation with dampening, but prevent looking up
      gsap.to(this.headBone.rotation, {
        x: Math.min(0, -normalizedY * 0.3), // Only allow downward tilt, no looking up
        y: normalizedX * 0.3,  // Yaw (left/right)
        duration: 0.3,
        ease: "power2.out"
      });
    }
    
    // Apply blend shapes
    this.blendShapes = blendShapes;
    this.mapBlendShapesToMorphTargets(blendShapes);
  }

  /**
   * Normalize landmark coordinates
   * @param {Array} landmarks - Face landmark points
   * @returns {Array} - Normalized landmarks
   */
  normalizeCoordinates(landmarks) {
    // Find min and max values to normalize
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    
    landmarks.forEach(point => {
      minX = Math.min(minX, point[0]);
      maxX = Math.max(maxX, point[0]);
      minY = Math.min(minY, point[1]);
      maxY = Math.max(maxY, point[1]);
      minZ = Math.min(minZ, point[2]);
      maxZ = Math.max(maxZ, point[2]);
    });
    
    // Normalize coordinates to 0-1 range
    return landmarks.map(point => ({
      x: (point[0] - minX) / (maxX - minX),
      y: (point[1] - minY) / (maxY - minY),
      z: (point[2] - minZ) / (maxZ - minZ)
    }));
  }

  /**
   * Map blend shapes to morph targets
   * @param {Object} blendShapes - Facial expressions to apply
   */
  mapBlendShapesToMorphTargets(blendShapes) {
    for (const [morphName, value] of Object.entries(blendShapes)) {
      if (this.morphTargetDictionary[morphName] !== undefined) {
        const index = this.morphTargetDictionary[morphName];
        this.faceFeatures.morphTargetInfluences[index] = value;
      }
    }
  }

  /**
   * Reset all facial expressions to neutral
   */
  resetExpressions() {
    if (!this.faceFeatures || !this.morphTargetDictionary) return;
    
    // Reset all morph targets to 0 or default values
    for (const key in this.morphTargetDictionary) {
      const index = this.morphTargetDictionary[key];
      
      // Set default value based on type of morph
      let defaultValue = 0;
      
      // Keep a slight smile for pleasant default expression
      if (key.toLowerCase().includes('smile')) {
        defaultValue = 0.1;
      }
      
      this.faceFeatures.morphTargetInfluences[index] = defaultValue;
    }
  }

  /**
   * Direct mouth animation system - more reliable than morph targets
   * This will be used if morph targets aren't working
   */
  setupDirectMouthAnimation() {
    // Create a simple mouth object if none exists
    if (!this.mouthObject) {
      // Try to find an existing mouth mesh
      let foundMouth = false;
      this.model.traverse((object) => {
        if (object.isMesh && 
            (object.name.toLowerCase().includes('mouth') || 
             object.name.toLowerCase().includes('lip'))) {
          this.mouthObject = object;
          foundMouth = true;
          console.log("Found mouth mesh:", object.name);
        }
      });
      
      // If no mouth mesh found, create one
      if (!foundMouth) {
        // Create a simple red ellipse to represent the mouth
        const mouthGeometry = new THREE.EllipseGeometry(0.1, 0.05, 32);
        const mouthMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xff0000,
          transparent: true,
          opacity: 0.7
        });
        this.mouthObject = new THREE.Mesh(mouthGeometry, mouthMaterial);
        
        // Position in front of the head
        this.mouthObject.position.set(0, -0.1, 0.55);
        this.mouthObject.rotation.set(0, 0, 0);
        this.mouthObject.scale.set(1, 0.1, 1); // Start nearly closed
        
        // Add to head if possible
        if (this.headBone) {
          this.headBone.add(this.mouthObject);
          console.log("Added artificial mouth to head bone");
        } else {
          this.model.add(this.mouthObject);
          this.mouthObject.position.y += 0.7; // Position higher if not attached to head
          console.log("Added artificial mouth to model");
        }
      }
    }
    
    console.log("Direct mouth animation system ready");
    this.usesDirectMouthAnimation = true;
  }
  
  /**
   * Apply direct mouth animation instead of morph targets
   * @param {number} value - mouth open value (0-1)
   */
  applyDirectMouthAnimation(value) {
    if (!this.mouthObject) return;
    
    // Update mouth shape based on value
    // For a simple ellipse, we just scale the Y axis to "open" the mouth
    const minHeight = 0.1; // Minimum scale when closed
    const maxHeight = 1.0; // Maximum scale when fully open
    
    // Calculate new Y scale
    const newYScale = minHeight + (value * (maxHeight - minHeight));
    
    // Apply scale
    this.mouthObject.scale.y = newYScale;
  }
}

// Add this function to map phoneme-like sounds to mouth shapes
function updateVisemeShapes(openValue) {
  // Apply different mouth shapes based on the current speech pattern
  
  // Simple mapping: high openValue = vowel, low = consonant
  if (avatar.morphTargets) {
    // Primary mouth open shape
    if (avatar.morphTargets.mouthOpen) {
      avatar.morphTargets.mouthOpen.morphTargetInfluences[avatar.morphTargets.mouthOpen.index] = openValue;
    }
    
    // Add some lip rounding for certain sounds (like "O")
    const lipRoundAmount = Math.sin(Date.now() * 0.003) * 0.5 + 0.5; // Oscillate for variety
    if (openValue > 0.3 && avatar.morphTargets.mouthRound) {
      avatar.morphTargets.mouthRound.morphTargetInfluences[avatar.morphTargets.mouthRound.index] = 
        openValue * 0.5 * lipRoundAmount; // Apply partial rounding
    }
    
    // Add some smiling throughout speech for friendly appearance
    if (avatar.morphTargets.mouthSmile) {
      const smileAmount = 0.2 + Math.sin(Date.now() * 0.001) * 0.1; // Small smile variation
      avatar.morphTargets.mouthSmile.morphTargetInfluences[avatar.morphTargets.mouthSmile.index] = smileAmount;
    }
  }
} 