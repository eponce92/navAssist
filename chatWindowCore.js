import utils from './utils.js';

let chatWindow = null;

export function setChatWindow(window) {
  chatWindow = window;
}

export function sendMessage() {
  if (!chatWindow) {
    console.error('Chat window not initialized');
    return;
  }

  const messageInput = chatWindow.querySelector('#messageInput');
  const message = messageInput.value.trim();
  if (message) {
    console.log('Sending message:', message);
    addMessage('User', message);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    const assistantMessageElement = addMessage('Assistant', '');
    const assistantMessageContent = assistantMessageElement.querySelector('.message-content');
    let accumulatedMarkdown = '';
    
    chrome.runtime.sendMessage({action: 'sendMessage', message: message}, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
        assistantMessageContent.innerHTML = 'Error: Unable to send message. Please try again.';
        return;
      }

      console.log('Message sent successfully, waiting for response');
    });

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

export function addMessage(sender, text) {
  if (!chatWindow) {
    console.error('Chat window not initialized');
    return;
  }

  const chatMessages = chatWindow.querySelector('#chatMessages');
  const messageElement = document.createElement('div');
  messageElement.className = `message ${sender.toLowerCase()}-message`;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  messageContent.innerHTML = utils.markdownToHtml(text);
  
  messageElement.appendChild(messageContent);
  
  if (text) {
    addCopyButton(messageElement, text);
  }
  
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

export function applyTheme(isDarkTheme) {
  chatWindow.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
}

export function summarizePageContent() {
  console.log('Summarizing page content');
  const assistantMessageElement = addMessage('Assistant', 'Summarizing page content...');
  const assistantMessageContent = assistantMessageElement.querySelector('.message-content');
  let accumulatedSummary = '';
  
  chrome.runtime.sendMessage({action: 'summarizeContent'}, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Error summarizing content:', chrome.runtime.lastError);
      assistantMessageContent.innerHTML = 'Error: Unable to summarize content. Please try again.';
      return;
    }
  });

  chrome.runtime.onMessage.addListener(function summaryHandler(message) {
    if (message.action === 'streamResponse') {
      if (message.reply) {
        accumulatedSummary += message.reply;
        assistantMessageContent.innerHTML = utils.markdownToHtml(accumulatedSummary);
        const chatMessages = chatWindow.querySelector('#chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      if (message.done) {
        addCopyButton(assistantMessageElement, accumulatedSummary);
        chrome.runtime.onMessage.removeListener(summaryHandler);
      }
    }
  });
}

export function restartChat() {
  console.log('Restarting chat');
  const chatMessages = chatWindow.querySelector('#chatMessages');
  chatMessages.innerHTML = '';
  chrome.runtime.sendMessage({action: 'clearChatHistory'}, response => {
    if (!response.success) {
      console.error('Failed to clear chat history');
    }
  });
}

export function updateSendButton() {
  const sendButton = chatWindow.querySelector('#sendMessage');
  if (sendButton) {
    sendButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"></line>
        <polyline points="5 12 12 5 19 12"></polyline>
      </svg>
    `;
    sendButton.style.display = 'flex';
    sendButton.style.alignItems = 'center';
    sendButton.style.justifyContent = 'center';
  }
}

export default {
  setChatWindow,
  sendMessage,
  summarizePageContent,
  restartChat,
  applyTheme,
  addMessage,
  updateSendButton,
};