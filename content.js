(async function() {
  let modules = {};
  
  async function loadModules() {
    try {
      const src = chrome.runtime.getURL('');
      const moduleNames = [
        'utils',
        'chatWindowCore',
        'chatWindowUI',
        'chatWindowVisibility',
        'floatingBar',
        'predictionBar',
        'ttsService'
      ];
      
      for (const name of moduleNames) {
        try {
          modules[name] = await import(src + name + '.js');
          console.log(`Successfully loaded module: ${name}`);
        } catch (error) {
          console.error(`Error loading module ${name}:`, error);
          modules[name] = null;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error in loadModules:', error);
      return false;
    }
  }

  // Wait for modules to load before continuing
  if (!await loadModules()) {
    console.error('Failed to load required modules. Extension may not function properly.');
    return;
  }

  let currentTheme = 'light';

  function applyTheme(isDarkTheme) {
    currentTheme = isDarkTheme ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (modules.chatWindowCore?.applyTheme) {
      modules.chatWindowCore.applyTheme(isDarkTheme);
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
  let isHandlingSelection = false;

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
    const chatWindow = await modules.chatWindowVisibility.default.createChatWindow();
    console.log('Chat window created:', chatWindow);

    // Load tab-specific settings
    chrome.runtime.sendMessage({action: 'getTabId'}, function(response) {
      const tabId = response.tabId;
      chrome.storage.local.get(`tabSettings_${tabId}`, function(result) {
        const tabSettings = result[`tabSettings_${tabId}`] || {};
        modules.chatWindowVisibility.default.loadTabSettings(tabSettings);
      });
    });

    // Create prediction bar only if enabled
    chrome.storage.local.get('isPredictionBarEnabled', function(data) {
      const isEnabled = data.isPredictionBarEnabled === true; // Must be explicitly true
      if (isEnabled) {
        // Add check for active element before creating prediction bar
        const activeElement = document.activeElement;
        const isAiEditInput = activeElement.id === 'aiEditInput';
        const isChatInterface = activeElement.id === 'messageInput' || 
                               activeElement.closest('#chatWindow') !== null;
        
        // Only create prediction bar if we're not in AI edit or chat
        if (!isAiEditInput && !isChatInterface) {
          modules.predictionBar.default.createPredictionBar();
          modules.predictionBar.default.addPredictionListeners();
        }
      } else {
        modules.predictionBar.default.removePredictionBar();
        modules.predictionBar.default.removePredictionListeners();
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
    window.matchMedia('(prefers-color-scheme: dark)').addListener(modules.chatWindowCore.applyTheme);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  function handleMouseUp(e) {
    if (!modules.chatWindowVisibility.default.isExtensionActive) return;
    if (isHandlingSelection) return;

    isHandlingSelection = true;
    console.log('mouseup event triggered');

    const selection = window.getSelection();
    selectedText = selection.toString().trim();

    console.log('Selected text:', selectedText);
    console.log('isFloatingBarVisible:', modules.floatingBar.default.isFloatingBarActuallyVisible());

    // Only show floating bar if we have text selected and it's not already visible
    if (selectedText && !modules.floatingBar.default.isFloatingBarActuallyVisible()) {
      console.log('Showing floating bar');
      lastSelection = selection.getRangeAt(0).cloneRange();
      const rect = lastSelection.getBoundingClientRect();
      modules.floatingBar.default.showFloatingBar(rect.left + window.scrollX, rect.top + window.scrollY);
      modules.floatingBar.default.updateSelection(selectedText, lastSelection);
    } else {
      console.log('No action taken: selectedText:', !!selectedText, 'isFloatingBarVisible:', modules.floatingBar.default.isFloatingBarActuallyVisible());
    }

    isCtrlASelection = false;
    modules.predictionBar.default.hidePredictionBar();
    
    // Reset the handling flag after a short delay
    setTimeout(() => {
      isHandlingSelection = false;
    }, 100);
  }

  function handleMouseDown(e) {
    // If clicking outside the floating bar and it's visible, hide it
    if (modules.floatingBar.default.isFloatingBarActuallyVisible() && 
        !modules.floatingBar.default.isFloatingBarContainingTarget(e.target) && 
        e.target.id !== 'navAssistFloatingBarTooltip' &&
        !modules.floatingBar.default.isEditingAI()) {
      console.log('Mousedown outside floating bar, hiding it');
      modules.floatingBar.default.hideFloatingBar(true);
      selectedText = ''; // Clear the selected text
      lastSelection = null; // Clear the last selection
      // Clear the selection
      const selection = window.getSelection();
      selection.removeAllRanges();
    }
  }

  function handleSelectionChange() {
    if (!modules.chatWindowVisibility.default.isExtensionActive) return;
    if (isHandlingSelection) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    // Get the active element to check where we're typing
    const activeElement = document.activeElement;
    
    // Check if we're in the AI edit input or chat interface
    const isAiEditInput = activeElement.id === 'aiEditInput';
    const isChatInterface = activeElement.id === 'messageInput' || 
                           activeElement.closest('#chatWindow') !== null;
    
    // Don't show predictions if we're in AI edit input or chat interface
    if (isAiEditInput || isChatInterface) {
      modules.predictionBar.default.hidePredictionBar();
      return;
    }
    
    if (text === '') {
      selectedText = '';
      lastSelection = null;
      modules.floatingBar.default.hideFloatingBar();
    }
  }

  function handleKeyDown(e) {
    if (!modules.chatWindowVisibility.default.isExtensionActive) return;

    if (e.ctrlKey && e.key === 'a') {
      setTimeout(() => {
        const selection = window.getSelection();
        selectedText = selection.toString().trim();
        
        console.log('Ctrl+A pressed, selected text:', selectedText);
        
        if (selectedText) {
          lastSelection = selection.getRangeAt(0).cloneRange();
          const rect = lastSelection.getBoundingClientRect();
          console.log('Selection rect:', rect);
          modules.floatingBar.default.showFloatingBar(rect.left + window.scrollX, rect.top + window.scrollY, true);
          modules.floatingBar.default.updateSelection(selectedText, lastSelection);  // Add this line
        }
      }, 0);
    }

    if (e.ctrlKey && e.code === 'Space' && modules.floatingBar.default.isFloatingBarActuallyVisible()) {
      e.preventDefault();
      modules.floatingBar.default.fixGrammar();
    }
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      modules.chatWindowVisibility.default.updateChatWindowVisibility();
    }
  }

  function showChatToggle() {
    console.log('Showing chat toggle button');
    
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
    }
    
    // Force button visibility and styles
    toggleButton.style.display = 'flex';
    toggleButton.style.position = 'fixed';
    toggleButton.style.right = '0';
    toggleButton.style.top = '50%';
    toggleButton.style.transform = 'translateY(-50%)';
    toggleButton.style.zIndex = '2147483647';
    toggleButton.style.backgroundColor = 'var(--primary-color)';
    toggleButton.style.color = 'white';
    
    console.log('Chat toggle button created/updated');
  }

  function handleShowChatWindow() {
    console.log('Show chat window button clicked');
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('Extension context invalidated, reinitializing...');
        initializeExtension();
        return;
      }
      
      modules.chatWindowVisibility.default.showChatWindow();
      
      // Apply theme after showing the window
      chrome.storage.sync.get('isDarkTheme', function(data) {
        const isDarkTheme = data.isDarkTheme !== false;
        applyTheme(isDarkTheme);
      });
      
      // Enable dragging and resizing if in popup mode
      if (!modules.chatWindowVisibility.default.isSidebar) {
        const chatWindow = document.querySelector('#chatWindow');
        modules.chatWindowUI.default.enableDragging(chatWindow);
        modules.chatWindowUI.default.enableResizing(chatWindow);
      }
    } catch (error) {
      console.error('Error showing chat window:', error);
      if (error.message.includes('Extension context invalidated')) {
        console.log('Reinitializing extension...');
        initializeExtension();
      }
    }
  }

// Add message listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ready: true});
    return true;
  }
    switch (request.action) {
      case 'toggleChat':
        modules.chatWindowVisibility.default.toggleSidebarMode();
        return false;
      case 'logFinalResponse':
        console.log('Final response from model:', request.response);
        return false;
      case 'toggleExtensionPower':
        modules.chatWindowVisibility.default.handleToggleExtensionPower(request.isEnabled);
        return false;
      case 'getPageContent':
        const pageContent = document.body.innerText;
        sendResponse(pageContent);
        return true;
      case 'toggleTheme':
        applyTheme(request.isDarkTheme);
        return false;
      case 'togglePredictionBar':
        if (request.isEnabled) {
          modules.predictionBar.default.createPredictionBar();
          modules.predictionBar.default.addPredictionListeners();
        } else {
          modules.predictionBar.default.removePredictionBar();
          modules.predictionBar.default.removePredictionListeners();
        }
        return false;
    }
  });

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
