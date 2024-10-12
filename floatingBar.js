import utils from './utils.js';
import * as chatWindowVisibility from './chatWindowVisibility.js';

let floatingBar = null;
let selectedText = '';
let lastSelection = null;
let isFloatingBarVisible = false;
let isCtrlASelection = false;

function createFloatingBar() {
  console.log('Creating floating bar');
  floatingBar = document.createElement('div');
  floatingBar.id = 'navAssistFloatingBar';
  floatingBar.innerHTML = `
    <button id="transferToChat" title="Transfer to Chat">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
    </button>
    <button id="fixGrammar" title="Fix Grammar">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7V4h16v3"></path>
        <path d="M9 20h6"></path>
        <path d="M12 4v16"></path>
      </svg>
    </button>
    <button id="aiEdit" title="AI Edit">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
      </svg>
    </button>
    <div id="aiEditInputContainer" style="display: none;">
      <input type="text" id="aiEditInput" placeholder="Enter AI edit instruction">
    </div>
  `;
  document.body.appendChild(floatingBar);

  const transferButton = floatingBar.querySelector('#transferToChat');
  transferButton.addEventListener('click', () => {
    transferSelectedTextToChat();
    hideFloatingBar(true);
  });

  const fixGrammarButton = floatingBar.querySelector('#fixGrammar');
  fixGrammarButton.addEventListener('click', () => {
    fixGrammar();
    hideFloatingBar(true);
  });

  const aiEditButton = floatingBar.querySelector('#aiEdit');
  aiEditButton.addEventListener('click', toggleAiEditInput);

  addTooltipListeners(transferButton, 'Transfer to Chat');
  addTooltipListeners(fixGrammarButton, 'Fix Grammar');
  addTooltipListeners(aiEditButton, 'AI Edit');

  console.log('Floating bar created and added to the document');
}

function addTooltipListeners(element, tooltipText) {
  element.addEventListener('mouseenter', (e) => showTooltip(e, tooltipText));
  element.addEventListener('mouseleave', hideTooltip);
}

function showTooltip(event, text) {
  const tooltip = document.createElement('div');
  tooltip.id = 'navAssistFloatingBarTooltip';
  tooltip.textContent = text;
  document.body.appendChild(tooltip);

  const rect = event.target.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
  tooltip.style.top = `${rect.bottom + 5}px`;

  setTimeout(() => {
    tooltip.style.opacity = '1';
  }, 10);
}

function hideTooltip() {
  const tooltip = document.getElementById('navAssistFloatingBarTooltip');
  if (tooltip) {
    tooltip.style.opacity = '0';
    setTimeout(() => {
      tooltip.remove();
    }, 200);
  }
}

function showFloatingBar(x, y, isCtrlA = false) {
  console.log('showFloatingBar called with coordinates:', x, y, 'isCtrlA:', isCtrlA);
  if (!floatingBar) {
    console.log('Creating floating bar');
    createFloatingBar();
  }
  
  const barHeight = floatingBar.offsetHeight;
  const offset = isCtrlA ? 10 : 50;
  const viewportHeight = window.innerHeight;
  
  let top = y - barHeight - offset;
  
  if (top < 0) {
    top = offset;
  }
  
  if (top + barHeight > viewportHeight) {
    top = viewportHeight - barHeight - offset;
  }
  
  console.log('Setting floating bar position:', { left: x, top: top });
  floatingBar.style.left = `${x}px`;
  floatingBar.style.top = `${top}px`;
  floatingBar.style.display = 'flex';
  floatingBar.style.position = 'fixed';
  floatingBar.style.zIndex = '2147483647';
  
  floatingBar.style.opacity = '1';

  isFloatingBarVisible = true;
  isCtrlASelection = isCtrlA;
  console.log('Floating bar should now be visible');

  const aiEditInputContainer = floatingBar.querySelector('#aiEditInputContainer');
  if (aiEditInputContainer.style.display !== 'none') {
    floatingBar.style.width = 'auto'; // Allow the bar to expand
  } else {
    floatingBar.style.width = ''; // Reset to default width
  }
}

function hideFloatingBar(force = false) {
  if (floatingBar && isFloatingBarVisible) {
    console.log('Attempting to hide floating bar. Force:', force);
    if (force) {
      console.log('Hiding floating bar');
      floatingBar.style.opacity = '0';
      floatingBar.style.display = 'none';
      isFloatingBarVisible = false;
      isCtrlASelection = false;
      
      // Hide and clear the AI edit input
      const aiEditInputContainer = floatingBar.querySelector('#aiEditInputContainer');
      const aiEditInput = floatingBar.querySelector('#aiEditInput');
      if (aiEditInputContainer) {
        aiEditInputContainer.style.display = 'none';
      }
      if (aiEditInput) {
        aiEditInput.value = '';
      }
      
      console.log('Floating bar hidden');
    } else {
      console.log('Floating bar not hidden due to ongoing edit or mouse over');
    }
  } else {
    console.log('Floating bar not visible or already hidden');
  }
}

function isFloatingBarActuallyVisible() {
  return floatingBar && 
         floatingBar.style.display !== 'none' && 
         floatingBar.style.opacity !== '0' &&
         document.body.contains(floatingBar);
}

function isFloatingBarContainingTarget(target) {
  return floatingBar && floatingBar.contains(target);
}

function transferSelectedTextToChat() {
  console.log('Transferring selected text to chat:', selectedText);
  if (selectedText) {
    const messageInput = document.querySelector('#messageInput');
    if (messageInput) {
      messageInput.value = selectedText;
      messageInput.focus();
    }
    chatWindowVisibility.default.showChatWindow();
    hideFloatingBar(true);
  }
}

