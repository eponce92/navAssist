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
  `;
  document.body.appendChild(floatingBar);

  const transferButton = floatingBar.querySelector('#transferToChat');
  transferButton.addEventListener('click', transferSelectedTextToChat);

  const fixGrammarButton = floatingBar.querySelector('#fixGrammar');
  fixGrammarButton.addEventListener('click', fixGrammar);

  addTooltipListeners(transferButton, 'Transfer to Chat');
  addTooltipListeners(fixGrammarButton, 'Fix Grammar');

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
  
  floatingBar.style.opacity = '0';
  requestAnimationFrame(() => {
    floatingBar.style.opacity = '1';
  });

  isFloatingBarVisible = true;
  isCtrlASelection = isCtrlA;
  console.log('Floating bar should now be visible');
}

function hideFloatingBar() {
  if (floatingBar && isFloatingBarVisible && isFloatingBarActuallyVisible()) {
    console.log('Hiding floating bar');
    floatingBar.style.opacity = '0';
    setTimeout(() => {
      floatingBar.style.display = 'none';
      isFloatingBarVisible = false;
      isCtrlASelection = false;
      console.log('Floating bar hidden');
    }, 300);
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
    chatWindowVisibility.showChatWindow();
    hideFloatingBar();
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
    const prompt = `Fix this text grammar, don't change tone, language, or way of speaking, just fix errors. No chitchat or conversation, only reply with the fixed text. Keep the line breaks and spaces of the original text:\n\n${selectedText}`;
    
    utils.showLoadingIndicator();
    
    chrome.runtime.sendMessage({action: 'fixGrammar', prompt: prompt}, (response) => {
      utils.hideLoadingIndicator();
      
      if (response && response.fixedText) {
        console.log('Received fixed text:', response.fixedText);
        if (lastSelection) {
          const success = utils.replaceSelectedText(response.fixedText, lastSelection);
          if (success) {
            utils.showNotification('Grammar fixed successfully!', 'success');
          } else {
            utils.showNotification('Failed to replace text. Please try again.', 'error');
          }
        } else {
          console.error('No valid selection range found');
          utils.showNotification('No valid selection range found. Please try selecting the text again.', 'error');
        }
      } else {
        console.error('Failed to fix grammar');
        utils.showNotification('Failed to fix grammar. Please try again.', 'error');
      }
    });
    hideFloatingBar();
  } else {
    console.error('No valid selection found');
    utils.showNotification('No valid selection found. Please try again.', 'error');
  }
}

// Add this new function to update the selected text and selection range
function updateSelection(text, range) {
  selectedText = text;
  lastSelection = range;
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
  updateSelection  // Replace updateSelectedText with this new function
};