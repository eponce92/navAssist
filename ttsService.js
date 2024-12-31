async function textToSpeech(text, voiceId) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('API key not found');
  }

  const model = await getSelectedModel();
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate speech: ${errorText}`);
    }

    // Create a new Audio context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const reader = response.body.getReader();
    const chunks = [];

    // Read the stream
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine all chunks into a single Uint8Array
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const audioData = new Uint8Array(totalLength);
    let position = 0;
    for (const chunk of chunks) {
      audioData.set(chunk, position);
      position += chunk.length;
    }

    // Decode the audio data
    const audioBuffer = await audioContext.decodeAudioData(audioData.buffer);
    
    // Create source and connect to destination
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    // Start playing
    source.start(0);

    return source; // Return the audio source for control (stop, etc.)
  } catch (error) {
    console.error('Error in textToSpeech:', error);
    throw error;
  }
}

async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('elevenLabsApiKey', (data) => {
      resolve(data.elevenLabsApiKey);
    });
  });
}

async function getSelectedModel() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('selectedTTSModel', (data) => {
      resolve(data.selectedTTSModel || 'eleven_monolingual_v1');
    });
  });
}

// TTS cache using IndexedDB
const TTS_CACHE_DB = 'ttsCache';
const TTS_CACHE_STORE = 'audioData';
const TTS_CACHE_VERSION = 1;

let ttsDb = null;

// Initialize IndexedDB for TTS cache
async function initTTSCache() {
  if (ttsDb) return ttsDb;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TTS_CACHE_DB, TTS_CACHE_VERSION);
    
    request.onerror = () => {
      console.error('Failed to open TTS cache database');
      reject(request.error);
    };
    
    request.onsuccess = (event) => {
      ttsDb = event.target.result;
      resolve(ttsDb);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(TTS_CACHE_STORE)) {
        db.createObjectStore(TTS_CACHE_STORE, { keyPath: 'text' });
      }
    };
  });
}

// Check if audio exists in cache
async function getFromTTSCache(text) {
  try {
    if (!ttsDb) await initTTSCache();
    
    return new Promise((resolve, reject) => {
      const transaction = ttsDb.transaction([TTS_CACHE_STORE], 'readonly');
      const store = transaction.objectStore(TTS_CACHE_STORE);
      const request = store.get(text);
      
      request.onsuccess = () => {
        resolve(request.result?.audioData || null);
      };
      
      request.onerror = () => {
        console.error('Error reading from TTS cache');
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error accessing TTS cache:', error);
    return null;
  }
}

// Save audio to cache
async function saveToTTSCache(text, audioData) {
  try {
    if (!ttsDb) await initTTSCache();
    
    return new Promise((resolve, reject) => {
      const transaction = ttsDb.transaction([TTS_CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(TTS_CACHE_STORE);
      const request = store.put({ text, audioData });
      
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Error saving to TTS cache');
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error saving to TTS cache:', error);
  }
}

// SVG icons for TTS buttons
const SPEAKER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
</svg>`;

const PLAY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="5 3 19 12 5 21 5 3"></polygon>
</svg>`;

const STOP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="4" y="4" width="16" height="16"></rect>
</svg>`;

// Keep track of currently playing audio
let currentAudio = null;
let currentButton = null;

// Stop current audio if playing
function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
    
    if (currentButton) {
      const isCached = currentButton.dataset.cached === 'true';
      currentButton.innerHTML = isCached ? PLAY_ICON : SPEAKER_ICON;
      currentButton.title = isCached ? 'Play cached audio' : 'Generate speech';
      currentButton.classList.remove('playing');
      currentButton = null;
    }
  }
}

// Check if text is in cache without retrieving the audio data
async function isInTTSCache(text) {
  try {
    console.log('🔍 Checking if text exists in TTS cache...');
    if (!ttsDb) {
      console.log('📂 Initializing TTS cache database...');
      await initTTSCache();
    }
    
    return new Promise((resolve) => {
      const transaction = ttsDb.transaction([TTS_CACHE_STORE], 'readonly');
      const store = transaction.objectStore(TTS_CACHE_STORE);
      const request = store.count(text);
      
      request.onsuccess = () => {
        const exists = request.result > 0;
        console.log(exists ? '✅ Text found in cache' : '❌ Text not in cache');
        resolve(exists);
      };
      
      request.onerror = () => {
        console.error('❌ Error checking TTS cache');
        resolve(false);
      };
    });
  } catch (error) {
    console.error('❌ Error accessing TTS cache:', error);
    return false;
  }
}

// Update button icon based on cache status
async function updateTTSButton(button, text) {
  console.log('🔄 Updating TTS button icon...');
  const isCached = await isInTTSCache(text);
  button.innerHTML = isCached ? PLAY_ICON : SPEAKER_ICON;
  button.title = isCached ? 'Play cached audio' : 'Generate speech';
  button.dataset.cached = isCached ? 'true' : 'false';
  console.log(`🎯 Button updated to ${isCached ? 'PLAY' : 'SPEAKER'} icon`);
}

