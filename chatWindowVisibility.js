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

function handleRuntimeError() {
  if (chrome.runtime.lastError) {
    console.error('Extension context invalidated:', chrome.runtime.lastError);
    isExtensionActive = false;
    
    // Clean up existing UI elements
    if (chatWindow) {
      chatWindow.remove();
      chatWindow = null;
    }
    const toggleButton = document.getElementById('showChatToggle');
    if (toggleButton) {
      toggleButton.remove();
    }
    
    // Try to recover the extension context
    try {
      chrome.runtime.connect();
    } catch (e) {
      console.log('Could not recover extension context:', e);
    }
    
    return true;
  }
  return false;
}

function createChatWindow() {
  try {
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
        <button id="sendMessage" title="Send message">
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
      if (handleRuntimeError()) return;
      chatWindowCore.applyTheme(data.isDarkTheme !== false);
    });

    // Load tab-specific settings
    chrome.runtime.sendMessage({action: 'getTabId'}, function(response) {
      if (handleRuntimeError()) return;
      const tabId = response.tabId;
      chrome.storage.local.get(`tabSettings_${tabId}`, function(result) {
        if (handleRuntimeError()) return;
        const tabSettings = result[`tabSettings_${tabId}`] || {};
        isSidebar = tabSettings.isSidebar !== undefined ? tabSettings.isSidebar : true;
        isChatVisible = tabSettings.isChatVisible !== undefined ? tabSettings.isChatVisible : false;
        initialSidebarWidth = tabSettings.sidebarWidth || 500;

        updateChatWindowVisibility();
      });
    });

    // Load chat history
    chrome.runtime.sendMessage({action: 'getTabId'}, function(response) {
      if (handleRuntimeError()) return;
      const tabId = response.tabId;
      chrome.runtime.sendMessage({action: 'getChatHistory', tabId: tabId}, function(history) {
        if (handleRuntimeError()) return;
        if (history && history.length > 0) {
          history.forEach(message => {
            chatWindowCore.addMessage(message.role === 'user' ? 'User' : 'Assistant', message.content);
          });
        }
      });
    });

    // Add focus handling to the chat window
    chatWindow.addEventListener('mousedown', (e) => {
      // Only handle focus if clicking inside the chat window
      if (chatWindow.contains(e.target)) {
        // If clicking the input or a button/link, let the default behavior happen
        if (e.target.tagName === 'INPUT' || 
            e.target.tagName === 'BUTTON' || 
            e.target.tagName === 'A' ||
            e.target.tagName === 'TEXTAREA') {
          return;
        }
        
        // For other elements in the chat window, focus the input
        const messageInput = chatWindow.querySelector('#messageInput');
        if (messageInput) {
          messageInput.focus();
        }
      }
    });

    // Add focus handling to the message input
    const messageInput = chatWindow.querySelector('#messageInput');
    if (messageInput) {
      // Only maintain focus when explicitly requested
      messageInput.addEventListener('focus', () => {
        messageInput._shouldMaintainFocus = true;
      });

      messageInput.addEventListener('blur', (e) => {
        // Allow blur if we're not maintaining focus or clicking outside chat
        if (!messageInput._shouldMaintainFocus || !chatWindow.contains(e.relatedTarget)) {
          messageInput._shouldMaintainFocus = false;
          return;
        }
        
        // Prevent blur only if we're maintaining focus and clicking inside chat
        if (messageInput._shouldMaintainFocus && chatWindow.contains(e.relatedTarget)) {
          e.preventDefault();
          messageInput.focus();
        }
      });

      // Handle input events for height adjustment
      messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = `${Math.max(40, messageInput.scrollHeight)}px`;
      });

      // Update the event listener for the message input
      messageInput.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          await chatWindowCore.sendMessage();
        }
      });
    }

    return chatWindow;
  } catch (error) {
    console.error('Error in createChatWindow:', error);
    window.location.reload();
  }
}

function addEventListeners() {
  try {
    const sendButton = chatWindow.querySelector('#sendMessage');
    if (sendButton) {
      sendButton.addEventListener('click', chatWindowCore.sendMessage);
    } else {
      console.error('Send button not found');
    }

    const messageInput = chatWindow.querySelector('#messageInput');
    if (messageInput) {
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          chatWindowCore.sendMessage();
        }
      });
    } else {
      console.error('Message input not found');
    }

    const hideButton = chatWindow.querySelector('#hideChat');
    if (hideButton) {
      hideButton.addEventListener('click', hideChatWindow);
    }

    const toggleSidebarButton = chatWindow.querySelector('#toggleSidebar');
    if (toggleSidebarButton) {
      toggleSidebarButton.addEventListener('click', toggleSidebarMode);
    }

    const summarizeButton = chatWindow.querySelector('#summarizeContent');
    if (summarizeButton) {
      summarizeButton.addEventListener('click', chatWindowCore.summarizePageContent);
    }

    const restartButton = chatWindow.querySelector('#restartChat');
    if (restartButton) {
      restartButton.addEventListener('click', () => {
        chatWindowCore.restartChat();
      });
    }

    // Add theme change listener
    window.matchMedia('(prefers-color-scheme: dark)').addListener(chatWindowCore.applyTheme);
  } catch (error) {
    console.error('Error in addEventListeners:', error);
    window.location.reload();
  }
}

