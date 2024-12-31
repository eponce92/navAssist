import utils from './utils.js';
import * as chatWindowVisibility from './chatWindowVisibility.js';

let floatingBar = null;
let selectedText = '';
let lastSelection = null;
let isFloatingBarVisible = false;
let isCtrlASelection = false;
let isProcessingSelection = false;
let lastMouseDownTarget = null;
let hideTimeout = null;
let showTimeout = null;
let isHiding = false;

// Initialize selection change listener
document.addEventListener('selectionchange', handleSelectionChange);
document.addEventListener('mousedown', handleMouseDown);

function handleMouseDown(e) {
  lastMouseDownTarget = e.target;
  
  // Clear any pending show/hide operations
  clearTimeout(hideTimeout);
  clearTimeout(showTimeout);
  
  // If clicking outside the floating bar, hide it immediately
  if (floatingBar && !floatingBar.contains(e.target)) {
    isHiding = true;
    hideFloatingBar(true);
    selectedText = '';
    lastSelection = null;
  }
}

function handleMouseUp(e) {
  if (!chatWindowVisibility.default.isExtensionActive || isHiding) return;
  if (isProcessingSelection) return;

  isProcessingSelection = true;
  console.log('mouseup event triggered');

  const selection = window.getSelection();
  const newSelectedText = selection.toString().trim();
  
  // Clear any pending show/hide operations
  clearTimeout(hideTimeout);
  clearTimeout(showTimeout);
  
  // If there's no text selected or clicking outside the selection
  if (!newSelectedText || selection.isCollapsed) {
    console.log('No valid selection, clearing state');
    selectedText = '';
    lastSelection = null;
    hideFloatingBar(true);
    isProcessingSelection = false;
    return;
  }

  // Only show floating bar if we have a new selection and we're not currently hiding
  if (!isHiding && (newSelectedText !== selectedText || !isFloatingBarActuallyVisible())) {
    selectedText = newSelectedText;
    console.log('New selection found, showing floating bar');
    lastSelection = selection.getRangeAt(0).cloneRange();
    const rect = lastSelection.getBoundingClientRect();
    showFloatingBar(rect.left + window.scrollX, rect.top + window.scrollY);
  }

  // Reset processing flag after a short delay
  setTimeout(() => {
    isProcessingSelection = false;
    isHiding = false;
  }, 100);
}

function handleSelectionChange() {
  if (!chatWindowVisibility.default.isExtensionActive) return;
  if (isProcessingSelection) return;

  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  // If there's no text selected or the selection is collapsed
  if (!text || selection.isCollapsed) {
    // Don't immediately hide if we're interacting with the floating bar
    if (!isMouseOverFloatingBar() && (!lastMouseDownTarget || !floatingBar?.contains(lastMouseDownTarget))) {
      selectedText = '';
      lastSelection = null;
      hideFloatingBar(true);
    }
    return;
  }

  // Get the active element to check if we're in an editable area
  const activeElement = document.activeElement;
  const isGmailCompose = activeElement.classList && 
                        (activeElement.classList.contains('Am') || 
                         activeElement.classList.contains('editable') ||
                         activeElement.closest('.Am.Al.editable'));
  
  const isEditableArea = activeElement.isContentEditable || 
                        activeElement.tagName === 'TEXTAREA' || 
                        activeElement.tagName === 'INPUT' ||
                        (activeElement.tagName === 'DIV' && activeElement.getAttribute('role') === 'textbox') ||
                        isGmailCompose;

  if (!isEditableArea) return;

  // Only update selection state, don't show/hide floating bar
  if (selection.rangeCount > 0 && text !== selectedText) {
    selectedText = text;
    lastSelection = selection.getRangeAt(0).cloneRange();
  }
}

