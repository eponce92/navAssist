document.getElementById('toggleChat').addEventListener('click', () => {
  console.log('Toggle chat button clicked');
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleChat'}, response => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
      } else {
        console.log('Message sent successfully');
      }
    });
  });
});

document.getElementById('reloadExtension').addEventListener('click', () => {
  console.log('Reloading extension...');
  chrome.runtime.reload();
});

// Add model selection handling
document.getElementById('modelSelect').addEventListener('change', (event) => {
  const selectedModel = event.target.value;
  chrome.storage.sync.set({selectedModel: selectedModel}, () => {
    console.log('Model selected:', selectedModel);
  });
});

// Load the previously selected model (if any)
chrome.storage.sync.get('selectedModel', (data) => {
  if (data.selectedModel) {
    document.getElementById('modelSelect').value = data.selectedModel;
  }
});