// Modified playTTS function with stop functionality
async function playTTS(text, messageElement) {
  if (!text || text.trim() === '') {
    console.log('❌ No text provided for TTS');
    return;
  }
  
  // Get the actual text content from the message element
  const messageContent = messageElement.querySelector('.message-content');
  if (messageContent) {
    text = messageContent.textContent.trim();
  }
  
  if (!text) {
    console.log('❌ No text found in message content');
    return;
  }
  
  console.log('🎵 Starting TTS process for:', text.substring(0, 50) + '...');
  
  // Find the TTS button in the message element
  const ttsButton = messageElement.querySelector('.tts-button');
  if (!ttsButton) {
    console.error('❌ TTS button not found in message element');
    return;
  }

  // If this button is currently playing, stop it
  if (ttsButton === currentButton) {
    stopCurrentAudio();
    return;
  }

  // Stop any other playing audio
  stopCurrentAudio();
  
  try {
    // Check cache first
    console.log('🔍 Checking TTS cache...');
    const cachedAudio = await getFromTTSCache(text);
    if (cachedAudio) {
      console.log('💾 Found cached audio! Using it...');
      // Update button to stop icon
      ttsButton.innerHTML = STOP_ICON;
      ttsButton.title = 'Stop playback';
      ttsButton.dataset.cached = 'true';
      console.log('🔄 Updated button to STOP icon');
      
      const audio = new Audio(cachedAudio);
      console.log('▶️ Playing cached audio...');
      
      // Set as current audio
      currentAudio = audio;
      currentButton = ttsButton;
      
      // Add playing state
      ttsButton.classList.add('playing');
      
      audio.onended = () => {
        ttsButton.classList.remove('playing');
        ttsButton.innerHTML = PLAY_ICON;
        ttsButton.title = 'Play cached audio';
        currentAudio = null;
        currentButton = null;
      };
      
      await audio.play();
      return;
    }
    
    console.log('🌐 No cache found, making API call to ElevenLabs...');
    // If not in cache, show stop icon and loading state
    ttsButton.innerHTML = STOP_ICON;
    ttsButton.title = 'Stop generation';
    ttsButton.dataset.cached = 'false';
    ttsButton.classList.add('loading');
    console.log('🔄 Updated button to STOP icon with loading state');
    
    // Set as current button
    currentButton = ttsButton;
    
    // Get API key and model
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error('No API key found');
    }
    const model = await getSelectedModel();
    console.log('🔑 Using model:', model);
    
    // Get voice ID from storage
    const voiceId = await new Promise((resolve) => {
      chrome.storage.sync.get('selectedVoiceId', (data) => {
        resolve(data.selectedVoiceId || 'pNInz6obpgDQGcFmaJgB'); // Default voice
      });
    });
    console.log('🎤 Using voice ID:', voiceId);
    
    // Make API call
    console.log('📡 Sending request to ElevenLabs API...');
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`TTS API call failed: ${errorData.detail || response.statusText}`);
    }
    
    console.log('✅ Received audio from API');
    // Convert response to base64 for storage
    const audioBlob = await response.blob();
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    
    reader.onloadend = async () => {
      const base64Audio = reader.result;
      // Save to cache
      console.log('💾 Saving audio to cache...');
      await saveToTTSCache(text, base64Audio);
      console.log('✅ Audio saved to cache successfully');
      
      // Update button to stop icon
      ttsButton.innerHTML = STOP_ICON;
      ttsButton.title = 'Stop playback';
      ttsButton.classList.remove('loading');
      ttsButton.dataset.cached = 'true';
      console.log('🔄 Updated button to STOP icon');
      
      // Play the audio
      console.log('▶️ Playing new audio...');
      const audio = new Audio(base64Audio);
      
      // Set as current audio
      currentAudio = audio;
      
      audio.onended = () => {
        ttsButton.classList.remove('playing');
        ttsButton.innerHTML = PLAY_ICON;
        ttsButton.title = 'Play cached audio';
        currentAudio = null;
        currentButton = null;
      };
      
      ttsButton.classList.add('playing');
      await audio.play();
    };
    
  } catch (error) {
    console.error('❌ Error in TTS playback:', error);
    // Show error message to user
    const errorDiv = document.createElement('div');
    errorDiv.className = 'tts-error';
    errorDiv.textContent = 'Failed to play audio. Please try again.';
    messageElement.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
    
    // Reset button to initial state
    const isCached = ttsButton.dataset.cached === 'true';
    ttsButton.innerHTML = isCached ? PLAY_ICON : SPEAKER_ICON;
    ttsButton.title = isCached ? 'Play cached audio' : 'Generate speech';
    ttsButton.classList.remove('loading', 'playing');
    currentButton = null;
    console.log('🔄 Reset button to initial state due to error');
  }
}

export default {
  textToSpeech,
  getApiKey,
  getSelectedModel,
  initTTSCache,
  getFromTTSCache,
  saveToTTSCache,
  playTTS,
  updateTTSButton,
  isInTTSCache,
  // Export icons for use in UI
  SPEAKER_ICON,
  PLAY_ICON,
  STOP_ICON,
};
