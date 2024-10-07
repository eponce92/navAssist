let chatWindow = null;
let isDragging = false;
let isResizing = false;
let initialPos = { x: 0, y: 0 };
let initialSize = { width: 0, height: 0 };
let isSidebar = true;
let isResizingSidebar = false;
let initialSidebarWidth = 500;
let isChatVisible = true;
let isExtensionActive = true;

function createChatWindow() {
  console.log('Creating navAssist window');
  chatWindow = document.createElement('div');
  chatWindow.id = 'chatWindow';
  
  // Set initial display based on isChatVisible
  chatWindow.style.display = isChatVisible ? 'flex' : 'none';
  
  chatWindow.innerHTML = `
    <div id="chatHeader">
      <img src="${chrome.runtime.getURL('icon.png')}" alt="navAssist Icon" id="chatIcon">
      <span>navAssist</span>
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
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
    <div id="resizeHandle"></div>
    <div id="sidebarResizeHandle"></div>
  `;
  document.body.appendChild(chatWindow);

  // Set initial position and size for sidebar
  setSidebarMode();

  const chatHeader = chatWindow.querySelector('#chatHeader');
  chatHeader.addEventListener('mousedown', startDragging);

  const sendButton = chatWindow.querySelector('#sendMessage');
  sendButton.addEventListener('click', sendMessage);

  const messageInput = chatWindow.querySelector('#messageInput');
  messageInput.addEventListener('keydown', handleKeyDown);
  messageInput.addEventListener('input', autoResizeTextarea);

  const restartButton = chatWindow.querySelector('#restartChat');
  restartButton.addEventListener('click', restartChat);

  const resizeHandle = chatWindow.querySelector('#resizeHandle');
  resizeHandle.addEventListener('mousedown', startResizing);

  const summarizeButton = chatWindow.querySelector('#summarizeContent');
  summarizeButton.addEventListener('click', summarizePageContent);

  const toggleSidebarButton = chatWindow.querySelector('#toggleSidebar');
  toggleSidebarButton.addEventListener('click', toggleSidebarMode);

  const sidebarResizeHandle = chatWindow.querySelector('#sidebarResizeHandle');
  sidebarResizeHandle.addEventListener('mousedown', startResizingSidebar);

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Apply theme
  applyTheme();

  const hideButton = chatWindow.querySelector('#hideChat');
  hideButton.addEventListener('click', hideChatWindow);

  // Ensure correct visibility state after creation
  updateChatWindowVisibility();

  // Load chat history
  loadChatHistory();
}

function applyTheme() {
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  chatWindow.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
}

function handleMouseMove(e) {
  if (isDragging) {
    const dx = e.clientX - initialPos.x;
    const dy = e.clientY - initialPos.y;
    const newLeft = chatWindow.offsetLeft + dx;
    const newTop = chatWindow.offsetTop + dy;
    chatWindow.style.left = `${newLeft}px`;
    chatWindow.style.top = `${newTop}px`;
    initialPos = { x: e.clientX, y: e.clientY };
  } else if (isResizing) {
    const dx = e.clientX - initialPos.x;
    const dy = e.clientY - initialPos.y;
    const newWidth = Math.max(300, initialSize.width + dx);
    const newHeight = Math.max(400, initialSize.height + dy);
    requestAnimationFrame(() => {
      chatWindow.style.width = `${newWidth}px`;
      chatWindow.style.height = `${newHeight}px`;
    });
  } else if (isResizingSidebar) {
    const dx = initialPos.x - e.clientX;
    const newWidth = Math.max(300, initialSidebarWidth + dx);
    requestAnimationFrame(() => {
      chatWindow.style.width = `${newWidth}px`;
      document.body.style.marginRight = `${newWidth}px`;
    });
  }
}

function handleMouseUp() {
  isDragging = false;
  isResizing = false;
  isResizingSidebar = false;
  document.body.style.userSelect = '';
  chatWindow.classList.remove('dragging');
}

function startDragging(e) {
  if (e.target !== e.currentTarget) return;
  isDragging = true;
  initialPos = { x: e.clientX, y: e.clientY };
  document.body.style.userSelect = 'none';
  chatWindow.classList.add('dragging');
  e.preventDefault();
}

function startResizing(e) {
  if (isSidebar) return;
  isResizing = true;
  const rect = chatWindow.getBoundingClientRect();
  initialPos = { x: e.clientX, y: e.clientY };
  initialSize = { width: rect.width, height: rect.height };
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function startResizingSidebar(e) {
  if (!isSidebar) return;
  isResizingSidebar = true;
  initialPos = { x: e.clientX, y: e.clientY };
  initialSidebarWidth = chatWindow.offsetWidth;
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResizeTextarea() {
  this.style.height = 'auto';
  this.style.height = `${this.scrollHeight}px`;
}

function sendMessage() {
  const messageInput = chatWindow.querySelector('#messageInput');
  const message = messageInput.value.trim();
  if (message) {
    addMessage('User', message);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Create a placeholder for the assistant's response
    const assistantMessageElement = addMessage('Assistant', '');
    const assistantMessageContent = assistantMessageElement.querySelector('.message-content');
    let accumulatedMarkdown = '';
    
    chrome.runtime.sendMessage({action: 'sendMessage', message: message});

    // Set up a listener for the streaming response
    chrome.runtime.onMessage.addListener(function responseHandler(message) {
      if (message.action === 'streamResponse') {
        if (message.reply) {
          accumulatedMarkdown += message.reply;
          assistantMessageContent.innerHTML = markdownToHtml(accumulatedMarkdown);
          const chatMessages = chatWindow.querySelector('#chatMessages');
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        if (message.done) {
          // Response is complete, add the copy button
          addCopyButton(assistantMessageElement, accumulatedMarkdown);

          // Remove the listener
          chrome.runtime.onMessage.removeListener(responseHandler);
        }
      }
    });
  }
}

function addMessage(sender, text) {
  const chatMessages = chatWindow.querySelector('#chatMessages');
  const messageElement = document.createElement('div');
  messageElement.className = `message ${sender.toLowerCase()}-message`;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  messageContent.innerHTML = markdownToHtml(text);
  
  messageElement.appendChild(messageContent);
  
  // Add copy button to all messages
  addCopyButton(messageElement, text);
  
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  return messageElement;
}

function addCopyButton(messageElement, textToCopy) {
  const copyButton = createCopyButton();
  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      copyButton.classList.add('copied');
      setTimeout(() => copyButton.classList.remove('copied'), 2000);
    });
  });
  messageElement.appendChild(copyButton);
}

