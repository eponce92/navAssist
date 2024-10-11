document.addEventListener('DOMContentLoaded', function() {
  const powerToggle = document.getElementById('powerToggle');
  const modelSelect = document.getElementById('modelSelect');
  const statusIndicator = document.getElementById('statusIndicator');
  const connectionStatus = document.getElementById('connectionStatus');
  const downloadSection = document.querySelector('.download-section');

  // Check Ollama connection
  checkOllamaConnection();

  // Load the power state
  chrome.storage.local.get('isExtensionActive', function(data) {
    powerToggle.checked = data.isExtensionActive !== false;
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

  // Create download buttons for suggested models
  const suggestedModels = ['llama3.2:latest', 'qwen2.5:latest', 'qwen2.5:3b'];
  suggestedModels.forEach(model => {
    const button = createDownloadButton(model);
    downloadSection.appendChild(button);
  });

  // Fetch available models and update UI
  fetchModels();
});

function checkOllamaConnection() {
  fetch('http://localhost:11434/api/tags')
    .then(response => {
      if (response.ok) {
        setConnectionStatus(true);
        fetchModels();
      } else {
        setConnectionStatus(false);
      }
    })
    .catch(() => {
      setConnectionStatus(false);
    });
}

function setConnectionStatus(isConnected) {
  const statusIndicator = document.getElementById('statusIndicator');
  const connectionStatus = document.getElementById('connectionStatus');
  const modelSelect = document.getElementById('modelSelect');

  if (isConnected) {
    statusIndicator.classList.add('status-connected');
    statusIndicator.classList.remove('status-disconnected');
    connectionStatus.textContent = 'Connected to Ollama';
  } else {
    statusIndicator.classList.add('status-disconnected');
    statusIndicator.classList.remove('status-connected');
    connectionStatus.textContent = 'Disconnected from Ollama';
    modelSelect.innerHTML = '<option value="">Ollama not available</option>';
  }
}

function fetchModels() {
  fetch('http://localhost:11434/api/tags')
    .then(response => response.json())
    .then(data => {
      updateModelSelect(data.models);
      updateDownloadButtons(data.models);
    })
    .catch(error => {
      console.error('Error fetching models:', error);
      const modelSelect = document.getElementById('modelSelect');
      modelSelect.innerHTML = '<option value="">Error loading models</option>';
    });
}

function updateModelSelect(models) {
  const modelSelect = document.getElementById('modelSelect');
  modelSelect.innerHTML = ''; // Clear existing options

  if (models && models.length > 0) {
    models.forEach(model => {
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
}

function updateDownloadButtons(models) {
  const downloadSection = document.querySelector('.download-section');
  const buttons = downloadSection.querySelectorAll('.download-button');
  let allModelsDownloaded = true;

  buttons.forEach(button => {
    const modelName = button.dataset.model;
    const isDownloaded = models.some(model => model.name === modelName);
    if (isDownloaded) {
      button.remove();
    } else {
      button.disabled = false;
      allModelsDownloaded = false;
    }
  });

  // Remove the header if all suggested models are downloaded
  const sectionTitle = downloadSection.querySelector('.section-title');
  if (allModelsDownloaded) {
    if (sectionTitle) {
      sectionTitle.remove();
    }
    downloadSection.style.display = 'none'; // Hide the entire section
  } else {
    downloadSection.style.display = 'block'; // Show the section if there are models to download
  }
}

function createDownloadButton(modelName) {
  const button = document.createElement('button');
  button.className = 'download-button';
  button.dataset.model = modelName;
  button.innerHTML = `
    <span class="button-text">Download ${modelName}</span>
    <div class="spinner"></div>
  `;
  button.addEventListener('click', () => downloadModel(modelName));
  return button;
}

function downloadModel(modelName) {
  const button = document.querySelector(`.download-button[data-model="${modelName}"]`);
  const spinner = button.querySelector('.spinner');
  const buttonText = button.querySelector('.button-text');

  button.disabled = true;
  spinner.style.display = 'inline-block';
  buttonText.textContent = 'Downloading...';

  fetch('http://localhost:11434/api/pull', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: modelName, stream: true }),
  })
    .then(response => {
      const reader = response.body.getReader();
      let accumulatedData = '';

      function readStream() {
        reader.read().then(({ done, value }) => {
          if (done) {
            console.log('Download complete');
            button.remove();
            fetchModels(); // Refresh the model list
            return;
          }

          accumulatedData += new TextDecoder().decode(value);
          const lines = accumulatedData.split('\n');
          accumulatedData = lines.pop(); // Keep the last incomplete line

          lines.forEach(line => {
            if (line.trim() !== '') {
              const data = JSON.parse(line);
              updateDownloadStatus(button, data);
            }
          });

          readStream();
        }).catch(error => {
          console.error('Stream reading error:', error);
          buttonText.textContent = 'Download failed';
          button.disabled = false;
          spinner.style.display = 'none';
        });
      }

      readStream();
    })
    .catch(error => {
      console.error('Error initiating download:', error);
      buttonText.textContent = 'Download failed';
      button.disabled = false;
      spinner.style.display = 'none';
    });
}

function updateDownloadStatus(button, data) {
  const buttonText = button.querySelector('.button-text');
  switch (data.status) {
    case 'pulling manifest':
      buttonText.textContent = 'Pulling manifest...';
      break;
    case 'downloading':
      if (data.total && data.completed) {
        const progress = ((data.completed / data.total) * 100).toFixed(2);
        buttonText.textContent = `Downloading: ${progress}%`;
      } else {
        buttonText.textContent = 'Downloading...';
      }
      break;
    case 'verifying sha256 digest':
      buttonText.textContent = 'Verifying...';
      break;
    case 'writing manifest':
      buttonText.textContent = 'Writing manifest...';
      break;
    case 'removing any unused layers':
      buttonText.textContent = 'Cleaning up...';
      break;
    case 'success':
      buttonText.textContent = 'Download successful!';
      break;
    default:
      buttonText.textContent = `Status: ${data.status}`;
  }
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}