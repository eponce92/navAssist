// Visibility and mode-related functionality for the chat window

import chatWindowCore from './chatWindowCore.js';
import predictionBar from './predictionBar.js';
import floatingBar from './floatingBar.js';

let chatWindow = null;
let isSidebar = true;
let isChatVisible = true;
let isExtensionActive = true;
let initialSidebarWidth = 500;

function createChatWindow() {
  console.log('Creating navAssist window');
  chatWindow = document.createElement('div');
  chatWindow.id = 'chatWindow';
  
  chatWindow.style.display = isChatVisible ? 'flex' : 'none';
  
  chatWindow.innerHTML = `
    <!-- ... (previous HTML content) ... -->
  `;
  document.body.appendChild(chatWindow);

  // Add event listeners for sending messages
  const sendButton = chatWindow.querySelector('#sendMessage');
  sendButton.addEventListener('click', chatWindowCore.sendMessage);

  const messageInput = chatWindow.querySelector('#messageInput');
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatWindowCore.sendMessage();
    }
  });

  // ... (rest of the function remains the same)
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
  requestAnimationFrame(() => {
    chatWindow.style.width = `${initialSidebarWidth}px`;
    chatWindow.style.height = '100%';
    chatWindow.style.top = '0';
    chatWindow.style.right = '0';
    chatWindow.style.left = 'auto';
    chatWindow.style.bottom = 'auto';
    document.body.style.marginRight = `${initialSidebarWidth}px`;
    
    // Force a reflow to ensure the sidebar is rendered
    chatWindow.offsetHeight;
  });
}

function setPopupMode() {
  chatWindow.classList.remove('sidebar-mode');
  chatWindow.classList.add('popup-mode');
  requestAnimationFrame(() => {
    chatWindow.style.width = '350px';
    chatWindow.style.height = '500px';
    chatWindow.style.top = '60px';
    chatWindow.style.right = '40px';
    chatWindow.style.left = 'auto';
    chatWindow.style.bottom = 'auto';
    document.body.style.marginRight = '0';
  });
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
  if (chatWindow) {
    chatWindow.style.display = 'flex';
    isChatVisible = true;
    chrome.storage.local.set({ isChatVisible: true });
  } else {
    createChatWindow();
  }

  // Force a reflow and check visibility
  setTimeout(() => {
    if (chatWindow) {
      chatWindow.style.opacity = '0';
      chatWindow.offsetHeight; // Force a reflow
      chatWindow.style.opacity = '1';
      
      // Set the correct mode after creating or showing the window
      if (isSidebar) {
        setSidebarMode();
      } else {
        setPopupMode();
      }

      // Check if the window is actually visible
      setTimeout(() => {
        const isVisible = chatWindow.offsetParent !== null;
        console.log('Chat window visibility check:', isVisible);
        if (!isVisible) {
          console.log('Chat window not visible, attempting to show again');
          chatWindow.style.display = 'flex';
          if (isSidebar) {
            setSidebarMode();
          } else {
            setPopupMode();
          }
        }
      }, 100);
    }
  }, 0);

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
  isChatVisible
};