function markdownToHtml(markdown) {
  return markdown
    // Headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic text
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, function(match, lang, code) {
      return `<pre><code class="language-${lang || ''}">${code.trim()}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Unordered lists
    .replace(/^\s*[-*+] (.+)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)\s+(?=<li>)/g, '$1</ul><ul>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    // Ordered lists - remove this section or modify it to handle specific cases
    // .replace(/^\s*(\d+)\. (.+)/gm, '<li>$2</li>')
    // .replace(/(<li>.*<\/li>)\s+(?=<li>)/g, '$1</ol><ol>')
    // .replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>')
    // Links
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

function restartChat() {
  console.log('Restarting chat');
  const chatMessages = chatWindow.querySelector('#chatMessages');
  chatMessages.innerHTML = '';
  chrome.runtime.sendMessage({action: 'clearChatHistory'}, response => {
    if (!response.success) {
      console.error('Failed to clear chat history');
      addMessage('System', 'Failed to restart chat. Please try again.');
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleChat') {
    toggleChat();
  }
  // Add this to your existing chrome.runtime.onMessage listener
  if (request.action === 'logFinalResponse') {
    console.log('Final response from model:', request.response);
  }
});

// Listen for changes in color scheme
window.matchMedia('(prefers-color-scheme: dark)').addListener(() => {
  if (chatWindow) {
    applyTheme();
  }
});

// Add this function to create the copy button
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

// Add this function to handle the summarize button click
function summarizePageContent() {
  const assistantMessageElement = addMessage('Assistant', 'Summarizing page content...');
  const assistantMessageContent = assistantMessageElement.querySelector('.message-content');
  let accumulatedMarkdown = '';
  
  chrome.runtime.sendMessage({action: 'summarizeContent'});

  // Set up a listener for the streaming summary response
  chrome.runtime.onMessage.addListener(function summaryHandler(message) {
    if (message.action === 'streamResponse') {
      if (message.reply) {
        // Clear the "Summarizing page content..." message on first chunk
        if (accumulatedMarkdown === '') {
          assistantMessageContent.innerHTML = '';
        }
        
        accumulatedMarkdown += message.reply;
        assistantMessageContent.innerHTML = markdownToHtml(accumulatedMarkdown);
        const chatMessages = chatWindow.querySelector('#chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      if (message.done) {
        // Summary is complete, add the copy button
        addCopyButton(assistantMessageElement, accumulatedMarkdown);

        // Remove the listener
        chrome.runtime.onMessage.removeListener(summaryHandler);
      }
    }
  });
}

// Add this at the end of your content.js file

// Listen for the getPageContent message
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    // Get the page content
    const pageContent = document.body.innerText;
    // Send the content back
    sendResponse(pageContent);
  }
});

// Add this function to toggle between sidebar and popup modes
function toggleSidebarMode() {
  isSidebar = !isSidebar;
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

// Add this function to set sidebar mode
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
  });
}

// Add this function to set popup mode
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

function showChatWindow() {
  if (!isExtensionActive) return;
  
  if (chatWindow) {
    chatWindow.style.display = 'flex';
    isChatVisible = true;
    chrome.storage.local.set({ isChatVisible: true });
    const toggleButton = document.getElementById('showChatToggle');
    if (toggleButton) {
      toggleButton.style.display = 'none';
    }
  } else {
    createChatWindow();
  }
}

function toggleChat() {
  if (isChatVisible) {
    hideChatWindow();
  } else {
    showChatWindow();
  }
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
    } else {
      if (chatWindow) {
        chatWindow.style.display = 'none';
      }
      showChatToggle();
    }
  } else {
    removeChatWindow();
  }
}

function initializeChatWindow() {
  chrome.storage.local.get(['isChatVisible', 'isExtensionActive'], (result) => {
    isChatVisible = result.isChatVisible !== false; // Default to true if not set
    isExtensionActive = result.isExtensionActive !== false; // Default to true if not set
    
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
}

// Modify this message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleExtensionPower') {
    isExtensionActive = request.isEnabled;
    if (isExtensionActive) {
      updateChatWindowVisibility();
    } else {
      removeChatWindow();
    }
  }
  // ... (keep existing message listeners) ...
});

// Call this function when the content script loads
initializeChatWindow();

// Listen for visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateChatWindowVisibility();
  }
});

function loadChatHistory() {
  chrome.runtime.sendMessage({action: 'getChatHistory'}, (history) => {
    if (history && history.length > 0) {
      const chatMessages = chatWindow.querySelector('#chatMessages');
      chatMessages.innerHTML = '';
      history.forEach((message) => {
        addMessage(message.role === 'user' ? 'User' : 'Assistant', message.content);
      });
    }
  });
}