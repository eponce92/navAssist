import utils from './utils.js';

// Core functionality for the chat window

let chatWindow = null;
let isChatVisible = true;
let isExtensionActive = true;

function createChatWindow() {
  console.log('Creating navAssist window');
  chatWindow = document.createElement('div');
  chatWindow.id = 'chatWindow';
  
  chatWindow.style.display = isChatVisible ? 'flex' : 'none';
  
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
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
      </button>
    </div>
    <div id="resizeHandle"></div>
    <div id="sidebarResizeHandle"></div>
  `;
  document.body.appendChild(chatWindow);

  // Event listeners will be added in a separate function

  applyTheme();
  loadChatHistory();
}

function applyTheme() {
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  chatWindow.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
}

function sendMessage() {
  const messageInput = chatWindow.querySelector('#messageInput');
  const message = messageInput.value.trim();
  if (message) {
    addMessage('User', message);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    const assistantMessageElement = addMessage('Assistant', '');
    const assistantMessageContent = assistantMessageElement.querySelector('.message-content');
    let accumulatedMarkdown = '';
    
    chrome.runtime.sendMessage({action: 'sendMessage', message: message});

    chrome.runtime.onMessage.addListener(function responseHandler(message) {
      if (message.action === 'streamResponse') {
        if (message.reply) {
          accumulatedMarkdown += message.reply;
          assistantMessageContent.innerHTML = utils.markdownToHtml(accumulatedMarkdown);
          const chatMessages = chatWindow.querySelector('#chatMessages');
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        if (message.done) {
          addCopyButton(assistantMessageElement, accumulatedMarkdown);
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
  messageContent.innerHTML = utils.markdownToHtml(text);
  
  messageElement.appendChild(messageContent);
  
  addCopyButton(messageElement, text);
  
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  return messageElement;
}

function addCopyButton(messageElement, textToCopy) {
  const copyButton = createCopyButton();
  const copyFeedback = document.createElement('span');
  copyFeedback.className = 'copy-feedback';
  copyFeedback.textContent = 'Copied!';
  
  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      copyButton.classList.add('copied');
      setTimeout(() => copyButton.classList.remove('copied'), 2000);
    });
  });
  
  messageElement.appendChild(copyButton);
  messageElement.appendChild(copyFeedback);
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

export default {
  createChatWindow,
  applyTheme,
  sendMessage,
  addMessage,
  addCopyButton,
  restartChat,
  loadChatHistory
};