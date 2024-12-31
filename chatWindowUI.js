// UI-related functionality for the chat window

import ttsService from './ttsService.js';

let isDragging = false;
let isResizing = false;
let isResizingSidebar = false;
let initialPos = { x: 0, y: 0 };
let initialSize = { width: 0, height: 0 };
let initialSidebarWidth = 500;
let chatWindow = null;
let resizeObserver;
let animationFrameId = null;

export function initializeChatWindowUI(window) {
  chatWindow = window;
  const dragHandle = chatWindow.querySelector('#dragHandle');
  const resizeHandle = chatWindow.querySelector('#resizeHandle');
  const sidebarResizeHandle = chatWindow.querySelector('#sidebarResizeHandle');

  if (dragHandle) {
    dragHandle.addEventListener('mousedown', startDragging);
  }

  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', startResizing);
  }

  if (sidebarResizeHandle) {
    sidebarResizeHandle.addEventListener('mousedown', startResizingSidebar);
  }

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Initialize ResizeObserver
  resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      if (entry.target === chatWindow) {
        const chatMessages = chatWindow.querySelector('#chatMessages');
        if (chatMessages) {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }
    }
  });

  resizeObserver.observe(chatWindow);
}

function startDragging(e) {
  isDragging = true;
  initialPos = { x: e.clientX, y: e.clientY };
  document.body.style.userSelect = 'none';
  chatWindow.classList.add('dragging');
  e.preventDefault();
}

function startResizing(e) {
  if (chatWindow.classList.contains('sidebar-mode')) return;
  isResizing = true;
  const rect = chatWindow.getBoundingClientRect();
  initialPos = { x: e.clientX, y: e.clientY };
  initialSize = { width: rect.width, height: rect.height };
  document.body.style.userSelect = 'none';
  chatWindow.classList.add('resizing');
  e.preventDefault();
}

function startResizingSidebar(e) {
  if (!chatWindow.classList.contains('sidebar-mode')) return;
  isResizingSidebar = true;
  initialPos = { x: e.clientX, y: e.clientY };
  initialSidebarWidth = chatWindow.offsetWidth;
  document.body.style.userSelect = 'none';
  chatWindow.classList.add('resizing');
  e.preventDefault();
}

function handleMouseMove(e) {
  if (!isDragging && !isResizing && !isResizingSidebar) return;

  cancelAnimationFrame(animationFrameId);
  
  animationFrameId = requestAnimationFrame(() => {
    if (isDragging) {
      const dx = e.clientX - initialPos.x;
      const dy = e.clientY - initialPos.y;
      const newLeft = chatWindow.offsetLeft + dx;
      const newTop = chatWindow.offsetTop + dy;
      
      // Keep window within viewport bounds
      const maxLeft = window.innerWidth - chatWindow.offsetWidth;
      const maxTop = window.innerHeight - chatWindow.offsetHeight;
      chatWindow.style.left = `${Math.min(Math.max(0, newLeft), maxLeft)}px`;
      chatWindow.style.top = `${Math.min(Math.max(0, newTop), maxTop)}px`;
      
      initialPos = { x: e.clientX, y: e.clientY };
    } else if (isResizing) {
      const dx = e.clientX - initialPos.x;
      const dy = e.clientY - initialPos.y;
      const minWidth = 300;
      const minHeight = 400;
      const maxWidth = 800;
      const maxHeight = 800;
      
      const newWidth = Math.min(Math.max(minWidth, initialSize.width + dx), maxWidth);
      const newHeight = Math.min(Math.max(minHeight, initialSize.height + dy), maxHeight);
      
      chatWindow.style.width = `${newWidth}px`;
      chatWindow.style.height = `${newHeight}px`;
      
      // Ensure window stays within viewport
      const rect = chatWindow.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        chatWindow.style.left = `${window.innerWidth - newWidth}px`;
      }
      if (rect.bottom > window.innerHeight) {
        chatWindow.style.top = `${window.innerHeight - newHeight}px`;
      }
    } else if (isResizingSidebar) {
      const dx = initialPos.x - e.clientX;
      const newWidth = Math.max(300, initialSidebarWidth + dx);
      chatWindow.style.width = `${newWidth}px`;
      document.body.style.marginRight = `${newWidth}px`;
    }
  });
}

function handleMouseUp() {
  if (isResizing || isDragging || isResizingSidebar) {
    isDragging = false;
    isResizing = false;
    isResizingSidebar = false;
    document.body.style.userSelect = '';
    chatWindow.classList.remove('dragging', 'resizing');
    cancelAnimationFrame(animationFrameId);
    
    // Save the new size if in popup mode
    if (!chatWindow.classList.contains('sidebar-mode')) {
      const rect = chatWindow.getBoundingClientRect();
      initialSize = { width: rect.width, height: rect.height };
    }
  }
}

export function enableDragging(window) {
  const dragHandle = window.querySelector('#dragHandle');
  if (dragHandle) {
    dragHandle.addEventListener('mousedown', startDragging);
  }
}

export function enableResizing(window) {
  const resizeHandle = window.querySelector('#resizeHandle');
  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', startResizing);
  }
}

export default {
  initializeChatWindowUI,
  enableDragging,
  enableResizing,
};

async function createMessageElement(role, content) {
  console.log('🎨 Creating message element for:', role);
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role.toLowerCase()}-message`;
  
  const textDiv = document.createElement('div');
  textDiv.className = 'message-text';
  textDiv.textContent = content;
  
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'message-controls';
  
  try {
    // Create TTS button
    const ttsButton = document.createElement('button');
    ttsButton.className = 'tts-button';
    
    // Set initial icon (speaker by default)
    ttsButton.innerHTML = ttsService.SPEAKER_ICON;
    ttsButton.title = 'Generate speech';
    
    // Check cache and update icon if needed
    console.log('🔍 Checking cache status for new message...');
    const isCached = await ttsService.isInTTSCache(content);
    if (isCached) {
      console.log('💾 Found in cache, setting play icon');
      ttsButton.innerHTML = ttsService.PLAY_ICON;
      ttsButton.title = 'Play cached audio';
    }
    
    ttsButton.addEventListener('click', async () => {
      console.log('🎵 TTS button clicked');
      await ttsService.playTTS(content, messageDiv);
    });
    
    controlsDiv.appendChild(ttsButton);
  } catch (error) {
    console.error('❌ Error setting up TTS button:', error);
  }
  
  messageDiv.appendChild(textDiv);
  messageDiv.appendChild(controlsDiv);
  
  return messageDiv;
}
