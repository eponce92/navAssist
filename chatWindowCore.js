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
    console.error('Extension context error:', chrome.runtime.lastError.message);
    // Instead of reloading, try to recover
    if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
      console.log('Extension context invalidated, attempting to recover...');
      // Notify user
      const errorMessage = addMessage('System', 'Connection to extension lost. Please refresh the page to reconnect.');
      return true;
    }
  }
  return false;
}

// Add message ID tracking
let messageCounter = 0;

async function addMessage(role, content) {
  console.log('📝 Adding message:', { role, content });
  
  const chatMessages = chatWindow.querySelector('#chatMessages');
  if (!chatMessages) {
    console.error('❌ Chat messages container not found');
    return null;
  }

  try {
    // Create message element with unique ID
    const messageDiv = document.createElement('div');
    const messageId = `msg-${Date.now()}-${messageCounter++}`;
    messageDiv.id = messageId;
    messageDiv.className = `message ${role.toLowerCase()}-message`;
    
    // Create message content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    // Assemble message
    messageDiv.appendChild(contentDiv);
    
    // Add to chat
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    console.log('✅ Message added successfully with ID:', messageId);
    return messageDiv;
  } catch (error) {
    console.error('❌ Error adding message:', error);
    return null;
  }
}

function addMessageButtons(messageElement, text) {
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'message-buttons';
  buttonContainer.style.position = 'absolute';
  buttonContainer.style.right = '8px';
  buttonContainer.style.bottom = '8px';
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '8px';
  
  // Add copy button
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
  
  // Add TTS button for assistant messages only
  if (messageElement.classList.contains('assistant-message') && text) {
    console.log('🎤 Setting up TTS button');
    const ttsButton = document.createElement('button');
    ttsButton.className = 'tts-button';
    ttsButton.dataset.messageId = messageElement.id;
    
    // Set initial icon based on cache
    ttsService.updateTTSButton(ttsButton, text);
    
    // Add click handler
    ttsButton.addEventListener('click', async () => {
      console.log('🎵 TTS button clicked for message:', messageElement.id);
      await ttsService.playTTS(text, messageElement);
    });
    
    const ttsFeedback = document.createElement('span');
    ttsFeedback.className = 'tts-feedback';
    ttsFeedback.textContent = 'Playing...';
    
    buttonContainer.appendChild(ttsButton);
    buttonContainer.appendChild(ttsFeedback);
  }
  
  buttonContainer.appendChild(copyButton);
  buttonContainer.appendChild(copyFeedback);
  messageElement.appendChild(buttonContainer);
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

export async function summarizePageContent() {
  try {
    console.log('Summarizing page content');
    
    // Create assistant message with loading text
    const assistantMessageElement = await addMessage('Assistant', 'Summarizing page content...');
    if (!assistantMessageElement) {
      console.error('Failed to create assistant message element');
      return;
    }
    
    // Find the content div
    const contentDiv = assistantMessageElement.querySelector('.message-content');
    if (!contentDiv) {
      console.error('Message content element not found');
      return;
    }
    
    let accumulatedSummary = '';
    
    chrome.runtime.sendMessage({action: 'summarizeContent'}, function(response) {
      if (handleRuntimeError()) {
        contentDiv.textContent = 'Error: Connection lost. Please refresh the page.';
        return;
      }
      console.log('Summary request sent, waiting for response');
    });

    const summaryHandler = function(message) {
      try {
        if (message.action === 'streamResponse') {
          if (message.reply) {
            accumulatedSummary += message.reply;
            contentDiv.innerHTML = utils.markdownToHtml(accumulatedSummary);
            const chatMessages = chatWindow.querySelector('#chatMessages');
            if (chatMessages) {
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
          }

          if (message.done) {
            // Update final content
            contentDiv.innerHTML = utils.markdownToHtml(accumulatedSummary);
            
            // Add buttons
            addMessageButtons(assistantMessageElement, accumulatedSummary);
            
            // Update TTS button if present
            const ttsButton = assistantMessageElement.querySelector('.tts-button');
            if (ttsButton) {
              ttsService.updateTTSButton(ttsButton, accumulatedSummary);
            }
            
            chrome.runtime.onMessage.removeListener(summaryHandler);
          }
        }
      } catch (error) {
        console.error('Error in summary handler:', error);
        chrome.runtime.onMessage.removeListener(summaryHandler);
        contentDiv.textContent = 'Error: Failed to process summary. Please try again.';
      }
    };

    chrome.runtime.onMessage.addListener(summaryHandler);
  } catch (error) {
    console.error('Error in summarizePageContent:', error);
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

export async function sendMessage() {
  try {
    if (!chatWindow) {
      console.error('Chat window not initialized');
      return;
    }

    const messageInput = chatWindow.querySelector('#messageInput');
    if (!messageInput) {
      console.error('Message input not found');
      return;
    }

    const message = messageInput.value.trim();
    if (!message) {
      return;
    }

    console.log('Sending message:', message);
    
    // Create user message
    const userMessageElement = await addMessage('User', message);
    if (!userMessageElement) {
      console.error('Failed to create user message element');
      return;
    }
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Create assistant message with empty content
    const assistantMessageElement = await addMessage('Assistant', '');
    if (!assistantMessageElement) {
      console.error('Failed to create assistant message element');
      return;
    }
    
    // Find the content div
    const contentDiv = assistantMessageElement.querySelector('.message-content');
    if (!contentDiv) {
      console.error('Message content element not found');
      return;
    }
    
    let accumulatedMarkdown = '';
    
    try {
      chrome.runtime.sendMessage({action: 'sendMessage', message: message}, function(response) {
        if (handleRuntimeError()) {
          contentDiv.textContent = 'Error: Connection lost. Please refresh the page.';
          return;
        }
        console.log('Message sent successfully, waiting for response');
      });

      const responseHandler = function(message) {
        try {
          if (message.action === 'streamResponse') {
            if (message.reply) {
              accumulatedMarkdown += message.reply;
              contentDiv.innerHTML = utils.markdownToHtml(accumulatedMarkdown);
              const chatMessages = chatWindow.querySelector('#chatMessages');
              if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            }

            if (message.done) {
              // Update the final content
              contentDiv.innerHTML = utils.markdownToHtml(accumulatedMarkdown);
              
              // Add buttons only after content is final
              addMessageButtons(assistantMessageElement, accumulatedMarkdown);
              
              // Update TTS button based on cache status
              const ttsButton = assistantMessageElement.querySelector('.tts-button');
              if (ttsButton) {
                ttsService.updateTTSButton(ttsButton, accumulatedMarkdown);
              }
              
              chrome.runtime.onMessage.removeListener(responseHandler);
            }
          }
        } catch (error) {
          console.error('Error in response handler:', error);
          chrome.runtime.onMessage.removeListener(responseHandler);
          contentDiv.textContent = 'Error: Failed to process response. Please try again.';
        }
      };

      chrome.runtime.onMessage.addListener(responseHandler);
    } catch (error) {
      console.error('Error sending message:', error);
      contentDiv.textContent = 'Error: Unable to send message. Please try again.';
    }
  } catch (error) {
    console.error('Error in sendMessage:', error);
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
