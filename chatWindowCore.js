import utils from './utils.js';
import ttsService from './ttsService.js';

let chatWindow = null;

// TTS cache using IndexedDB
const TTS_CACHE_DB = 'ttsCache';
const TTS_CACHE_STORE = 'audioData';
const TTS_CACHE_VERSION = 1;

let ttsDb = null;

// Initialize IndexedDB for TTS cache
function initTTSCache() {
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
}

// Save audio to cache
async function saveToTTSCache(text, audioData) {
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
}

// Modified playTTS function with caching
async function playTTS(text, messageElement) {
  if (!text) return;
  
  try {
    // Check cache first
    const cachedAudio = await getFromTTSCache(text);
    if (cachedAudio) {
      console.log('Using cached TTS audio');
      const audio = new Audio(cachedAudio);
      audio.play();
      return;
    }
    
    // If not in cache, make API call
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/...', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text,
        // ... rest of the API call parameters ...
      })
    });
    
    if (!response.ok) throw new Error('TTS API call failed');
    
    // Convert response to base64 for storage
    const audioBlob = await response.blob();
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    
    reader.onloadend = async () => {
      const base64Audio = reader.result;
      // Save to cache
      await saveToTTSCache(text, base64Audio);
      
      // Play the audio
      const audio = new Audio(base64Audio);
      audio.play();
    };
    
  } catch (error) {
    console.error('Error in TTS playback:', error);
    // Show error message to user
    const errorDiv = document.createElement('div');
    errorDiv.className = 'tts-error';
    errorDiv.textContent = 'Failed to play audio. Please try again.';
    messageElement.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
  }
}

export function setChatWindow(window) {
  chatWindow = window;
}

function handleRuntimeError() {
  if (chrome.runtime.lastError) {
    console.error('Extension context invalidated, reloading page...');
    window.location.reload();
    return true;
  }
  return false;
}

export function sendMessage() {
  try {
    if (!chatWindow) {
      console.error('Chat window not initialized');
      return;
    }

    const messageInput = chatWindow.querySelector('#messageInput');
    const message = messageInput.value.trim();
    if (message) {
      console.log('Sending message:', message);
      addMessage('User', message);
      messageInput.value = '';
      messageInput.style.height = 'auto';
      
      const assistantMessageElement = addMessage('Assistant', '');
      const assistantMessageContent = assistantMessageElement.querySelector('.message-content');
      let accumulatedMarkdown = '';
      
      try {
        chrome.runtime.sendMessage({action: 'sendMessage', message: message}, function(response) {
          if (handleRuntimeError()) return;
          console.log('Message sent successfully, waiting for response');
        });

        const responseHandler = function(message) {
          try {
            if (message.action === 'streamResponse') {
              if (message.reply) {
                accumulatedMarkdown += message.reply;
                assistantMessageContent.innerHTML = utils.markdownToHtml(accumulatedMarkdown);
                const chatMessages = chatWindow.querySelector('#chatMessages');
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }

              if (message.done) {
                addMessageButtons(assistantMessageElement, accumulatedMarkdown);
                chrome.runtime.onMessage.removeListener(responseHandler);
              }
            }
          } catch (error) {
            console.error('Error in response handler:', error);
            chrome.runtime.onMessage.removeListener(responseHandler);
            window.location.reload();
          }
        };

        chrome.runtime.onMessage.addListener(responseHandler);
      } catch (error) {
        console.error('Error sending message:', error);
        assistantMessageContent.innerHTML = 'Error: Unable to send message. Please try again.';
        window.location.reload();
      }
    }
  } catch (error) {
    console.error('Error in sendMessage:', error);
    window.location.reload();
  }
}

export function addMessage(sender, text) {
  if (!chatWindow) {
    console.error('Chat window not initialized');
    return;
  }

  const chatMessages = chatWindow.querySelector('#chatMessages');
  const messageElement = document.createElement('div');
  messageElement.className = `message ${sender.toLowerCase()}-message`;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  messageContent.innerHTML = utils.markdownToHtml(text);
  
  messageElement.appendChild(messageContent);
  
  if (text) {
    if (sender === 'Assistant') {
      addMessageButtons(messageElement, text);
    } else {
      addCopyButton(messageElement, text);
    }
  }
  
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  return messageElement;
}