function fixGrammar() {
  console.log('Fixing grammar for:', selectedText);
  if (!selectedText && lastSelection) {
    console.log('selectedText is empty, using lastSelection');
    const range = lastSelection.cloneRange();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(range.cloneContents());
    selectedText = tempDiv.innerText;
    console.log('Extracted text from lastSelection:', selectedText);
  }
  
  if (selectedText) {
    const prompt = `Fix this text grammar, don't change tone, language, or way of speaking, just fix errors. No chitchat or conversation, only reply with the fixed text. Your response should be in the same language as the text you are fixing and nothing else:\n\n${selectedText}`;
    
    utils.showLoadingIndicator('Fixing grammar...');
    hideFloatingBar(true);
    
    chrome.runtime.sendMessage({action: 'fixGrammar', prompt: prompt}, (response) => {
      utils.hideLoadingIndicator();
      
      if (response && response.fixedText) {
        console.log('Received fixed text:', response.fixedText);
        if (lastSelection) {
          replaceSelectedText(response.fixedText);
        } else {
          console.error('No valid selection range found');
        }
      } else {
        console.error('Failed to fix grammar');
      }
    });
  } else {
    console.error('No valid selection found');
  }
}

function updateSelection(text, range) {
  selectedText = text;
  lastSelection = range.cloneRange();
}

function isEditingAI() {
  const aiEditInputContainer = floatingBar.querySelector('#aiEditInputContainer');
  return aiEditInputContainer && aiEditInputContainer.style.display !== 'none';
}

function isMouseOverFloatingBar() {
  return floatingBar.matches(':hover');
}

function toggleAiEditInput() {
  const aiEditInputContainer = floatingBar.querySelector('#aiEditInputContainer');
  if (aiEditInputContainer.style.display === 'none') {
    aiEditInputContainer.style.display = 'inline-block';
    const aiEditInput = floatingBar.querySelector('#aiEditInput');
    aiEditInput.focus();
    aiEditInput.addEventListener('blur', handleAiEditInputBlur);
    aiEditInput.addEventListener('keydown', handleAiEditInputKeydown);
  } else {
    aiEditInputContainer.style.display = 'none';
  }
  updateFloatingBarWidth();
}

function handleAiEditInputKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const userInstructions = event.target.value.trim();
    if (userInstructions) {
      performAiEdit(userInstructions);
      hideFloatingBar(true);  // Force hide the floating bar
    }
  }
}

function performAiEdit(userInstructions) {
  if (!selectedText && lastSelection) {
    const range = lastSelection.cloneRange();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(range.cloneContents());
    selectedText = tempDiv.innerText;
  }
  
  if (selectedText) {
    const prompt = `Modify the following text following the users directions and instructions. No conversations, opinions or extra text on your reply, Only the modified text and nothing else:

User instructions: "${userInstructions}"

${selectedText}`;
    
    utils.showLoadingIndicator('Working on your text...');
    
    chrome.runtime.sendMessage({action: 'aiEdit', prompt: prompt}, (response) => {
      utils.hideLoadingIndicator();
      
      if (response && response.editedText) {
        console.log('Received edited text:', response.editedText);
        if (lastSelection) {
          replaceSelectedText(response.editedText);
        } else {
          console.error('No valid selection range found');
        }
      } else {
        console.error('Failed to edit text');
      }
    });
  } else {
    console.error('No valid selection found');
  }
}

function handleAiEditInputBlur(event) {
  // Delay the hide check to allow for button clicks
  setTimeout(() => {
    if (!isMouseOverFloatingBar()) {
      hideFloatingBar(true);
    }
  }, 100);
}

function updateFloatingBarWidth() {
  const aiEditInputContainer = floatingBar.querySelector('#aiEditInputContainer');
  if (aiEditInputContainer.style.display !== 'none') {
    floatingBar.style.width = 'auto';
  } else {
    floatingBar.style.width = '';
  }
}

function replaceSelectedText(newText) {
  if (!lastSelection) {
    console.error('No valid selection range found');
    return;
  }

  const range = lastSelection.cloneRange();
  const activeElement = document.activeElement;

  try {
    if (activeElement.isContentEditable || range.startContainer.nodeType === Node.TEXT_NODE) {
      // Handle contenteditable elements and text nodes
      range.deleteContents();
      range.insertNode(document.createTextNode(newText));
      range.collapse(false);
      
      // Update the selection
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (activeElement.tagName === 'TEXTAREA' || (activeElement.tagName === 'INPUT' && activeElement.type === 'text')) {
      // Handle textarea and text input elements
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      activeElement.value = activeElement.value.substring(0, start) + newText + activeElement.value.substring(end);
      activeElement.selectionStart = activeElement.selectionEnd = start + newText.length;
    } else {
      throw new Error('Unsupported element type for text replacement');
    }

    // Trigger input event to notify any listeners (like React) of the change
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    activeElement.dispatchEvent(inputEvent);

    console.log('Text replaced successfully');
  } catch (error) {
    console.error('Error replacing text:', error);
    
    // Fallback method: try to replace the text using execCommand
    try {
      document.execCommand('insertText', false, newText);
      console.log('Text replaced using execCommand');
    } catch (execError) {
      console.error('Failed to replace text using execCommand:', execError);
    }
  }
}

export default {
  createFloatingBar,
  showFloatingBar,
  hideFloatingBar,
  isFloatingBarActuallyVisible,
  isFloatingBarContainingTarget,
  transferSelectedTextToChat,
  fixGrammar,
  isFloatingBarVisible,
  updateSelection,
  toggleAiEditInput,
  updateFloatingBarWidth,
  performAiEdit,
  isEditingAI,
};
