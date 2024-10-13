(async function() {
  const src = chrome.runtime.getURL('');
  const utils = await import(src + 'utils.js');
  const chatWindowCore = await import(src + 'chatWindowCore.js');
  const chatWindowUI = await import(src + 'chatWindowUI.js');
  const chatWindowVisibility = await import(src + 'chatWindowVisibility.js');
  const floatingBar = await import(src + 'floatingBar.js');
  const predictionBar = await import(src + 'predictionBar.js');

  let currentTheme = 'light';

  function applyTheme(isDarkTheme) {
    currentTheme = isDarkTheme ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (chatWindowCore.applyTheme) {
      chatWindowCore.applyTheme(isDarkTheme);
    }
    console.log('Theme applied to document:', currentTheme);
    
    // Update the chat toggle button
    updateChatToggleButton(currentTheme);
  }

  function updateChatToggleButton(theme) {
    const toggleButton = document.getElementById('showChatToggle');
    if (toggleButton) {
      toggleButton.style.backgroundColor = 'var(--primary-color-hover)';
      toggleButton.style.color = 'white';
    }
  }

  // Apply initial theme
  chrome.storage.sync.get('isDarkTheme', function(data) {
    const isDarkTheme = data.isDarkTheme !== false; // Default to true if not set
    applyTheme(isDarkTheme);
  });

  let isGmail = window.location.hostname === 'mail.google.com';
  let selectedText = '';
  let lastSelection = null;
  let isCtrlASelection = false;
  let showFloatingBarTimeout = null;

  async function initializeExtension() {
    console.log('Initializing extension');
    await new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });

    console.log('DOM is ready, creating chat window');
    const chatWindow = await chatWindowVisibility.default.createChatWindow();
    console.log('Chat window created:', chatWindow);

    // Load tab-specific settings
    chrome.runtime.sendMessage({action: 'getTabId'}, function(response) {
      const tabId = response.tabId;
      chrome.storage.local.get(`tabSettings_${tabId}`, function(result) {
        const tabSettings = result[`tabSettings_${tabId}`] || {};
        // Set default to popup mode if not specified
        tabSettings.isSidebar = tabSettings.isSidebar !== undefined ? tabSettings.isSidebar : false;
        chatWindowVisibility.default.loadTabSettings(tabSettings);
      });
    });

    chrome.storage.local.get('isPredictionBarEnabled', function(result) {
      const isPredictionBarEnabled = result.isPredictionBarEnabled === true; // Default to false if not set
      if (isPredictionBarEnabled) {
        predictionBar.default.createPredictionBar();
        predictionBar.default.addPredictionListeners();
      }
    });

    completeInitialization();
  }

  function completeInitialization() {
    console.log('Completing initialization');
    addGlobalEventListeners();
    showChatToggle();
  }

  function addGlobalEventListeners() {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keydown', handleKeyDown);
    window.matchMedia('(prefers-color-scheme: dark)').addListener(chatWindowCore.applyTheme);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  function handleMouseUp(e) {
    if (!chatWindowVisibility.default.isExtensionActive) return;

    console.log('mouseup event triggered');

    const selection = window.getSelection();
    selectedText = selection.toString().trim();

    console.log('Selected text:', selectedText);
    console.log('isFloatingBarVisible:', floatingBar.default.isFloatingBarActuallyVisible());

    if (selectedText) {
      console.log('Showing floating bar');
      lastSelection = selection.getRangeAt(0).cloneRange();
      const rect = lastSelection.getBoundingClientRect();
      floatingBar.default.showFloatingBar(rect.left + window.scrollX, rect.top + window.scrollY);
      floatingBar.default.updateSelection(selectedText, lastSelection);
    } else if (!selectedText && floatingBar.default.isFloatingBarActuallyVisible() && !isCtrlASelection) {
      console.log('Hiding floating bar');
      floatingBar.default.hideFloatingBar();
    } else {
      console.log('No action taken: selectedText:', !!selectedText, 'isFloatingBarVisible:', floatingBar.default.isFloatingBarActuallyVisible());
    }

    isCtrlASelection = false;
    predictionBar.default.hidePredictionBar();
  }

  function handleMouseDown(e) {
    if (floatingBar.default.isFloatingBarActuallyVisible() && 
        !floatingBar.default.isFloatingBarContainingTarget(e.target) && 
        e.target.id !== 'navAssistFloatingBarTooltip' &&
        !floatingBar.default.isEditingAI()) {
      console.log('Mousedown outside floating bar, hiding it');
      floatingBar.default.hideFloatingBar(true);
    }
  }

  function handleSelectionChange() {
    if (!chatWindowVisibility.default.isExtensionActive) return;

    const selection = window.getSelection();
    if (selection.toString().trim() === '') {
      floatingBar.default.hideFloatingBar();
    }
  }

  function handleKeyDown(e) {
    if (!chatWindowVisibility.default.isExtensionActive) return;

    if (e.ctrlKey && e.key === 'a') {
      setTimeout(() => {
        const selection = window.getSelection();
        selectedText = selection.toString().trim();
        
        console.log('Ctrl+A pressed, selected text:', selectedText);
        
        if (selectedText) {
          lastSelection = selection.getRangeAt(0).cloneRange();
          const rect = lastSelection.getBoundingClientRect();
          console.log('Selection rect:', rect);
          floatingBar.default.showFloatingBar(rect.left + window.scrollX, rect.top + window.scrollY, true);
          floatingBar.default.updateSelection(selectedText, lastSelection);  // Add this line
        }
      }, 0);
    }

    if (e.ctrlKey && e.code === 'Space' && floatingBar.default.isFloatingBarActuallyVisible()) {
      e.preventDefault();
      floatingBar.default.fixGrammar();
    }
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      chatWindowVisibility.default.updateChatWindowVisibility();
    }
  }

  function showChatToggle() {
    if (!chatWindowVisibility.default.isExtensionActive) return;

    let toggleButton = document.getElementById('showChatToggle');
    if (!toggleButton) {
      toggleButton = document.createElement('button');
      toggleButton.id = 'showChatToggle';
      toggleButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      `;
      toggleButton.addEventListener('click', handleShowChatWindow);
      document.body.appendChild(toggleButton);
      
      // Position the toggle button on the right side of the window
      toggleButton.style.position = 'fixed';
      toggleButton.style.right = '0';
      toggleButton.style.top = '50%';
      toggleButton.style.transform = 'translateY(-50%)';
    }
    toggleButton.style.display = 'flex';
  }

  function handleShowChatWindow() {
    console.log('Show chat window button clicked');
    chatWindowVisibility.default.showChatWindow();
    
    // Apply theme after showing the window
    chrome.storage.sync.get('isDarkTheme', function(data) {
      const isDarkTheme = data.isDarkTheme !== false;
      applyTheme(isDarkTheme);
    });
    
    // Enable dragging and resizing (now always in popup mode by default)
    const chatWindow = document.querySelector('#chatWindow');
    chatWindowUI.default.enableDragging(chatWindow);
    chatWindowUI.default.enableResizing(chatWindow);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleChat') {
      chatWindowVisibility.default.toggleSidebarMode();
    }
    if (request.action === 'logFinalResponse') {
      console.log('Final response from model:', request.response);
    }
    if (request.action === 'toggleExtensionPower') {
      chatWindowVisibility.default.handleToggleExtensionPower(request.isEnabled);
    }
    if (request.action === 'getPageContent') {
      const pageContent = document.body.innerText;
      sendResponse(pageContent);
    }
    if (request.action === 'toggleTheme') {
      applyTheme(request.isDarkTheme);
    }
    if (request.action === 'togglePredictionBar') {
      handleTogglePredictionBar(request.isEnabled);
    }
  });

  function handleTogglePredictionBar(isEnabled) {
    if (isEnabled) {
      predictionBar.default.createPredictionBar();
      predictionBar.default.addPredictionListeners();
    } else {
      predictionBar.default.removePredictionBar();
      predictionBar.default.removePredictionListeners();
    }
  }

  initializeExtension();
})();

// Add this function to periodically check and remove aria-hidden
function ensureNoAriaHidden() {
  const toggleButton = document.getElementById('showChatToggle');
  if (toggleButton && toggleButton.getAttribute('aria-hidden')) {
    console.log('Removing unexpected aria-hidden attribute');
    toggleButton.removeAttribute('aria-hidden');
  }
}

// Call this function periodically
setInterval(ensureNoAriaHidden, 1000);
