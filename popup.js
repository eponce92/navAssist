document.addEventListener('DOMContentLoaded', function() {
  const powerToggle = document.getElementById('powerToggle');
  const modelSelect = document.getElementById('modelSelect');
  const statusIndicator = document.getElementById('statusIndicator');
  const connectionStatus = document.getElementById('connectionStatus');
  const downloadSection = document.getElementById('downloadSection');
  const themeToggle = document.getElementById('themeToggle');

  // Check Ollama connection
  checkOllamaConnection();

  // Load the power state
  chrome.storage.local.get('isExtensionActive', function(data) {
    powerToggle.checked = data.isExtensionActive !== false;
  });

  // Load the theme state
  chrome.storage.sync.get('isDarkTheme', function(data) {
    themeToggle.checked = data.isDarkTheme !== false; // Default to true if not set
  });

  powerToggle.addEventListener('change', function() {
    const isActive = this.checked;
    chrome.storage.local.set({isExtensionActive: isActive}, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleExtensionPower', isEnabled: isActive});
      });
    });
  });

  themeToggle.addEventListener('change', function() {
    const isDarkTheme = this.checked;
    chrome.storage.sync.set({isDarkTheme: isDarkTheme}, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleTheme', isDarkTheme: isDarkTheme});
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
    const item = createDownloadButton(model);
    downloadSection.appendChild(item);
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
  const downloadSection = document.getElementById('downloadSection');
  const downloadItems = downloadSection.querySelectorAll('.download-item');
  let allModelsDownloaded = true;

  downloadItems.forEach(item => {
    const modelName = item.dataset.model;
    const isDownloaded = models.some(model => model.name === modelName);
    if (isDownloaded) {
      item.remove();
    } else {
      allModelsDownloaded = false;
    }
  });

  // Show or hide the download section based on available models
  if (allModelsDownloaded) {
    downloadSection.style.display = 'none';
  } else {
    downloadSection.style.display = 'block';
  }
}

function createDownloadButton(modelName) {
  const item = document.createElement('div');
  item.className = 'download-item';
  item.dataset.model = modelName;
  item.innerHTML = `
    <span class="model-name">${modelName}</span>
    <button class="download-button">Download</button>
    <div class="progress-container" style="display: none;">
      <div class="progress-bar">
        <div class="progress"></div>
      </div>
      <span class="status">Preparing download...</span>
    </div>
  `;
  item.querySelector('.download-button').addEventListener('click', () => downloadModel(modelName));
  return item;
}

function downloadModel(modelName) {
  console.log('%c[navAssist] Starting download for model: ' + modelName, 'color: #2980b9; font-weight: bold;');

  const downloadItem = document.querySelector(`.download-item[data-model="${modelName}"]`);
  const button = downloadItem.querySelector('.download-button');
  const progressContainer = downloadItem.querySelector('.progress-container');
  const progress = downloadItem.querySelector('.progress');
  const status = downloadItem.querySelector('.status');

  button.style.display = 'none';
  progressContainer.style.display = 'block';
  status.textContent = 'Preparing download...';
  progress.style.width = '0%';

  console.log('%c[navAssist] Download UI updated: Button hidden, progress container shown', 'color: #2980b9;');
  console.log('%c[navAssist] Initial progress bar width: ' + progress.style.width, 'color: #2980b9;');

  fetch('http://localhost:11434/api/pull', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: modelName, stream: true }),
  })
    .then(response => {
      console.log('%c[navAssist] Fetch response received', 'color: #2980b9;');
      const reader = response.body.getReader();
      let accumulatedData = '';

      function readStream() {
        reader.read().then(({ done, value }) => {
          if (done) {
            console.log('%c[navAssist] Download stream complete', 'color: #2980b9; font-weight: bold;');
            updateDownloadStatus(downloadItem, { status: 'success' });
            setTimeout(() => {
              downloadItem.remove();
              fetchModels(); // Refresh the model list
            }, 2000);
            return;
          }

          accumulatedData += new TextDecoder().decode(value);
          const lines = accumulatedData.split('\n');
          accumulatedData = lines.pop(); // Keep the last incomplete line

          lines.forEach(line => {
            if (line.trim() !== '') {
              try {
                const data = JSON.parse(line);
                console.log('%c[navAssist] Received data:', 'color: #2980b9;', data);
                updateDownloadStatus(downloadItem, data);
              } catch (error) {
                console.error('%c[navAssist] Error parsing JSON:', 'color: #e74c3c;', error);
              }
            }
          });

          readStream();
        }).catch(error => {
          console.error('%c[navAssist] Stream reading error:', 'color: #e74c3c;', error);
          status.textContent = 'Download failed. Please try again.';
          button.style.display = 'block';
          progressContainer.style.display = 'none';
        });
      }

      readStream();
    })
    .catch(error => {
      console.error('%c[navAssist] Error initiating download:', 'color: #e74c3c;', error);
      status.textContent = 'Download failed. Please try again.';
      button.style.display = 'block';
      progressContainer.style.display = 'none';
    });
}

function updateDownloadStatus(downloadItem, data) {
  const status = downloadItem.querySelector('.status');
  const progress = downloadItem.querySelector('.progress');

  console.log('%c[navAssist] Updating download status:', 'color: #2980b9;', data);

  if (data.status === 'downloading' && data.total && data.completed) {
    const percentage = Math.floor((data.completed / data.total) * 100);
    const roundedPercentage = Math.floor(percentage / 25) * 25;
    
    status.textContent = `Downloading... ${percentage}%`;
    progress.style.width = `${percentage}%`;
    
    // Log only at 25% increments
    if (percentage >= roundedPercentage && roundedPercentage <= 100) {
      console.log('%c[navAssist] Download progress: ' + roundedPercentage + '%', 'color: #2980b9; font-weight: bold;');
      
      // Update the last logged percentage
      downloadItem.dataset.lastLoggedPercentage = roundedPercentage;
    }
  } else {
    switch (data.status) {
      case 'pulling manifest':
        status.textContent = 'Preparing download...';
        progress.style.width = '5%';
        console.log('%c[navAssist] Download progress: 0%', 'color: #2980b9; font-weight: bold;');
        break;
      case 'verifying sha256 digest':
      case 'writing manifest':
      case 'removing any unused layers':
        status.textContent = 'Finalizing download...';
        progress.style.width = '95%';
        break;
      case 'success':
        status.textContent = 'Download complete!';
        progress.style.width = '100%';
        console.log('%c[navAssist] Download progress: 100%', 'color: #2980b9; font-weight: bold;');
        break;
      default:
        status.textContent = 'Downloading...';
    }
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
