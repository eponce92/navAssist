// Visibility and mode-related functionality for the chat window

import * as chatWindowCore from './chatWindowCore.js';
import * as chatWindowUI from './chatWindowUI.js';
import predictionBar from './predictionBar.js';
import floatingBar from './floatingBar.js';

export let isExtensionActive = true;

let chatWindow = null;
let isSidebar = false;
let isChatVisible = false;
let initialSidebarWidth = 500;

function createChatWindow() {
  chatWindow = document.createElement('div');
  chatWindow.id = 'chatWindow';
  
  chatWindow.style.display = 'none'; // Always start hidden
  
  chatWindow.innerHTML = `
    <div id="chatHeader">
      <div id="dragHandle">
        <img src="${chrome.runtime.getURL('icon.png')}" alt="navAssist Icon" id="chatIcon">
        <span>navAssist</span>
      </div>
      <div class="chat-controls">
        <button id="toggleSidebar" title="Toggle Sidebar/Popup">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>
        <button id="summarizeContent" title="Summarize page content">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="21" y1="10" x2="7" y2="10"></line>
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="14" x2="3" y2="14"></line>
            <line x1="21" y1="18" x2="7" y2="18"></line>
          </svg>
        </button>
        <button id="restartChat" title="Restart Chat">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
          </svg>
        </button>
        <button id="hideChat" title="Hide Chat">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
    <div id="chatMessages"></div>
    <div id="chatInput">
      <textarea id="messageInput" placeholder="Type your message..." rows="1"></textarea>
      <button id="sendMessage">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
    <div id="resizeHandle"></div>
    <div id="sidebarResizeHandle"></div>
  `;
  document.body.appendChild(chatWindow);

  // Add event listeners immediately after creating the chat window
  addEventListeners();

  // Initialize UI handling
  chatWindowUI.initializeChatWindowUI(chatWindow);

  // Set the chatWindow in chatWindowCore
  chatWindowCore.setChatWindow(chatWindow);

  // Update the send button icon
  chatWindowCore.updateSendButton();

  // Apply the initial theme
  chrome.storage.sync.get('isDarkTheme', function(data) {
    chatWindowCore.applyTheme(data.isDarkTheme !== false);
  });

  // Load tab-specific settings
  chrome.runtime.sendMessage({action: 'getTabId'}, function(response) {
    const tabId = response.tabId;
    chrome.storage.local.get(`tabSettings_${tabId}`, function(result) {
      const tabSettings = result[`tabSettings_${tabId}`] || {};
      isSidebar = tabSettings.isSidebar !== undefined ? tabSettings.isSidebar : false;
      isChatVisible = tabSettings.isChatVisible !== undefined ? tabSettings.isChatVisible : false;
      initialSidebarWidth = tabSettings.sidebarWidth || 500;

      updateChatWindowVisibility();
    });
  });

  // Load chat history
  chrome.runtime.sendMessage({action: 'getTabId'}, function(response) {
    const tabId = response.tabId;
    chrome.runtime.sendMessage({action: 'getChatHistory', tabId: tabId}, function(history) {
      if (history && history.length > 0) {
        history.forEach(message => {
          chatWindowCore.addMessage(message.role === 'user' ? 'User' : 'Assistant', message.content);
        });
      }
    });
  });

  return chatWindow;
}

function addEventListeners() {
  // console.log('Adding event listeners');  // Remove this line
  
  const sendButton = chatWindow.querySelector('#sendMessage');
  if (sendButton) {
    sendButton.addEventListener('click', chatWindowCore.sendMessage);
    // console.log('Send button found and listener added');  // Remove this line
  } else {
    console.error('Send button not found');
  }

  const messageInput = chatWindow.querySelector('#messageInput');
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // console.log('Enter key pressed');  // Remove this line
        e.preventDefault();
        chatWindowCore.sendMessage();
      }
    });
    // console.log('Message input found and listener added');  // Remove this line
  } else {
    console.error('Message input not found');
  }

  // Add other necessary event listeners here
  const hideButton = chatWindow.querySelector('#hideChat');
  if (hideButton) {
    hideButton.addEventListener('click', hideChatWindow);
    // console.log('Hide button listener added');  // Remove this line
  }

  const toggleSidebarButton = chatWindow.querySelector('#toggleSidebar');
  if (toggleSidebarButton) {
    toggleSidebarButton.addEventListener('click', toggleSidebarMode);
    // console.log('Toggle sidebar button listener added');  // Remove this line
  }

  const summarizeButton = chatWindow.querySelector('#summarizeContent');
  if (summarizeButton) {
    summarizeButton.addEventListener('click', chatWindowCore.summarizePageContent);
  }

  const restartButton = chatWindow.querySelector('#restartChat');
  if (restartButton) {
    restartButton.addEventListener('click', () => {
      chatWindowCore.restartChat();
      // Optionally, you can add a visual feedback here, like:
      // restartButton.classList.add('restarting');
      // setTimeout(() => restartButton.classList.remove('restarting'), 500);
    });
  }

  // Add theme change listener
  window.matchMedia('(prefers-color-scheme: dark)').addListener(chatWindowCore.applyTheme);
}

function toggleSidebarMode() {
  isSidebar = !isSidebar;
  saveTabSettings();
  chatWindow.classList.add('transitioning');
  if (isSidebar) {
    setSidebarMode();
  } else {
    setPopupMode();
  }
  setTimeout(() => {
    chatWindow.classList.remove('transitioning');
  }, 300);
}

