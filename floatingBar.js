import utils from './utils.js';
import * as chatWindowVisibility from './chatWindowVisibility.js';

let floatingBar = null;
let selectedText = '';
let lastSelection = null;
let isFloatingBarVisible = false;
let isCtrlASelection = false;

// Initialize selection change listener
document.addEventListener('selectionchange', handleSelectionChange);

function handleSelectionChange() {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  // If there's no text selected or the selection is collapsed
  if (!text || selection.isCollapsed) {
    // Only hide if we're not currently editing and not in Gmail compose
    const isGmailCompose = document.querySelector('.Am.Al.editable');
    if (!isEditingAI() && !isMouseOverFloatingBar() && !isGmailCompose) {
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
                        (activeElement.tagName === 'DIV' && activeElement.getAttribute('role') === 'textbox') ||
                        isGmailCompose;

  if (!isEditableArea) return;

  // Update the selection if there is text selected
  if (selection.rangeCount > 0) {
    updateSelection(text, selection.getRangeAt(0));
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    showFloatingBar(rect.left + window.scrollX, rect.top + window.scrollY);
  }
}

function createFloatingBar() {
  console.log('Creating floating bar');
  floatingBar = document.createElement('div');
  floatingBar.id = 'navAssistFloatingBar';
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

  // Add event listeners for AI edit input
  const aiEditInput = floatingBar.querySelector('#aiEditInput');
  aiEditInput.addEventListener('keydown', handleAiEditInputKeydown);
  aiEditInput.addEventListener('blur', handleAiEditInputBlur);

  addTooltipListeners(transferButton, 'Transfer to Chat');
  addTooltipListeners(fixGrammarButton, 'Fix Grammar');
  addTooltipListeners(aiEditButton, 'AI Edit');

  // Add document click listener to hide tooltips and handle clicks outside
  document.addEventListener('mousedown', (e) => {
    if (!floatingBar.contains(e.target)) {
      hideTooltip();
      // Only hide floating bar if we're not editing
      if (!isEditingAI()) {
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
  
  // Hide any existing tooltips when showing the floating bar
  hideTooltip();
  
  if (!floatingBar) {
    console.log('Creating floating bar');
    createFloatingBar();
  }
  
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
  
  // Default vertical offset (much larger to ensure visibility)
  const verticalOffset = 60;
  
  // Try to position above first
  let top = rect.top - barHeight - verticalOffset;
  let positionBelow = false;
  
  // If there's not enough space above, try below
  if (top < 10) {
    top = rect.bottom + verticalOffset;
    positionBelow = true;
  }
  
  // If neither above nor below has enough space, choose the side with more space
  if (top < 10 || top + barHeight > viewportHeight - 10) {
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    if (spaceAbove > spaceBelow) {
      top = Math.max(10, rect.top - barHeight - verticalOffset);
    } else {
      top = Math.min(viewportHeight - barHeight - 10, rect.bottom + verticalOffset);
    }
  }
  
  // Calculate horizontal position (centered on selection)
  let left = rect.left + (rect.width / 2) - (barWidth / 2);
  
  // Keep within horizontal bounds
  left = Math.max(10, Math.min(viewportWidth - barWidth - 10, left));
  
  // Apply the calculated position, considering scroll position
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  
  floatingBar.style.left = `${left + scrollX}px`;
  floatingBar.style.top = `${top + scrollY}px`;
  floatingBar.style.display = 'flex';
  floatingBar.style.position = 'absolute';
  floatingBar.style.zIndex = '2147483647';
  
  // Add a transition for smooth positioning
  floatingBar.style.transition = 'opacity 0.2s ease';
  floatingBar.style.opacity = '0';
  
  // Force a reflow before setting opacity to 1
  floatingBar.offsetHeight;
  floatingBar.style.opacity = '1';

  isFloatingBarVisible = true;
  isCtrlASelection = isCtrlA;
  console.log('Floating bar should now be visible at position:', { left, top, positionBelow });

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
      // Always hide tooltip first
      hideTooltip();
      
      // Hide the floating bar with transition
      floatingBar.style.opacity = '0';
      setTimeout(() => {
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
      }, 200); // Match the transition duration
      
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
    
    // Delay focus to ensure Gmail doesn't interfere
    setTimeout(() => {
      aiEditInput.focus();
      // Prevent Gmail from capturing the focus
      aiEditInput.addEventListener('blur', (e) => {
        if (isEditingAI()) {
          e.preventDefault();
          e.stopPropagation();
          aiEditInput.focus();
        }
      }, { once: true });
    }, 50);
    
    // Add click event listener to prevent hiding when clicking inside the input
    aiEditInput.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    
    // Prevent Gmail from handling keydown events
    aiEditInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    }, true);
  } else {
    aiEditInputContainer.style.display = 'none';
    floatingBar.style.width = '';
  }
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
