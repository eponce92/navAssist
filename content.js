let chatWindow = null;
let isDragging = false;
let isResizing = false;
let initialPos = { x: 0, y: 0 };
let initialSize = { width: 0, height: 0 };
let isSidebar = true;
let isResizingSidebar = false;
let initialSidebarWidth = 500;

function createChatWindow() {
  console.log('Creating chat window');
  chatWindow = document.createElement('div');
  chatWindow.id = 'chatWindow';
  chatWindow.innerHTML = `
    <div id="chatHeader">
      <span>Ollama Chat</span>
      <div class="chat-controls">
        <button id="toggleSidebar" title="Toggle Sidebar/Popup">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>
        <button id="summarizeContent" title="Summarize page content">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="8"></line>
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
    chatWindow.style.width = `${newWidth}px`;
    chatWindow.style.height = `${newHeight}px`;
  } else if (isResizingSidebar) {
    const dx = initialPos.x - e.clientX;
    const newWidth = Math.max(300, initialSidebarWidth + dx);
    chatWindow.style.width = `${newWidth}px`;
    document.body.style.marginRight = `${newWidth}px`;
  }
}

function handleMouseUp() {
  isDragging = false;
  isResizing = false;
  isResizingSidebar = false;
  document.body.style.userSelect = '';
}

function startDragging(e) {
  if (e.target !== e.currentTarget || isSidebar) return;
  isDragging = true;
  initialPos = { x: e.clientX, y: e.clientY };
  document.body.style.userSelect = 'none';
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
    chrome.runtime.sendMessage({action: 'sendMessage', message: message}, response => {
      if (response && response.reply) {
        addMessage('Assistant', response.reply);
      } else {
        addMessage('System', 'Error: No response received from the server.');
      }
    });
  }
}

function addMessage(sender, text) {
  const chatMessages = chatWindow.querySelector('#chatMessages');
  const messageElement = document.createElement('div');
  messageElement.className = `message ${sender.toLowerCase()}-message`;
  
  // Create a container for the message content
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  messageContent.innerHTML = markdownToHtml(text);
  
  messageElement.appendChild(messageContent);
  
  // Add copy button for assistant messages
  if (sender.toLowerCase() === 'assistant') {
    const copyButton = createCopyButton();
    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        // Provide visual feedback
        copyButton.classList.add('copied');
        setTimeout(() => copyButton.classList.remove('copied'), 2000);
      });
    });
    messageElement.appendChild(copyButton);
  }
  
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function markdownToHtml(markdown) {
  return markdown
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/^- (.*)/gm, '<li>$1</li>')
    .replace(/<li>.*?<\/li>/gs, match => `<ul>${match}</ul>`);
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
    if (chatWindow) {
      chatWindow.style.display = chatWindow.style.display === 'none' ? 'block' : 'none';
    } else {
      createChatWindow();
    }
  }
});

// Listen for changes in color scheme
window.matchMedia('(prefers-color-scheme: dark)').addListener(() => {
  if (chatWindow) {
    applyTheme();
  }
});

createChatWindow();

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
  addMessage('System', 'Summarizing page content...');
  chrome.runtime.sendMessage({action: 'summarizeContent'}, response => {
    if (response && response.summary) {
      addMessage('Assistant', response.summary);
    } else {
      addMessage('System', 'Error: Unable to summarize page content.');
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
  if (isSidebar) {
    setSidebarMode();
  } else {
    setPopupMode();
  }
}

// Add this function to set sidebar mode
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
}

// Add this function to set popup mode
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