function toggleSidebarMode() {
  isSidebar = !isSidebar;
  saveTabSettings();
  
  // Remove any existing animation classes
  chatWindow.classList.remove('showing', 'hiding', 'transitioning');
  
  // Add transitioning class
  chatWindow.classList.add('transitioning');
  
  if (isSidebar) {
    setSidebarMode();
  } else {
    setPopupMode();
  }
  
  // Remove transitioning class after animation
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
  chatWindow.style.display = 'flex';
  chatWindow.style.opacity = '1';
  chatWindow.style.visibility = 'visible';
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
    // Create the toggle button first but keep it invisible
    const existingButton = document.getElementById('showChatToggle');
    if (!existingButton) {
      showChatToggle();
    }
    
    // Wait for the next frame to ensure the button is rendered and positioned
    requestAnimationFrame(() => {
      const toggleButton = document.getElementById('showChatToggle');
      if (toggleButton) {
        toggleButton.style.opacity = '0';
        
        if (!isSidebar) {
          const rect = toggleButton.getBoundingClientRect();
          
          // Set transition for smooth animation
          chatWindow.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
          
          // Animate to button position
          chatWindow.style.top = `${rect.top}px`;
          chatWindow.style.right = '0px';
          chatWindow.style.transform = 'scale(0.3)';
          chatWindow.style.transformOrigin = 'right center';
        }
        
        // Remove any existing animation classes
        chatWindow.classList.remove('showing', 'hiding');
        
        // Add hiding animation class
        chatWindow.classList.add('hiding');
        
        // After transition, hide completely
        setTimeout(() => {
          chatWindow.style.display = 'none';
          chatWindow.style.visibility = 'hidden';
          chatWindow.style.opacity = '0';
          chatWindow.classList.remove('hiding');
          chatWindow.style.transition = '';
          isChatVisible = false;
          saveTabSettings();
          document.body.style.marginRight = '0';
          
          // Show the toggle button
          toggleButton.style.opacity = '1';
        }, 300);
      }
    });
  }
}

function showChatWindow() {
  if (!isExtensionActive) return;
  
  console.log('Showing chat window');
  if (!chatWindow) {
    createChatWindow();
  }

  // Make sure chat window exists and is properly set up before proceeding
  if (!chatWindow) {
    console.error('Failed to create chat window');
    return;
  }

  // Get toggle button position for animation
  const toggleButton = document.getElementById('showChatToggle');
  if (toggleButton && !isSidebar) {
    const rect = toggleButton.getBoundingClientRect();
    
    // Set initial position to match the button
    chatWindow.style.top = `${rect.top}px`;
    chatWindow.style.right = '0px';
    chatWindow.style.transform = 'scale(0.3)';
    chatWindow.style.transformOrigin = 'right center';
  }

  // Remove any existing animation classes
  chatWindow.classList.remove('showing', 'hiding');
  
  // Show chat window
  chatWindow.style.display = 'flex';
  chatWindow.style.visibility = 'visible';
  chatWindow.style.opacity = '1';
  
  // Force a reflow
  chatWindow.offsetHeight;
  
  if (isSidebar) {
    setSidebarMode();
  } else {
    // For popup mode, animate from button to final position
    chatWindow.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    chatWindow.style.transform = 'scale(1)';
    chatWindow.style.top = '60px';
    chatWindow.style.right = '40px';
    setPopupMode();
  }

  // Add showing animation class
  chatWindow.classList.add('showing');
  
  isChatVisible = true;
  saveTabSettings();

  // Only remove the toggle button after we're sure the chat window is visible
  if (toggleButton) {
    toggleButton.remove();
  }

  // Remove animation class after animation completes
  setTimeout(() => {
    chatWindow.classList.remove('showing');
    chatWindow.style.transition = '';
    
    // Focus the input
    const messageInput = chatWindow.querySelector('#messageInput');
    if (messageInput) {
      messageInput.focus();
      messageInput.setSelectionRange(0, 0);
    }
  }, 300);
}

