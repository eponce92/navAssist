// Constants
const SPEAKER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
const STOP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg>`;
const PLAY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;

let currentAudio = null;
let currentButton = null;
let db = null;
let audioContext = null;
let audioQueue = [];
let isPlaying = false;
let sourceNode = null;
let mediaSource = null;
let sourceBuffer = null;
let audioElement = null;
let pendingChunks = [];

// Initialize IndexedDB
async function initDB() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TTS_DB', 1);
    
    request.onerror = () => {
      console.error('Failed to open database:', request.error);
      reject(request.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('audioCache')) {
        const store = db.createObjectStore('audioCache', { keyPath: 'text' });
        store.createIndex('timestamp', 'timestamp');
      }
    };
    
    request.onsuccess = () => {
      db = request.result;
      console.log('✅ Database initialized successfully');
      
      // Handle database errors
      db.onerror = (event) => {
        console.error('Database error:', event.target.error);
      };
      
      resolve(db);
    };
  });
}

async function saveToCache(text, audioBlob) {
  try {
    console.log('💾 Attempting to save audio to cache...');
    const database = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['audioCache'], 'readwrite');
      const store = transaction.objectStore('audioCache');
      
      // First check if it exists
      const getRequest = store.get(text);
      
      getRequest.onsuccess = () => {
        if (getRequest.result) {
          console.log('⚠️ Audio already exists in cache, skipping save');
          resolve();
          return;
        }
        
        // If it doesn't exist, save it
        const putRequest = store.put({
          text,
          audioBlob,
          timestamp: Date.now()
        });
        
        putRequest.onsuccess = () => {
          console.log('✅ Audio saved to cache successfully');
          resolve();
        };
        
        putRequest.onerror = () => {
          console.error('Error saving to cache:', putRequest.error);
          reject(putRequest.error);
        };
      };
      
      getRequest.onerror = () => {
        console.error('Error checking cache:', getRequest.error);
        reject(getRequest.error);
      };
      
      transaction.oncomplete = () => {
        console.log('💾 Cache transaction completed');
      };
    });
  } catch (error) {
    console.error('Error in saveToCache:', error);
    throw error;
  }
}

async function getFromCache(text) {
  try {
    console.log('🔍 Checking cache for text:', text.substring(0, 50) + '...');
    const database = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['audioCache'], 'readonly');
      const store = transaction.objectStore('audioCache');
      const request = store.get(text);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result?.audioBlob) {
          console.log('✅ Found audio in cache');
          resolve(result.audioBlob);
        } else {
          console.log('❌ Audio not found in cache');
          resolve(null);
        }
      };
      
      request.onerror = () => {
        console.error('Error reading from cache:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error in getFromCache:', error);
    return null;
  }
}

async function isInTTSCache(text) {
  try {
    const database = await initDB();
    
    return new Promise((resolve) => {
      const transaction = database.transaction(['audioCache'], 'readonly');
      const store = transaction.objectStore('audioCache');
      const request = store.get(text);
      
      request.onsuccess = () => {
        const exists = !!request.result?.audioBlob;
        console.log(`🔍 Cache check: ${exists ? 'Found' : 'Not found'} in cache`);
        resolve(exists);
      };
      
      request.onerror = () => {
        console.error('Error checking cache:', request.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error('Error in isInTTSCache:', error);
    return false;
  }
}

function updateTTSButton(button, text) {
  isInTTSCache(text).then(isCached => {
    button.innerHTML = isCached ? PLAY_ICON : SPEAKER_ICON;
    button.title = isCached ? 'Play cached audio' : 'Generate speech';
    button.dataset.cached = isCached ? 'true' : 'false';
  });
}

function stopCurrentAudio() {
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement = null;
  }
  
  if (mediaSource && mediaSource.readyState === 'open') {
    mediaSource.endOfStream();
  }
  
  mediaSource = null;
  sourceBuffer = null;
  pendingChunks = [];
  
  if (currentButton) {
    currentButton.innerHTML = PLAY_ICON;
    currentButton.classList.remove('playing');
    currentButton = null;
  }
}

async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('elevenLabsApiKey', (data) => {
      resolve(data.elevenLabsApiKey);
    });
  });
}

async function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

async function processAudioChunk(chunk) {
  const audioContext = await initAudioContext();
  const arrayBuffer = await chunk.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

async function playNextInQueue() {
  if (!isPlaying && audioQueue.length > 0) {
    isPlaying = true;
    const audioBuffer = audioQueue.shift();
    
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(audioContext.destination);
    
    sourceNode.onended = () => {
      isPlaying = false;
      playNextInQueue();
    };
    
    sourceNode.start(0);
  }
}

async function playTTS(text, messageElement) {
  console.log('🎵 Starting TTS process for:', text.substring(0, 50) + '...');
  
  const button = messageElement.querySelector('.tts-button');
  if (!button) return;
  
  // If this is the current playing audio, stop it
  if (currentButton === button) {
    stopCurrentAudio();
    return;
  }
  
  // Stop any currently playing audio
  stopCurrentAudio();
  
  // Set this as the current button
  currentButton = button;
  
  try {
    // Check if we already know it's cached from the button state
    const isCached = button.dataset.cached === 'true';
    let audioBlob = null;
    
    if (isCached) {
      console.log('🎯 Using known cached audio');
      audioBlob = await getFromCache(text);
      if (!audioBlob) {
        console.warn('⚠️ Cache mismatch, regenerating audio');
      }
    }
    
    if (!audioBlob) {
      console.log('🌐 Generating new audio...');
      
      // Update button to loading state
      button.innerHTML = STOP_ICON;
      button.classList.add('playing');
      console.log('🔄 Updated button to STOP icon with loading state');
      
      // Get API key
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('No API key found. Please set your ElevenLabs API key in the extension settings.');
      }
      
      // Get voice settings from storage
      const settings = await new Promise(resolve => {
        chrome.storage.sync.get(['selectedModel', 'selectedVoiceId'], resolve);
      });
      
      const model = settings.selectedModel || 'eleven_multilingual_v2';
      const voiceId = settings.selectedVoiceId || 'das1dbR89MGDgpWlvSBq';
      
      console.log('🔑 Using model:', model);
      console.log('🎤 Using voice ID:', voiceId);
      
      console.log('📡 Sending request to ElevenLabs API...');
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          },
          output_format: 'mp3_44100_128',
          optimize_streaming_latency: 3
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || response.statusText;
        console.error('API Error:', errorMessage);
        throw new Error(`TTS API call failed: ${errorMessage}`);
      }

      // Initialize streaming
      audioElement = new Audio();
      mediaSource = new MediaSource();
      audioElement.src = URL.createObjectURL(mediaSource);

      mediaSource.addEventListener('sourceopen', async () => {
        sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
        sourceBuffer.mode = 'sequence';
        
        // Handle sourceBuffer updates
        sourceBuffer.addEventListener('updateend', () => {
          if (pendingChunks.length > 0 && !sourceBuffer.updating) {
            const chunk = pendingChunks.shift();
            sourceBuffer.appendBuffer(chunk);
          }
        });

        // Start reading the stream
        const reader = response.body.getReader();
        const chunks = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            
            // Append chunk to source buffer if not updating
            if (!sourceBuffer.updating) {
              sourceBuffer.appendBuffer(value);
            } else {
              pendingChunks.push(value);
            }
          }

          // Combine chunks for caching
          audioBlob = new Blob(chunks, { type: 'audio/mpeg' });
          await saveToCache(text, audioBlob);
          button.dataset.cached = 'true';

          // End the stream
          mediaSource.endOfStream();
        } catch (error) {
          console.error('Error while streaming:', error);
          throw error;
        }
      });

      // Play the audio
      await audioElement.play();
      
    } else {
      // For cached audio, play it directly
      audioElement = new Audio(URL.createObjectURL(audioBlob));
      audioElement.addEventListener('ended', () => {
        button.innerHTML = PLAY_ICON;
        button.classList.remove('playing');
        currentButton = null;
      });
      await audioElement.play();
    }
    
    // Update button state
    button.innerHTML = STOP_ICON;
    console.log('🔄 Updated button to STOP icon');
    
  } catch (error) {
    console.error('Error in TTS playback:', error);
    button.innerHTML = SPEAKER_ICON;
    button.classList.remove('playing');
    currentButton = null;
    button.dataset.cached = 'false';
    
    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'tts-error';
    errorDiv.textContent = error.message || 'Failed to play audio. Please try again.';
    messageElement.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }
}

// Export everything as a default object
export default {
  SPEAKER_ICON,
  STOP_ICON,
  PLAY_ICON,
  isInTTSCache,
  updateTTSButton,
  playTTS
};
