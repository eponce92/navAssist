document.addEventListener('DOMContentLoaded', function() {
  const powerToggle = document.getElementById('powerToggle');
  const modelSelect = document.getElementById('modelSelect');

  // Load the power state
  chrome.storage.local.get('isExtensionActive', function(data) {
    powerToggle.checked = data.isExtensionActive !== false;
  });

  // Load the previously selected model (if any)
  chrome.storage.sync.get('selectedModel', (data) => {
    if (data.selectedModel) {
      modelSelect.value = data.selectedModel;
    }
  });

  powerToggle.addEventListener('change', function() {
    const isActive = this.checked;
    chrome.storage.local.set({isExtensionActive: isActive}, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleExtensionPower', isEnabled: isActive});
      });
    });
  });

  modelSelect.addEventListener('change', (event) => {
    const selectedModel = event.target.value;
    chrome.storage.sync.set({selectedModel: selectedModel}, () => {
      console.log('Model selected:', selectedModel);
    });
  });

  document.getElementById('reloadExtension').addEventListener('click', () => {
    console.log('Reloading extension...');
    chrome.runtime.reload();
  });
});