function setSidebarMode() {
  chatWindow.classList.add('sidebar-mode');
  chatWindow.classList.remove('popup-mode');
  chatWindow.style.width = `${initialSidebarWidth}px`;
  chatWindow.style.height = '100%';
  chatWindow.style.top = '0';
  chatWindow.style.right = '0';
  chatWindow.style.left = 'auto';
  chatWindow.style.bottom = 'auto';
  document.body.style.marginRight = `${initialSidebarWidth}px`;
  
  // Force a reflow to ensure the sidebar is rendered
  chatWindow.offsetHeight;
}

function setPopupMode() {
  chatWindow.classList.remove('sidebar-mode');
  chatWindow.classList.add('popup-mode');
  chatWindow.style.width = '350px';
  chatWindow.style.height = '500px';
  chatWindow.style.top = '60px';
  chatWindow.style.right = '40px';
  chatWindow.style.left = 'auto';
  chatWindow.style.bottom = 'auto';
  document.body.style.marginRight = '0';
}

function hideChatWindow() {
  if (chatWindow) {
    chatWindow.style.display = 'none';
    isChatVisible = false;
    saveTabSettings();
    showChatToggle();
    
    // Add this line to remove the margin when hiding the chat window
    document.body.style.marginRight = '0';
  }
}

function showChatWindow() {
  if (!isExtensionActive) return;
  
  console.log('Showing chat window');
  if (!chatWindow) {
    createChatWindow();
  } else {
    // Reload chat history when showing an existing chat window
    chrome.runtime.sendMessage({action: 'getTabId'}, function(response) {
      const tabId = response.tabId;
      chrome.runtime.sendMessage({action: 'getChatHistory', tabId: tabId}, function(history) {
        if (history && history.length > 0) {
          const chatMessages = chatWindow.querySelector('#chatMessages');
          chatMessages.innerHTML = ''; // Clear existing messages
          history.forEach(message => {
            chatWindowCore.addMessage(message.role === 'user' ? 'User' : 'Assistant', message.content);
          });
        }
      });
    });
  }
  
  chatWindow.style.display = 'flex';
  isChatVisible = true;
  saveTabSettings();

  if (isSidebar) {
    setSidebarMode();
  } else {
    setPopupMode(); // This will now be the default
  }

  // Hide the toggle button
  const toggleButton = document.getElementById('showChatToggle');
  if (toggleButton) {
    toggleButton.style.display = 'none';
  }
}

function saveTabSettings() {
  chrome.runtime.sendMessage({action: 'getTabId'}, function(response) {
    const tabId = response.tabId;
    const settings = {
      isSidebar: isSidebar,
      isChatVisible: isChatVisible,
      sidebarWidth: initialSidebarWidth
    };
    chrome.storage.local.set({[`tabSettings_${tabId}`]: settings});
  });
}

function updateChatWindowVisibility() {
  if (isExtensionActive) {
    if (isChatVisible) {
      if (chatWindow) {
        chatWindow.style.display = 'flex';
      } else {
        createChatWindow();
      }
      const toggleButton = document.getElementById('showChatToggle');
      if (toggleButton) {
        toggleButton.style.display = 'none';
      }
      // Set the correct mode after creating or showing the window
      if (isSidebar) {
        setSidebarMode();
      } else {
        setPopupMode();
      }
    } else {
      if (chatWindow) {
        chatWindow.style.display = 'none';
      }
      showChatToggle();
    }
    // Create prediction bar when extension is active
    predictionBar.createPredictionBar();
  } else {
    removeChatWindow();
    // Remove prediction bar when extension is inactive
    predictionBar.remove();
  }
}

function initializeChatWindow() {
  chrome.storage.local.get(['isChatVisible', 'isExtensionActive', 'isSidebar'], (result) => {
    isChatVisible = result.isChatVisible !== false; // Default to true if not set
    isExtensionActive = result.isExtensionActive !== false; // Default to true if not set
    isSidebar = result.isSidebar !== false; // Default to true (sidebar mode) if not set
    
    updateChatWindowVisibility();
  });
}

function removeChatWindow() {
  if (chatWindow) {
    chatWindow.remove();
    chatWindow = null;
  }
  const toggleButton = document.getElementById('showChatToggle');
  if (toggleButton) {
    toggleButton.remove();
  }
  if (floatingBar.isFloatingBarActuallyVisible()) {
    floatingBar.hideFloatingBar();
  }
}

function showChatToggle() {
  if (!isExtensionActive) return;
  
  let toggleButton = document.getElementById('showChatToggle');
  if (!toggleButton) {
    toggleButton = document.createElement('button');
    toggleButton.id = 'showChatToggle';
    toggleButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    `;
    toggleButton.addEventListener('click', showChatWindow);
    document.body.appendChild(toggleButton);
    
    // Position the toggle button on the right side of the window
    toggleButton.style.position = 'fixed';
    toggleButton.style.right = '0';
    toggleButton.style.top = '50%';
    toggleButton.style.transform = 'translateY(-50%)';
  }
  toggleButton.style.display = 'block';
}

export function handleToggleExtensionPower(isEnabled) {
  isExtensionActive = isEnabled;
  updateChatWindowVisibility();
  saveTabSettings();
}

export function loadTabSettings(settings) {
  isSidebar = settings.isSidebar !== undefined ? settings.isSidebar : false; // Change default to false
  isChatVisible = settings.isChatVisible !== undefined ? settings.isChatVisible : false;
  initialSidebarWidth = settings.sidebarWidth || 500;
  updateChatWindowVisibility();
}

export default {
  createChatWindow,
  showChatWindow,
  toggleSidebarMode,
  setSidebarMode,
  setPopupMode,
  hideChatWindow,
  updateChatWindowVisibility,
  initializeChatWindow,
  removeChatWindow,
  showChatToggle,
  isExtensionActive,
  isChatVisible,
  handleToggleExtensionPower,
  loadTabSettings,
};