function saveTabSettings() {
  try {
    chrome.runtime.sendMessage({action: 'getTabId'}, function(response) {
      if (handleRuntimeError()) return;
      const tabId = response.tabId;
      const settings = {
        isSidebar: isSidebar,
        isChatVisible: isChatVisible,
        sidebarWidth: initialSidebarWidth
      };
      chrome.storage.local.set({[`tabSettings_${tabId}`]: settings});
    });
  } catch (error) {
    console.error('Error in saveTabSettings:', error);
    window.location.reload();
  }
}

function updateChatWindowVisibility() {
  try {
    // Check if Chrome API is available
    if (!chrome.runtime) {
      console.log('Chrome API not available, extension may be reloading');
      isExtensionActive = false;
      return;
    }

    if (isExtensionActive) {
      if (isChatVisible) {
        if (chatWindow) {
          chatWindow.style.display = 'flex';
          chatWindow.style.visibility = 'visible';
          chatWindow.style.opacity = '1';
        } else {
          try {
            createChatWindow();
          } catch (err) {
            console.log('Could not create chat window:', err);
            isExtensionActive = false;
            return;
          }
        }
        // Remove the toggle button when chat is visible
        const toggleButton = document.getElementById('showChatToggle');
        if (toggleButton) {
          toggleButton.remove();
        }
        // Set the correct mode
        if (isSidebar) {
          setSidebarMode();
        } else {
          setPopupMode();
        }
      } else {
        if (chatWindow) {
          chatWindow.style.display = 'none';
          chatWindow.style.visibility = 'hidden';
          chatWindow.style.opacity = '0';
        }
        try {
          const toggleButton = showChatToggle();
          if (!toggleButton) {
            console.log('Could not create toggle button');
            isExtensionActive = false;
          }
        } catch (err) {
          console.log('Could not show chat toggle:', err);
          isExtensionActive = false;
        }
      }
    } else {
      // Clean up UI elements when extension is not active
      if (chatWindow) {
        chatWindow.remove();
        chatWindow = null;
      }
      const toggleButton = document.getElementById('showChatToggle');
      if (toggleButton) {
        toggleButton.remove();
      }
    }
  } catch (error) {
    console.error('Error in updateChatWindowVisibility:', error);
    isExtensionActive = false;
  }
}

function initializeChatWindow() {
  try {
    chrome.storage.local.get(['isChatVisible', 'isExtensionActive', 'isSidebar'], (result) => {
      if (handleRuntimeError()) return;
      isExtensionActive = result.isExtensionActive !== false;
      isSidebar = result.isSidebar !== false;
      isChatVisible = result.isChatVisible === true;
      
      if (isExtensionActive) {
        if (isChatVisible) {
          showChatWindow();
        } else {
          showChatToggle();
        }
        
        // Add resize observer for popup mode
        if (chatWindow) {
          const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
              if (!chatWindow.classList.contains('resizing')) {
                chatWindow.classList.add('resizing');
              }
              
              // Use requestAnimationFrame for smooth resize
              requestAnimationFrame(() => {
                // Adjust textarea height if needed
                const textarea = chatWindow.querySelector('textarea');
                if (textarea) {
                  textarea.style.height = 'auto';
                  textarea.style.height = `${Math.min(textarea.scrollHeight, entry.contentRect.height - 150)}px`;
                }
              });
              
              // Remove resizing class after resize ends
              clearTimeout(chatWindow.resizeTimeout);
              chatWindow.resizeTimeout = setTimeout(() => {
                chatWindow.classList.remove('resizing');
              }, 150);
            }
          });
          
          resizeObserver.observe(chatWindow);
        }
      }
    });
  } catch (error) {
    console.error('Error in initializeChatWindow:', error);
    window.location.reload();
  }
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

let isDragging = false;
let dragStartY = 0;
let dragStartX = 0;
let hasMoved = false;
const DRAG_THRESHOLD = 3; // pixels of movement required to start dragging

function handleDragStart(e) {
  if (e.target.id !== 'showChatToggle') return;
  
  isDragging = true;
  hasMoved = false;
  dragStartY = e.clientY;
  dragStartX = e.clientX;
  e.target.classList.add('dragging');
  
  // Prevent click event from firing when starting drag
  e.preventDefault();
}

function handleDrag(e) {
  if (!isDragging) return;
  
  const toggleButton = document.getElementById('showChatToggle');
  if (!toggleButton) return;
  
  // Calculate movement distance
  const deltaY = Math.abs(e.clientY - dragStartY);
  const deltaX = Math.abs(e.clientX - dragStartX);
  
  // Only start actual dragging if we've moved past the threshold
  if (!hasMoved && (deltaY > DRAG_THRESHOLD || deltaX > DRAG_THRESHOLD)) {
    hasMoved = true;
  }
  
  if (hasMoved) {
    // Calculate new position
    const newY = Math.max(0, Math.min(window.innerHeight - toggleButton.offsetHeight, e.clientY - (toggleButton.offsetHeight / 2)));
    
    toggleButton.style.top = `${newY}px`;
    toggleButton.style.transform = 'none';
  }
}

