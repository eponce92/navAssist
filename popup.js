document.addEventListener('DOMContentLoaded', function() {
  const powerToggle = document.getElementById('powerToggle');
  const modelSelect = document.getElementById('modelSelect');

  // Load the power state
  chrome.storage.local.get('isExtensionActive', function(data) {
    powerToggle.checked = data.isExtensionActive !== false;
  });

  // Fetch available models
  fetchModels();

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

function fetchModels() {
  fetch('http://localhost:11434/api/tags')
    .then(response => response.json())
    .then(data => {
      const modelSelect = document.getElementById('modelSelect');
      modelSelect.innerHTML = ''; // Clear existing options

      if (data.models && data.models.length > 0) {
        data.models.forEach(model => {
          const option = document.createElement('option');
          option.value = model.name;
          option.textContent = model.name;
          modelSelect.appendChild(option);
        });

        // Load the previously selected model (if any)
        chrome.storage.sync.get('selectedModel', (data) => {
          if (data.selectedModel) {
            modelSelect.value = data.selectedModel;
          } else {
            // If no model was previously selected, select the first one
            chrome.storage.sync.set({selectedModel: modelSelect.options[0].value});
          }
        });
      } else {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No models available";
        modelSelect.appendChild(option);
      }
    })
    .catch(error => {
      console.error('Error fetching models:', error);
      const modelSelect = document.getElementById('modelSelect');
      modelSelect.innerHTML = '<option value="">Error loading models</option>';
    });
}