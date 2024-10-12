import { isExtensionActive } from './chatWindowVisibility.js';

// Utility functions used across multiple modules

let isTyping = false;
let typingTimer = null;
const TYPING_INTERVAL = 700; // ms

function isEditableElement(element) {
  return element.isContentEditable || element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && element.type === 'text');
}

function handleInput(e, triggerPrediction) {
  if (!isExtensionActive) return;

  isTyping = true;
  clearTimeout(typingTimer);

  typingTimer = setTimeout(() => {
    isTyping = false;
    triggerPrediction(e.target);
  }, TYPING_INTERVAL);
}

function replaceSelectedText(newText, storedRange) {
  console.log('Attempting to replace text:', newText);
  
  try {
    if (!storedRange) {
      console.error('No stored range found');
      return false;
    }

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(storedRange);
    
    const range = selection.getRangeAt(0);
    const activeElement = document.activeElement;

    console.log('Active element:', activeElement.tagName, activeElement.id, activeElement.className);

    if (activeElement.isContentEditable || 
        (activeElement.tagName === 'TEXTAREA') || 
        (activeElement.tagName === 'INPUT' && activeElement.type === 'text')) {
      // If the selection is within an editable field
      if (activeElement.isContentEditable) {
        // Handle contenteditable divs
        range.deleteContents();
        const textNode = document.createTextNode(newText);
        range.insertNode(textNode);
        range.selectNodeContents(textNode);
        range.collapse(false);
      } else {
        // Handle textarea and input elements
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        const text = activeElement.value;
        activeElement.value = text.slice(0, start) + newText + text.slice(end);
        activeElement.setSelectionRange(start + newText.length, start + newText.length);
      }

      // Trigger input events
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertReplacementText',
        data: newText
      });
      activeElement.dispatchEvent(inputEvent);

      // Force update for reactive frameworks
      setTimeout(() => {
        const forceUpdateEvent = new Event('input', { bubbles: true, cancelable: true });
        activeElement.dispatchEvent(forceUpdateEvent);
      }, 0);
    } else {
      // If the selection is in a non-editable area
      range.deleteContents();
      const textNode = document.createTextNode(newText);
      range.insertNode(textNode);
      range.selectNodeContents(textNode);
      range.collapse(false);
    }

    selection.removeAllRanges();
    selection.addRange(range);

    console.log('Text replaced successfully');
    return true;
  } catch (error) {
    console.error('Error replacing text:', error);
    return false;
  }
}

function createOrUpdateMessageElement(id, message) {
  let messageElement = document.getElementById(id);
  if (!messageElement) {
    messageElement = document.createElement('div');
    messageElement.id = id;
    messageElement.style.cssText = `
      position: fixed;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 2147483647;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(messageElement);
  }
  messageElement.textContent = message;
  return messageElement;
}

function positionMessageElement(element) {
  const floatingBar = document.getElementById('navAssistFloatingBar');
  if (floatingBar) {
    const rect = floatingBar.getBoundingClientRect();
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.bottom + 10}px`; // 10px below the floating bar
  } else {
    element.style.left = '50%';
    element.style.top = '50%';
    element.style.transform = 'translate(-50%, -50%)';
  }
}

function showLoadingIndicator(message = 'Loading...') {
  console.log('Showing loading indicator');
  const loadingIndicator = createOrUpdateMessageElement('navAssistLoadingIndicator', message);
  positionMessageElement(loadingIndicator);
  loadingIndicator.style.display = 'block';
  loadingIndicator.style.opacity = '1';
}

function hideLoadingIndicator() {
  console.log('Hiding loading indicator');
  const loadingIndicator = document.getElementById('navAssistLoadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.style.opacity = '0';
    setTimeout(() => {
      loadingIndicator.style.display = 'none';
    }, 300);
  }
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
    // Links
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

export default {
  isEditableElement,
  handleInput,
  replaceSelectedText,
  showLoadingIndicator,
  hideLoadingIndicator,
  markdownToHtml
};