function createFloatingBar() {
  console.log('Creating floating bar');
  floatingBar = document.createElement('div');
  floatingBar.id = 'navAssistFloatingBar';
  floatingBar.style.cssText = `
    position: absolute;
    display: none;
    padding: 8px;
    border-radius: 12px;
    background-color: var(--background-color);
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 12px var(--shadow-color);
    z-index: 2147483647;
    opacity: 0;
  `;
  
  floatingBar.innerHTML = `
    <button id="transferToChat" title="Transfer to Chat">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    </button>
    <button id="fixGrammar" title="Fix Grammar">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 4h10m-10 4h10M7 12h4M7 16h4"/>
        <path d="M15 16l2 2 4-4"/>
      </svg>
    </button>
    <button id="aiEdit" title="AI Edit">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
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

  // Update document click listener
  document.addEventListener('mousedown', (e) => {
    if (!floatingBar.contains(e.target)) {
      hideTooltip();
      // Reset AI edit input state and hide floating bar
      const aiEditInputContainer = floatingBar.querySelector('#aiEditInputContainer');
      const aiEditInput = floatingBar.querySelector('#aiEditInput');
      if (aiEditInputContainer) {
        aiEditInputContainer.style.display = 'none';
      }
      if (aiEditInput) {
        aiEditInput.value = '';
      }
      // Only hide floating bar if we're not over it
      if (!isMouseOverFloatingBar()) {
        hideFloatingBar(true);
      }
    }
  });

  console.log('Floating bar created and added to the document');
}

function addTooltipListeners(element, tooltipText) {
  let tooltipTimeout;
  
  element.addEventListener('mouseenter', (e) => {
    clearTimeout(tooltipTimeout);
    showTooltip(e, tooltipText);
  });
  
  element.addEventListener('mouseleave', () => {
    tooltipTimeout = setTimeout(hideTooltip, 100);
  });
}

function showTooltip(event, text) {
  // Hide any existing tooltips first
  hideTooltip();
  
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
      if (tooltip && tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    }, 200);
  }
}

function showFloatingBar(x, y, isCtrlA = false) {
  console.log('showFloatingBar called with coordinates:', x, y, 'isCtrlA:', isCtrlA);
  
  if (!floatingBar) {
    createFloatingBar();
  }

  // If already visible, don't show again
  if (isFloatingBarActuallyVisible()) {
    console.log('Floating bar already visible, skipping show');
    return;
  }

  // Remove any existing animation classes
  floatingBar.classList.remove('show', 'hide');
  
  // Get the selection range and its bounding rect
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  // Calculate position relative to viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const barWidth = floatingBar.offsetWidth;
  const barHeight = floatingBar.offsetHeight;
  
  // Increased vertical offset to position bar much higher above the text
  const verticalOffset = 80;
  
  // Try to position above first, with increased distance
  let top = rect.top - barHeight - verticalOffset;
  let positionBelow = false;
  
  // If there's not enough space above, try below with increased distance
  if (top < 10) {
    top = rect.bottom + verticalOffset;
    positionBelow = true;
  }
  
  // Calculate horizontal position (centered on selection)
  let left = rect.left + (rect.width / 2) - (barWidth / 2);
  
  // Keep within horizontal bounds with some padding
  left = Math.max(10, Math.min(viewportWidth - barWidth - 10, left));
  
  // Apply the calculated position, considering scroll position
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  
  floatingBar.style.left = `${left + scrollX}px`;
  floatingBar.style.top = `${top + scrollY}px`;
  floatingBar.style.display = 'flex';
  floatingBar.style.opacity = '0';
  
  // Force a reflow
  floatingBar.offsetHeight;
  
  // Add show animation class
  floatingBar.classList.add('show');
  floatingBar.style.opacity = '1';

  isFloatingBarVisible = true;
  isCtrlASelection = isCtrlA;
  console.log('Floating bar should now be visible at position:', { left, top, positionBelow });
}

function hideFloatingBar(force = false) {
  // Clear any pending show/hide operations
  clearTimeout(hideTimeout);
  clearTimeout(showTimeout);
  
  if (floatingBar && isFloatingBarVisible) {
    console.log('Attempting to hide floating bar. Force:', force);
    if (force) {
      console.log('Hiding floating bar');
      hideTooltip();
      isHiding = true;
      
      // Remove show class and add hide class
      floatingBar.classList.remove('show');
      floatingBar.classList.add('hide');
      floatingBar.style.opacity = '0';
      
      // Wait for animation to complete
      hideTimeout = setTimeout(() => {
        if (floatingBar) {
          floatingBar.style.display = 'none';
          floatingBar.classList.remove('hide');
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
          
          // Clear the selection
          const selection = window.getSelection();
          selection.removeAllRanges();
          
          // Reset hiding state after animation completes
          setTimeout(() => {
            isHiding = false;
          }, 50);
        }
      }, 200);
      
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
  // Hide tooltips when selection changes
  hideTooltip();
}

function isEditingAI() {
  const aiEditInputContainer = floatingBar.querySelector('#aiEditInputContainer');
  return aiEditInputContainer && aiEditInputContainer.style.display !== 'none';
}

function isMouseOverFloatingBar() {
  if (!floatingBar) return false;
  
  // Get the current mouse position from the mousemove event listener
  const mousePosition = {
    x: 0,
    y: 0
  };
  
  document.addEventListener('mousemove', (e) => {
    mousePosition.x = e.clientX;
    mousePosition.y = e.clientY;
  });
  
  const rect = floatingBar.getBoundingClientRect();
  
  return (
    mousePosition.x >= rect.left &&
    mousePosition.x <= rect.right &&
    mousePosition.y >= rect.top &&
    mousePosition.y <= rect.bottom
  );
}

function toggleAiEditInput(event) {
  if (!floatingBar) return;
  
  // Prevent the event from bubbling up
  event.preventDefault();
  event.stopPropagation();
  
  const aiEditInputContainer = floatingBar.querySelector('#aiEditInputContainer');
  const aiEditInput = floatingBar.querySelector('#aiEditInput');
  
  if (!aiEditInputContainer || !aiEditInput) return;
  
  if (aiEditInputContainer.style.display === 'none') {
    aiEditInputContainer.style.display = 'block';
    floatingBar.style.width = 'auto';
    
    // Update the floating bar position to ensure it's fully visible
    const rect = floatingBar.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    if (rect.right > viewportWidth - 10) {
      const newLeft = viewportWidth - rect.width - 10;
      floatingBar.style.left = `${newLeft}px`;
    }
    
    // Remove any existing event listeners
    const newInput = aiEditInput.cloneNode(true);
    aiEditInput.parentNode.replaceChild(newInput, aiEditInput);
    
    // Add all event listeners to the new input
    newInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        const userInstructions = e.target.value.trim();
        console.log('AI Edit instructions:', userInstructions);
        
        if (userInstructions) {
          // Get the current selection or use the last saved selection
          if (!selectedText && lastSelection) {
            const range = lastSelection.cloneRange();
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(range.cloneContents());
            selectedText = tempDiv.innerText;
          }
          
          if (selectedText) {
            performAiEdit(userInstructions);
          } else {
            console.error('No text selected for AI Edit');
          }
        }
      }
    });
    
    newInput.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    
    // Focus the input after a short delay
    setTimeout(() => {
      newInput.focus();
    }, 50);
  } else {
    aiEditInputContainer.style.display = 'none';
    floatingBar.style.width = '';
  }
}

function handleAiEditInputKeydown(event) {
  // Stop propagation to prevent Gmail from handling the event
  event.stopPropagation();
  
  if (event.key === 'Enter') {
    event.preventDefault();
    const userInstructions = event.target.value.trim();
    console.log('AI Edit instructions:', userInstructions);
    
    if (userInstructions) {
      // Get the current selection or use the last saved selection
      if (!selectedText && lastSelection) {
        const range = lastSelection.cloneRange();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(range.cloneContents());
        selectedText = tempDiv.innerText;
      }
      
      if (selectedText) {
        performAiEdit(userInstructions);
      } else {
        console.error('No text selected for AI Edit');
      }
    }
  }
}

function performAiEdit(userInstructions) {
  console.log('Performing AI Edit with instructions:', userInstructions);
  console.log('Selected text:', selectedText);
  
  if (selectedText) {
    const prompt = `Modify the following text following the users directions and instructions. No conversations, opinions or extra text on your reply, Only the modified text and nothing else:

User instructions: "${userInstructions}"

${selectedText}`;
    
    utils.showLoadingIndicator('Working on your text...');
    hideFloatingBar(true);
    
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
        console.error('Failed to edit text:', response?.error || 'Unknown error');
      }
    });
  } else {
    console.error('No valid selection found for AI Edit');
  }
}

function handleAiEditInputBlur(event) {
  // Don't hide if clicking inside the floating bar
  if (floatingBar && floatingBar.contains(event.relatedTarget)) {
    return;
  }
  
  // Only hide if we're not currently editing
  if (!isEditingAI()) {
    hideFloatingBar(true);
  }
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
  if (!lastSelection) return;
  
  try {
    const range = lastSelection.cloneRange();
    range.deleteContents();
    range.insertNode(document.createTextNode(newText));
  } catch (error) {
    console.error('Error replacing text:', error);
  }
}

function transferTextToChat(text) {
  if (!text) return;

  const chatInput = document.getElementById('chatInput');
  const textarea = chatInput?.querySelector('textarea');
  
  // If textarea exists and is visible, add text directly
  if (textarea && chatInput.offsetParent !== null) {
    // Get current cursor position and text
    const currentValue = textarea.value;
    const cursorPos = textarea.selectionStart;
    
    // Insert text at cursor position
    const beforeCursor = currentValue.substring(0, cursorPos);
    const afterCursor = currentValue.substring(cursorPos);
    const newValue = beforeCursor + (beforeCursor && !beforeCursor.endsWith('\n\n') ? '\n\n' : '') + 
                    text + 
                    (!afterCursor.startsWith('\n') ? '\n' : '');
    
    // Update textarea value
    textarea.value = newValue;
    
    // Calculate new cursor position (at the end of inserted text)
    const newCursorPos = beforeCursor.length + (beforeCursor ? 2 : 0) + text.length;
    
    // Set cursor position and focus
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
    
    // Adjust textarea height
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    
    // Hide floating bar
    hideFloatingBar(true);
  } else {
    // Only show chat window if textarea doesn't exist or isn't visible
    chatWindow.showChatWindow();
    
    // Wait for the textarea to be available
    const waitForTextarea = setInterval(() => {
      const chatInput = document.getElementById('chatInput');
      const textarea = chatInput?.querySelector('textarea');
      
      if (textarea) {
        clearInterval(waitForTextarea);
        
        // Add text to textarea
        textarea.value = text;
        textarea.setSelectionRange(0, 0);
        textarea.focus();
        
        // Adjust textarea height
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
        
        // Hide floating bar
        hideFloatingBar(true);
      }
    }, 50);
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
