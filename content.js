let chatWindow = null;
let isDragging = false;
let isResizing = false;
let dragOffset = { x: 0, y: 0 };
let resizeOffset = { x: 0, y: 0 };

function createChatWindow() {
  console.log('Creating chat window');
  chatWindow = document.createElement('div');
  chatWindow.id = 'chatWindow';
  chatWindow.innerHTML = `
    <div id="chatHeader">
      Ollama Chat
      <button id="restartChat" title="Restart Chat">
        <span class="restart-icon">🔄</span>
      </button>
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
  `;
  document.body.appendChild(chatWindow);

  // Set initial position with offset
  const initialRight = 40; // Increased from 20
  const initialTop = 60;   // Increased from 20
  chatWindow.style.right = `${initialRight}px`;
  chatWindow.style.top = `${initialTop}px`;

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

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(e) {
  if (isDragging) {
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Update this part
    chatWindow.style.left = `${newX}px`;
    chatWindow.style.top = `${newY}px`;
    
    // Remove this line
    // chatWindow.style.right = 'auto';
  } else if (isResizing) {
    const rect = chatWindow.getBoundingClientRect();
    const newWidth = e.clientX - rect.left;
    const newHeight = e.clientY - rect.top;
    chatWindow.style.width = `${Math.max(300, newWidth)}px`;
    chatWindow.style.height = `${Math.max(400, newHeight)}px`;
  }
}

function handleMouseUp() {
  isDragging = false;
  isResizing = false;
}

function startDragging(e) {
  if (e.target !== e.currentTarget) return; // Prevent dragging when clicking buttons
  isDragging = true;
  const rect = chatWindow.getBoundingClientRect();
  dragOffset = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function startResizing(e) {
  isResizing = true;
  const rect = chatWindow.getBoundingClientRect();
  resizeOffset = {
    x: rect.width - (e.clientX - rect.left),
    y: rect.height - (e.clientY - rect.top)
  };
  e.preventDefault();
  e.stopPropagation();
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
  messageElement.innerHTML = markdownToHtml(text);
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

createChatWindow();