function addMessageButtons(messageElement, text) {
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'message-buttons';
  buttonContainer.style.position = 'absolute';
  buttonContainer.style.right = '8px';
  buttonContainer.style.bottom = '8px';
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '8px';
  
  const copyButton = createCopyButton();
  const copyFeedback = document.createElement('span');
  copyFeedback.className = 'copy-feedback';
  copyFeedback.textContent = 'Copied!';
  
  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(text).then(() => {
      copyButton.classList.add('copied');
      setTimeout(() => copyButton.classList.remove('copied'), 2000);
    });
  });

  const ttsButton = createTTSButton();
  const ttsFeedback = document.createElement('span');
  ttsFeedback.className = 'tts-feedback';
  ttsFeedback.textContent = 'Playing...';
  
  ttsButton.addEventListener('click', async () => {
    try {
      ttsButton.disabled = true;
      ttsButton.classList.add('playing');
      
      // Get voice ID from storage
      const voiceId = await new Promise((resolve) => {
        chrome.storage.sync.get('selectedVoiceId', (data) => {
          resolve(data.selectedVoiceId || '21m00Tcm4TlvDq8ikWAM'); // Default voice ID
        });
      });

      try {
        const audioSource = await ttsService.textToSpeech(text, voiceId);
        
        audioSource.onended = () => {
          ttsButton.disabled = false;
          ttsButton.classList.remove('playing');
        };
        
      } catch (error) {
        console.error('TTS error:', error);
        alert('Error generating speech. Please check your API key and try again.');
        ttsButton.disabled = false;
        ttsButton.classList.remove('playing');
      }
    } catch (error) {
      console.error('Error in TTS button click:', error);
      ttsButton.disabled = false;
      ttsButton.classList.remove('playing');
    }
  });
  
  buttonContainer.appendChild(copyButton);
  buttonContainer.appendChild(copyFeedback);
  buttonContainer.appendChild(ttsButton);
  buttonContainer.appendChild(ttsFeedback);
  messageElement.appendChild(buttonContainer);
}

function addCopyButton(messageElement, textToCopy) {
  const copyButton = createCopyButton();
  const copyFeedback = document.createElement('span');
  copyFeedback.className = 'copy-feedback';
  copyFeedback.textContent = 'Copied!';
  
  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      copyButton.classList.add('copied');
      setTimeout(() => copyButton.classList.remove('copied'), 2000);
    });
  });
  
  messageElement.appendChild(copyButton);
  messageElement.appendChild(copyFeedback);
}

function createCopyButton() {
  const button = document.createElement('button');
  button.className = 'copy-button';
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;
  button.title = 'Copy to clipboard';
  return button;
}

