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
  if (!markdown) return '';
  
  // First, normalize line endings
  let text = markdown.replace(/\r\n/g, '\n');
  
  // Process the text
  text = text
    // Remove multiple consecutive line breaks first
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    
    // Code blocks - styled monospace block
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<div class="code-block"><code>${code.trim()}</code></div>`;
    })
    
    // Inline code - styled monospace
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    
    // Headers with different sizes
    .replace(/^# (.*$)/gm, '<div class="md-h1">$1</div>')
    .replace(/^## (.*$)/gm, '<div class="md-h2">$1</div>')
    .replace(/^### (.*$)/gm, '<div class="md-h3">$1</div>')
    
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<span class="md-bold">$1</span>')
    
    // Italic text
    .replace(/\*(.*?)\*/g, '<span class="md-italic">$1</span>')
    
    // Unordered lists with proper indentation and bullets
    .replace(/^\s*[-*+] (.+)$/gm, '<div class="md-list-item">• $1</div>')
    
    // Links with subtle styling
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a class="md-link" href="$2">$1</a>')
    
    // Ensure paragraphs are separated
    .replace(/\n\n/g, '<div class="md-paragraph-break"></div>')
    
    // Single line breaks
    .replace(/\n/g, '<br>');
  
  // Clean up any excessive breaks
  text = text
    .replace(/<div class="md-paragraph-break"><\/div>\s*<div class="md-paragraph-break"><\/div>/g, '<div class="md-paragraph-break"></div>')
    .replace(/^(<div class="md-paragraph-break"><\/div>)+/, '')
    .replace(/(<div class="md-paragraph-break"><\/div>)+$/, '');
    
  return text;
}

export default {
  isEditableElement,
  handleInput,
  replaceSelectedText,
  showLoadingIndicator,
  hideLoadingIndicator,
  markdownToHtml
};
