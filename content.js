let chatWindow = null;
let isDragging = false;
let isResizing = false;
let initialPos = { x: 0, y: 0 };
let initialSize = { width: 0, height: 0 };

function createChatWindow() {
  console.log('Creating chat window');
  chatWindow = document.createElement('div');
  chatWindow.id = 'chatWindow';
  chatWindow.innerHTML = `
    <div id="chatHeader">
      <span>Ollama Chat</span>
      <button id="restartChat" title="Restart Chat">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
        </svg>
      </button>
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
  `;
  document.body.appendChild(chatWindow);

  // Set initial position
  const initialRight = 40;
  const initialTop = 60;
  const windowWidth = window.innerWidth;
  chatWindow.style.left = `${windowWidth - 350 - initialRight}px`; // 350 is the width of the chat window
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
  }
}

function handleMouseUp() {
  isDragging = false;
  isResizing = false;
  document.body.style.userSelect = '';
}

function startDragging(e) {
  if (e.target !== e.currentTarget) return;
  isDragging = true;
  initialPos = { x: e.clientX, y: e.clientY };
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function startResizing(e) {
  isResizing = true;
  const rect = chatWindow.getBoundingClientRect();
  initialPos = { x: e.clientX, y: e.clientY };
  initialSize = { width: rect.width, height: rect.height };
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