function createTTSButton() {
  const button = document.createElement('button');
  button.className = 'tts-button';
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
    </svg>
  `;
  button.title = 'Read aloud';
  return button;
}

export function applyTheme(isDarkTheme) {
  if (chatWindow) {
    const theme = isDarkTheme ? 'dark' : 'light';
    chatWindow.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    console.log('Theme applied to chatWindow:', theme);
    
    // Force a repaint to ensure the theme is applied
    chatWindow.style.display = 'none';
    chatWindow.offsetHeight; // Trigger a reflow
    chatWindow.style.display = 'flex';
    
    // Update specific elements
    updateElementColors(theme);
  }
}

function updateElementColors(theme) {
  const header = chatWindow.querySelector('#chatHeader');
  const messages = chatWindow.querySelectorAll('.message');
  const input = chatWindow.querySelector('#messageInput');
  const sendButton = chatWindow.querySelector('#sendMessage');

  // Use the same primary color for both themes
  header.style.backgroundColor = '#3F51B5';

  if (theme === 'dark') {
    input.style.backgroundColor = '#2C2C2C';
    input.style.color = '#E0E0E0';
    sendButton.style.backgroundColor = '#3F51B5';
  } else {
    input.style.backgroundColor = '#FFFFFF';
    input.style.color = '#333333';
    sendButton.style.backgroundColor = '#3F51B5';
  }

  messages.forEach(message => {
    if (message.classList.contains('user-message')) {
      message.style.backgroundColor = theme === 'dark' ? '#303F9F' : '#E8EAF6';
    } else {
      message.style.backgroundColor = theme === 'dark' ? '#2C2C2C' : '#F5F5F5';
    }
    message.style.color = theme === 'dark' ? '#E0E0E0' : '#333333';
  });
}

export function summarizePageContent() {
  try {
    console.log('Summarizing page content');
    const assistantMessageElement = addMessage('Assistant', 'Summarizing page content...');
    const assistantMessageContent = assistantMessageElement.querySelector('.message-content');
    let accumulatedSummary = '';
    
    chrome.runtime.sendMessage({action: 'summarizeContent'}, function(response) {
      if (handleRuntimeError()) return;
    });

    const summaryHandler = function(message) {
      try {
        if (message.action === 'streamResponse') {
          if (message.reply) {
            accumulatedSummary += message.reply;
            assistantMessageContent.innerHTML = utils.markdownToHtml(accumulatedSummary);
            const chatMessages = chatWindow.querySelector('#chatMessages');
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }

          if (message.done) {
            addMessageButtons(assistantMessageElement, accumulatedSummary);
            chrome.runtime.onMessage.removeListener(summaryHandler);
          }
        }
      } catch (error) {
        console.error('Error in summary handler:', error);
        chrome.runtime.onMessage.removeListener(summaryHandler);
        window.location.reload();
      }
    };

    chrome.runtime.onMessage.addListener(summaryHandler);
  } catch (error) {
    console.error('Error in summarizePageContent:', error);
    window.location.reload();
  }
}

export function restartChat() {
  try {
    console.log('Restarting chat');
    const chatMessages = chatWindow.querySelector('#chatMessages');
    chatMessages.innerHTML = '';
    chrome.runtime.sendMessage({action: 'clearChatHistory'}, response => {
      if (handleRuntimeError()) return;
      if (!response?.success) {
        console.error('Failed to clear chat history');
      }
    });
  } catch (error) {
    console.error('Error in restartChat:', error);
    window.location.reload();
  }
}

export function updateSendButton() {
  const sendButton = chatWindow.querySelector('#sendMessage');
  if (sendButton) {
    sendButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    `;
    sendButton.style.display = 'flex';
    sendButton.style.alignItems = 'center';
    sendButton.style.justifyContent = 'center';
  }
}

function initializeMessageInput() {
  const messageInput = document.getElementById('messageInput');
  
  messageInput.addEventListener('input', function() {
    // Reset height to auto to get the right scrollHeight
    this.style.height = '40px';
    
    // Set height based on content
    const newHeight = Math.min(this.scrollHeight, 150);
    this.style.height = newHeight + 'px';
    
    // Toggle expanded state for scrollbar
    this.setAttribute('data-expanded', newHeight >= 150 ? 'true' : 'false');
  });
}

export function createChatWindow() {
  // ... existing code ...
  initializeMessageInput();
  // ... rest of the function
}

async function handleTTSClick(button, text) {
  try {
    button.classList.add('playing');
    button.querySelector('svg').innerHTML = `
      <circle cx="12" cy="12" r="10" />
      <rect x="9" y="9" width="2" height="6" />
      <rect x="13" y="9" width="2" height="6" />
    `;

    // Get voice ID from storage
    const voiceId = await new Promise((resolve) => {
      chrome.storage.sync.get('selectedVoiceId', (data) => {
        resolve(data.selectedVoiceId || '21m00Tcm4TlvDq8ikWAM'); // Default voice ID
      });
    });

    const audioSource = await ttsService.textToSpeech(text, voiceId);
    
    // When audio finishes
    audioSource.onended = () => {
      button.classList.remove('playing');
      button.querySelector('svg').innerHTML = `
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      `;
    };

  } catch (error) {
    console.error('Error playing TTS:', error);
    button.classList.remove('playing');
    button.querySelector('svg').innerHTML = `
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    `;
    throw error;
  }
}

export default {
  setChatWindow,
  sendMessage,
  summarizePageContent,
  restartChat,
  applyTheme,
  addMessage,
  updateSendButton,
};
