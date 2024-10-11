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

function addMessage(sender, text) {
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

export function summarizePageContent() {
  // Implement summarize functionality
}

export function restartChat() {
  // Implement restart chat functionality
}

export default {
  setChatWindow,
  sendMessage,
  summarizePageContent,
  restartChat,
};