function handleDragEnd(e) {
  if (!isDragging) return;
  
  const toggleButton = document.getElementById('showChatToggle');
  if (toggleButton) {
    toggleButton.classList.remove('dragging');
    
    if (hasMoved) {
      // Store the new position only if we actually dragged
      const newY = parseFloat(toggleButton.style.top);
      chrome.storage.local.set({ toggleButtonPosition: newY });
    } else {
      // If we didn't move, it's a click
      showChatWindow();
    }
  }
  
  isDragging = false;
  hasMoved = false;
}

function showChatToggle() {
  try {
    // Check if Chrome API is available
    if (!chrome.runtime) {
      console.log('Chrome API not available, extension may be reloading');
      return null;
    }

    // Remove any existing toggle button
    const existingButton = document.getElementById('showChatToggle');
    if (existingButton) {
      existingButton.remove();
    }

    // Create toggle button
    const toggleButton = document.createElement('button');
    toggleButton.id = 'showChatToggle';
    toggleButton.setAttribute('aria-label', 'Toggle Chat');
    toggleButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/>
      </svg>
    `;

    // Check if we have a stored position
    try {
      chrome.storage.local.get('toggleButtonPosition', (result) => {
        if (!chrome.runtime.lastError) {
          if (result.toggleButtonPosition !== undefined) {
            toggleButton.style.top = `${result.toggleButtonPosition}px`;
            toggleButton.style.transform = 'none';
          } else {
            toggleButton.style.top = '50%';
            toggleButton.style.transform = 'translateY(-50%)';
          }
        }
      });
    } catch (e) {
      console.log('Could not get stored position:', e);
      toggleButton.style.top = '50%';
      toggleButton.style.transform = 'translateY(-50%)';
    }

    document.body.appendChild(toggleButton);

    // Add drag event listeners
    toggleButton.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);

    return toggleButton;
  } catch (error) {
    console.error('Error in showChatToggle:', error);
    isExtensionActive = false;
    return null;
  }
}

export function handleToggleExtensionPower(isEnabled) {
  isExtensionActive = isEnabled;
  updateChatWindowVisibility();
  saveTabSettings();
}

export function loadTabSettings(settings) {
  isSidebar = settings.isSidebar !== undefined ? settings.isSidebar : true;
  isChatVisible = settings.isChatVisible !== undefined ? settings.isChatVisible : false;
  initialSidebarWidth = settings.sidebarWidth || 500;
  updateChatWindowVisibility();
}

export function addToChat(selectedText) {
  return new Promise((resolve) => {
    const addTextToChat = () => {
      const chatInput = document.getElementById('chatInput');
      const textarea = chatInput?.querySelector('textarea');
      
      if (textarea) {
        // Preserve line breaks and spacing
        const formattedText = selectedText
          // Replace multiple consecutive line breaks with exactly two line breaks
          .replace(/\n{3,}/g, '\n\n')
          // Ensure there's always a line break at the start for cursor positioning
          .replace(/^\s*/, '\n')
          // Preserve single and double line breaks
          .replace(/\n/g, '\n')
          // Remove extra spaces at the end of lines
          .replace(/[ \t]+$/gm, '')
          // Remove extra spaces at the start of lines (except the first line)
          .replace(/^[ \t]+/gm, '');

        // Format: cursor here, new line, selected text with preserved formatting
        const currentValue = textarea.value || '';
        const newValue = currentValue + (currentValue ? '\n\n' : '') + formattedText;
        textarea.value = newValue;
        
        // Place cursor at the beginning of the new content
        const cursorPosition = currentValue ? currentValue.length + 2 : 0;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
        
        // Focus the textarea
        textarea.focus();
        
        // Make textarea adjust to content
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
        
        // Trigger input event to handle any other listeners
        const event = new Event('input', { bubbles: true });
        textarea.dispatchEvent(event);
        
        resolve();
      } else {
        setTimeout(addTextToChat, 50);
      }
    };

    // If chat is not visible, show it first then add text
    if (!isChatVisible) {
      showChatWindow();
      // Wait for chat window to be fully visible before adding text
      setTimeout(addTextToChat, 50);
    } else {
      // If chat is already visible, just add the text
      addTextToChat();
    }
  });
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
  addToChat,
};
