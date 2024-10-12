document.addEventListener('DOMContentLoaded', function() {
  const powerToggle = document.getElementById('powerToggle');
  const modelSelect = document.getElementById('modelSelect');
  const statusIndicator = document.getElementById('statusIndicator');
  const connectionStatus = document.getElementById('connectionStatus');
  const downloadSection = document.getElementById('downloadSection');
  const themeToggle = document.getElementById('themeToggle');
  const providerSelect = document.getElementById('providerSelect');
  const ollamaSection = document.getElementById('ollamaSection');
  const openrouterSection = document.getElementById('openrouterSection');
  const openrouterApiKey = document.getElementById('openrouterApiKey');

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

  // Load the selected provider
  chrome.storage.sync.get('selectedProvider', function(data) {
    providerSelect.value = data.selectedProvider || 'ollama';
    updateProviderUI(providerSelect.value);
  });

  providerSelect.addEventListener('change', function() {
    const selectedProvider = this.value;
    chrome.storage.sync.set({selectedProvider: selectedProvider}, function() {
      updateProviderUI(selectedProvider);
    });
  });

  openrouterApiKey.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent form submission if within a form
      const apiKey = this.value.trim();
      chrome.storage.sync.set({openrouterApiKey: apiKey}, function() {
        console.log('OpenRouter API key saved');
        checkOpenRouterConnection(apiKey);
      });
    }
  });

  openrouterApiKey.addEventListener('change', function() {
    const apiKey = this.value.trim();
    chrome.storage.sync.set({openrouterApiKey: apiKey}, function() {
      console.log('OpenRouter API key saved');
    });
  });

  function checkOpenRouterConnection(apiKey) {
    setConnectionStatus('checking');
    fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': chrome.runtime.getURL(''),
        'X-Title': 'navAssist'
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-70b-instruct:free",
        messages: [{ role: 'user', content: 'Say "Hello" and nothing else.' }]
      })
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('API request failed');
      }
    })
    .then(data => {
      if (data && data.choices && data.choices[0] && data.choices[0].message) {
        setConnectionStatus('openrouter-connected');
        console.log('OpenRouter API key validated successfully');
      } else {
        throw new Error('Unexpected response format');
      }
    })
    .catch(error => {
      console.error('Error checking OpenRouter connection:', error);
      setConnectionStatus('openrouter-error');
    });
  }

  function setConnectionStatus(status) {
    switch (status) {
      case 'checking':
        statusIndicator.className = 'status-indicator';
        connectionStatus.textContent = 'Checking connection...';
        break;
      case 'ollama-connected':
        statusIndicator.className = 'status-indicator status-connected';
        connectionStatus.textContent = 'Connected to Ollama';
        break;
      case 'ollama-disconnected':
        statusIndicator.className = 'status-indicator status-disconnected';
        connectionStatus.textContent = 'Disconnected from Ollama';
        modelSelect.innerHTML = '<option value="">Ollama not available</option>';
        break;
      case 'openrouter-connected':
        statusIndicator.className = 'status-indicator status-connected';
        connectionStatus.textContent = 'Connected to OpenRouter';
        break;
      case 'openrouter-error':
        statusIndicator.className = 'status-indicator status-disconnected';
        connectionStatus.textContent = 'Invalid OpenRouter API Key';
        break;
      default:
        statusIndicator.className = 'status-indicator';
        connectionStatus.textContent = 'Unknown status';
    }
  }

  function updateProviderUI(provider) {
    if (provider === 'ollama') {
      ollamaSection.style.display = 'block';
      openrouterSection.style.display = 'none';
      checkOllamaConnection();
    } else if (provider === 'openrouter') {
      ollamaSection.style.display = 'none';
      openrouterSection.style.display = 'block';
      chrome.storage.sync.get('openrouterApiKey', function(data) {
        const apiKey = data.openrouterApiKey || '';
        openrouterApiKey.value = apiKey;
        if (apiKey) {
          checkOpenRouterConnection(apiKey);
        } else {
          setConnectionStatus('openrouter-error');
        }
      });
    }
    updateDownloadSection();
  }

  function loadOpenRouterApiKey() {
    chrome.storage.sync.get('openrouterApiKey', function(data) {
      openrouterApiKey.value = data.openrouterApiKey || '';
    });
  }

  function checkOllamaConnection() {
    setConnectionStatus('checking');
    fetch('http://localhost:11434/api/tags')
      .then(response => response.json())
      .then(data => {
        if (data && data.models) {
          setConnectionStatus('ollama-connected');
          updateModelSelect(data.models);
          updateDownloadSection(); // Add this line
        } else {
          setConnectionStatus('ollama-disconnected');
        }
      })
      .catch(() => {
        setConnectionStatus('ollama-disconnected');
      });
  }

  function updateModelSelect(models) {
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

  function updateDownloadSection() {
    if (providerSelect.value === 'ollama') {
      const suggestedModels = ['llama3.2:latest', 'qwen2.5:latest', 'qwen2.5:3b'];
      downloadSection.innerHTML = '<h3>Download Suggested Models</h3>'; // Add heading
      
      // Fetch the list of installed models
      fetch('http://localhost:11434/api/tags')
        .then(response => response.json())
        .then(data => {
          const installedModels = data.models.map(model => model.name);
          
          suggestedModels.forEach(model => {
            if (!installedModels.includes(model)) {
              const item = createDownloadButton(model);
              downloadSection.appendChild(item);
            }
          });
          
          // Hide the download section if all suggested models are already installed
          if (downloadSection.children.length <= 1) { // Only the heading
            downloadSection.style.display = 'none';
          } else {
            downloadSection.style.display = 'block';
          }
        })
        .catch(error => {
          console.error('Error fetching installed models:', error);
          downloadSection.style.display = 'none';
        });
    } else {
      downloadSection.style.display = 'none';
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
                checkOllamaConnection(); // Refresh the model list
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

  // Initial setup
  updateProviderUI(providerSelect.value);
});