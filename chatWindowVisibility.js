// Visibility and mode-related functionality for the chat window

import * as chatWindowCore from './chatWindowCore.js';
import * as chatWindowUI from './chatWindowUI.js';
import predictionBar from './predictionBar.js';
import floatingBar from './floatingBar.js';

export let isExtensionActive = true;

let chatWindow = null;
let isSidebar = true;
let isChatVisible = false;
let initialSidebarWidth = 500;

function createChatWindow() {
  console.log('Creating navAssist window');
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
        <button id="hideChat" title="Hide Chat">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
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

  console.log('Chat window HTML structure:', chatWindow.innerHTML);

  // Add event listeners immediately after creating the chat window
  addEventListeners();

  // Initialize UI handling
  chatWindowUI.initializeChatWindowUI(chatWindow);

  // Set the chatWindow in chatWindowCore
  chatWindowCore.setChatWindow(chatWindow);

  return chatWindow;
}

function addEventListeners() {
  console.log('Adding event listeners');
  
  const sendButton = chatWindow.querySelector('#sendMessage');
  if (sendButton) {
    sendButton.addEventListener('click', () => {
      console.log('Send button clicked');
      chatWindowCore.sendMessage();
    });
    console.log('Send button found and listener added');
  } else {
    console.error('Send button not found');
  }

  const messageInput = chatWindow.querySelector('#messageInput');
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        console.log('Enter key pressed');
        e.preventDefault();
        chatWindowCore.sendMessage();
      }
    });
    console.log('Message input found and listener added');
  } else {
    console.error('Message input not found');
  }

  // Add other necessary event listeners here
  const hideButton = chatWindow.querySelector('#hideChat');
  if (hideButton) {
    hideButton.addEventListener('click', hideChatWindow);
    console.log('Hide button listener added');
  }

  const toggleSidebarButton = chatWindow.querySelector('#toggleSidebar');
  if (toggleSidebarButton) {
    toggleSidebarButton.addEventListener('click', toggleSidebarMode);
    console.log('Toggle sidebar button listener added');
  }

  const summarizeButton = chatWindow.querySelector('#summarizeContent');
  if (summarizeButton) {
    summarizeButton.addEventListener('click', chatWindowCore.summarizePageContent);
    console.log('Summarize button listener added');
  }

  const restartButton = chatWindow.querySelector('#restartChat');
  if (restartButton) {
    restartButton.addEventListener('click', chatWindowCore.restartChat);
    console.log('Restart button listener added');
  }
}

function toggleSidebarMode() {
  isSidebar = !isSidebar;
  chrome.storage.local.set({ isSidebar: isSidebar }); // Save the new mode
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
    chrome.storage.local.set({ isChatVisible: false }, () => {
      showChatToggle();
    });
  }
}

function showChatWindow() {
  if (!isExtensionActive) return;
  
  console.log('Showing chat window');
  if (!chatWindow) {
    createChatWindow();
  }
  
  chatWindow.style.display = 'flex';
  isChatVisible = true;
  chrome.storage.local.set({ isChatVisible: true });

  if (isSidebar) {
    setSidebarMode();
  } else {
    setPopupMode();
  }

  // Hide the toggle button
  const toggleButton = document.getElementById('showChatToggle');
  if (toggleButton) {
    toggleButton.style.display = 'none';
  }
}

function updateChatWindowVisibility() {
  if (isExtensionActive) {
    if (isChatVisible) {
      if (chatWindow) {
        chatWindow.style.display = 'flex';
      } else {
        chatWindowCore.createChatWindow();
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
    if (predictionBar) {
      predictionBar.remove();
      predictionBar = null;
    }
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
  if (floatingBar) {
    floatingBar.remove();
    floatingBar = null;
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
  handleToggleExtensionPower
};