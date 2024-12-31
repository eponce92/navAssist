document.addEventListener('DOMContentLoaded', function() {
  // Initialize DOM elements with null checks
  const initElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
      console.error(`Element with id '${id}' not found`);
    }
    return element;
  };

  // Initialize all DOM elements
  const powerToggle = initElement('powerToggle');
  const statusIndicator = initElement('statusIndicator');
  const connectionStatus = initElement('connectionStatus');
  const downloadSection = initElement('downloadSection');
  const themeToggle = initElement('themeToggle');
  const providerSelect = initElement('providerSelect');
  const ollamaSection = initElement('ollamaSection');
  const openrouterSection = initElement('openrouterSection');
  const openrouterApiKey = initElement('openrouterApiKey');
  const predictionBarToggle = initElement('predictionBarToggle');
  const elevenLabsApiKey = initElement('elevenLabsApiKey');
  const ollamaModelSelect = initElement('ollamaModelSelect');
  const openrouterModelSelect = initElement('openrouterModelSelect');
  const voiceSelect = initElement('voiceSelect');
  const ttsModelSelect = initElement('ttsModelSelect');
  const ttsStatusIndicator = initElement('ttsStatusIndicator');
  const ttsConnectionStatus = initElement('ttsConnectionStatus');

  function setTTSConnectionStatus(status) {
    switch (status) {
      case 'checking':
        ttsStatusIndicator.className = 'status-indicator';
        ttsConnectionStatus.textContent = 'Checking connection...';
        break;
      case 'connected':
        ttsStatusIndicator.className = 'status-indicator status-connected';
        ttsConnectionStatus.textContent = 'Connected to ElevenLabs';
        break;
      case 'error':
        ttsStatusIndicator.className = 'status-indicator status-disconnected';
        ttsConnectionStatus.textContent = 'Invalid API Key';
        break;
      default:
        ttsStatusIndicator.className = 'status-indicator';
        ttsConnectionStatus.textContent = 'Enter API key';
    }
  }

  function applyTheme(isDarkTheme) {
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
  }

  // Load settings from storage
  function loadSettings() {
    chrome.storage.sync.get(
      ['isDarkTheme', 'isExtensionEnabled', 'elevenLabsApiKey', 'openrouterApiKey'],
      function (data) {
        themeToggle.checked = data.isDarkTheme !== false;
        applyTheme(data.isDarkTheme !== false);
        powerToggle.checked = data.isExtensionEnabled !== false;
        elevenLabsApiKey.value = data.elevenLabsApiKey || '';
        openrouterApiKey.value = data.openrouterApiKey || '';
        
        // Load prediction bar state separately from local storage
        chrome.storage.local.get('isPredictionBarEnabled', function(localData) {
          predictionBarToggle.checked = localData.isPredictionBarEnabled === true; // Must be explicitly true
        });
        
        // If OpenRouter is selected and API key exists, check connection
        if (providerSelect.value === 'openrouter' && data.openrouterApiKey) {
          checkOpenRouterConnection(data.openrouterApiKey);
        }

        // If ElevenLabs API key exists, load models and voices
        if (data.elevenLabsApiKey) {
          loadTTSModels();
          loadVoices(data.elevenLabsApiKey);
        }
      }
    );
  }

  // Save Eleven Labs API key
  elevenLabsApiKey.addEventListener('change', function() {
    const apiKey = this.value.trim();
    chrome.storage.sync.set({elevenLabsApiKey: apiKey}, function() {
      console.log('Eleven Labs API key saved');
      loadVoices(apiKey);
    });
  });

  // Load TTS models
  async function loadTTSModels() {
    const apiKey = elevenLabsApiKey.value.trim();
    if (!apiKey) {
      ttsModelSelect.innerHTML = '<option value="">Enter API key to load models</option>';
      setTTSConnectionStatus('error');
      return;
    }

    setTTSConnectionStatus('checking');
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/models', {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.message || 'Failed to fetch TTS models');
      }
      
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid models data received');
      }
      
      // Filter models that can do text-to-speech
      const ttsModels = data.filter(model => model.can_do_text_to_speech);
      updateTTSModelSelect(ttsModels);
      setTTSConnectionStatus('connected');
    } catch (error) {
      console.error('Error loading TTS models:', error);
      ttsModelSelect.innerHTML = `<option value="">Error: ${error.message}</option>`;
      setTTSConnectionStatus('error');
    }
  }

  function updateTTSModelSelect(models) {
    ttsModelSelect.innerHTML = '';
    
    if (models.length > 0) {
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.model_id;
        const languages = model.languages?.map(l => l.name).join(', ') || 'All languages';
        const description = model.description ? ` - ${model.description}` : '';
        const maxChars = model.max_characters_request_subscribed_user 
          ? ` (${model.max_characters_request_subscribed_user} chars max)` 
          : '';
        option.textContent = `${model.name} (${languages})${description}${maxChars}`;
        ttsModelSelect.appendChild(option);
      });
      
      // Load saved model if available
      chrome.storage.sync.get('selectedTTSModel', function(data) {
        if (data.selectedTTSModel) {
          ttsModelSelect.value = data.selectedTTSModel;
        } else {
          // Default to first model
          chrome.storage.sync.set({selectedTTSModel: models[0].model_id});
          ttsModelSelect.value = models[0].model_id;
        }
      });
    } else {
      ttsModelSelect.innerHTML = '<option value="">No models available</option>';
    }
  }

  ttsModelSelect.addEventListener('change', function() {
    const modelId = this.value;
    chrome.storage.sync.set({selectedTTSModel: modelId}, function() {
      console.log('TTS model selected:', modelId);
    });
  });

  // Load TTS models when API key changes
  elevenLabsApiKey.addEventListener('change', function() {
    const apiKey = this.value.trim();
    if (apiKey) {
      loadTTSModels();
      loadVoices(apiKey);
    } else {
      setTTSConnectionStatus('error');
      ttsModelSelect.innerHTML = '<option value="">Enter API key to load models</option>';
      voiceSelect.innerHTML = '<option value="">Enter API key to load voices</option>';
    }
  });
  
  async function loadVoices(apiKey) {
    if (!apiKey) {
      voiceSelect.innerHTML = '<option value="">Enter API key to load voices</option>';
      setTTSConnectionStatus('error');
      return;
    }

    setTTSConnectionStatus('checking');
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.message || 'Failed to fetch voices');
      }
      
      const data = await response.json();
      if (!data.voices || !Array.isArray(data.voices)) {
        throw new Error('Invalid voices data received');
      }
      
      updateVoiceSelect(data.voices);
      setTTSConnectionStatus('connected');
      
      // Load saved voice if available
      chrome.storage.sync.get('selectedVoiceId', function(savedData) {
        if (savedData.selectedVoiceId) {
          voiceSelect.value = savedData.selectedVoiceId;
        } else if (data.voices.length > 0) {
          // Default to first voice
          chrome.storage.sync.set({selectedVoiceId: data.voices[0].voice_id});
          voiceSelect.value = data.voices[0].voice_id;
        }
      });
    } catch (error) {
      console.error('Error loading voices:', error);
      voiceSelect.innerHTML = `<option value="">Error: ${error.message}</option>`;
      setTTSConnectionStatus('error');
    }
  }

  function updateVoiceSelect(voices) {
    voiceSelect.innerHTML = '';
    
    if (voices.length > 0) {
      voices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.voice_id;
        const labels = [];
        if (voice.category) labels.push(voice.category);
        if (voice.labels?.accent) labels.push(voice.labels.accent);
        if (voice.labels?.age) labels.push(voice.labels.age);
        if (voice.labels?.gender) labels.push(voice.labels.gender);
        const description = labels.length > 0 ? ` (${labels.join(', ')})` : '';
        option.textContent = `${voice.name}${description}`;
        voiceSelect.appendChild(option);
      });
    } else {
      voiceSelect.innerHTML = '<option value="">No voices available</option>';
    }
  }

  voiceSelect.addEventListener('change', function() {
    const voiceId = this.value;
    chrome.storage.sync.set({selectedVoiceId: voiceId}, function() {
      console.log('Voice selected:', voiceId);
    });
  });

  // Load the power state
  chrome.storage.local.get('isExtensionActive', function(data) {
    powerToggle.checked = data.isExtensionActive !== false;
  });

  // Load the theme state
  chrome.storage.sync.get('isDarkTheme', function(data) {
    themeToggle.checked = data.isDarkTheme !== false;
  });

  // Load the prediction bar state
  chrome.storage.local.get('isPredictionBarEnabled', function(data) {
    predictionBarToggle.checked = data.isPredictionBarEnabled !== false;
  });

  function sendMessageToActiveTab(message) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        const retry = (attempt = 0) => {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'ping'}, (response) => {
            if (chrome.runtime.lastError) {
              if (attempt < 5) {
                setTimeout(() => retry(attempt + 1), 200);
              } else {
                console.log('Content script not ready after retries');
              }
              return;
            }
            // Content script is ready, send the actual message
            chrome.tabs.sendMessage(tabs[0].id, message).catch(error => {
              console.log('Could not send message to tab:', error);
            });
          });
        };
        retry();
      }
    });
  }

  powerToggle.addEventListener('change', function() {
    const isActive = this.checked;
    chrome.storage.local.set({isExtensionActive: isActive}, function() {
      sendMessageToActiveTab({action: 'toggleExtensionPower', isEnabled: isActive});
    });
  });

  themeToggle.addEventListener('change', function() {
    const isDarkTheme = this.checked;
    chrome.storage.sync.set({isDarkTheme: isDarkTheme}, function() {
      applyTheme(isDarkTheme);
      sendMessageToActiveTab({action: 'toggleTheme', isDarkTheme: isDarkTheme});
    });
  });

  predictionBarToggle.addEventListener('change', function() {
    const isEnabled = this.checked;
    chrome.storage.local.set({isPredictionBarEnabled: isEnabled}, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'togglePredictionBar',
            isEnabled: isEnabled
          });
        }
      });
    });
  });

  ollamaModelSelect.addEventListener('change', (event) => {
    const selectedModel = event.target.value;
    chrome.storage.sync.set({ollamaSelectedModel: selectedModel}, () => {
      console.log('Ollama model selected:', selectedModel);
    });
  });

  openrouterModelSelect.addEventListener('change', (event) => {
    const selectedModel = event.target.value;
    chrome.storage.sync.set({openrouterSelectedModel: selectedModel}, () => {
      console.log('OpenRouter model selected:', selectedModel);
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
    // Clear any existing error states
    setConnectionStatus('checking');
    
    chrome.storage.sync.set({selectedProvider: selectedProvider}, function() {
      // Clear any existing UI state
      downloadSection.style.display = 'none';
      ollamaSection.style.display = 'none';
      openrouterSection.style.display = 'none';
      ollamaModelSelect.innerHTML = '';
      downloadSection.innerHTML = '';
      
      updateProviderUI(selectedProvider);
    });
  });

  openrouterApiKey.addEventListener('input', debounce(function() {
    const apiKey = this.value.trim();
    if (apiKey) {
      chrome.storage.sync.set({openrouterApiKey: apiKey}, function() {
        console.log('OpenRouter API key saved');
        checkOpenRouterConnection(apiKey);
      });
    } else {
      setConnectionStatus('openrouter-error');
    }
  }, 500));

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  async function checkOpenRouterConnection(apiKey) {
    setConnectionStatus('checking');
    try {
      const models = await fetchOpenRouterModels(apiKey);
      if (models.length === 0) {
        throw new Error('No models available');
      }
      updateOpenRouterModelSelect(models);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-Title': 'navAssist'
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat",
          messages: [{ role: 'user', content: 'Say "Hello" and nothing else.' }]
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error Response:', errorData);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.choices?.[0]?.message) {
        throw new Error('Invalid response format');
      }

      setConnectionStatus('openrouter-connected');
      console.log('OpenRouter API key validated successfully');
    } catch (error) {
      console.error('Error checking OpenRouter connection:', error);
      setConnectionStatus('openrouter-error');
    }
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
        ollamaModelSelect.innerHTML = '<option value="">Ollama not available</option>';
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

  async function fetchOpenRouterModels(apiKey) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-Title': 'navAssist'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch models');
      }
      
      const data = await response.json();
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid models data received');
      }
      return data.data;
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      return [];
    }
  }

  function updateOpenRouterModelSelect(models) {
    const select = document.getElementById('openrouterModelSelect');
    select.innerHTML = '';
    
    if (models.length > 0) {
      // Find DeepSeek model
      const deepseekModel = models.find(model => model.id === "deepseek/deepseek-chat");
      
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        const pricing = model.pricing?.prompt ? `$${model.pricing.prompt}/1K tokens` : 'free';
        const contextLength = model.context_length ? ` | ${model.context_length} tokens max` : '';
        option.textContent = `${model.name} (${pricing}${contextLength})`;
        select.appendChild(option);
      });
      
      chrome.storage.sync.get('openrouterSelectedModel', (data) => {
        // Default to DeepSeek if available, otherwise use saved model or first model
        if (deepseekModel) {
          select.value = deepseekModel.id;
          chrome.storage.sync.set({openrouterSelectedModel: deepseekModel.id});
        } else if (data.openrouterSelectedModel && models.some(m => m.id === data.openrouterSelectedModel)) {
          select.value = data.openrouterSelectedModel;
        } else {
          select.value = models[0].id;
          chrome.storage.sync.set({openrouterSelectedModel: models[0].id});
        }
      });
    } else {
      const option = document.createElement('option');
      option.value = "";
      option.textContent = "No models available";
      select.appendChild(option);
    }
  }

  async function updateProviderUI(provider) {
    // Reset UI state
    downloadSection.style.display = 'none';
    ollamaSection.style.display = 'none';
    openrouterSection.style.display = 'none';
    
    if (provider === 'ollama') {
      ollamaSection.style.display = 'block';
      checkOllamaConnection();
      updateDownloadSection();
    } else if (provider === 'openrouter') {
      openrouterSection.style.display = 'block';
      // Clear Ollama-related UI elements
      ollamaModelSelect.innerHTML = '';
      downloadSection.innerHTML = '';
      
      chrome.storage.sync.get('openrouterApiKey', async function(data) {
        const apiKey = data.openrouterApiKey || '';
        openrouterApiKey.value = apiKey;
        if (apiKey) {
          setConnectionStatus('checking');
          const models = await fetchOpenRouterModels(apiKey);
          updateOpenRouterModelSelect(models);
          checkOpenRouterConnection(apiKey);
        } else {
          setConnectionStatus('openrouter-error');
        }
      });
    }
  }

  function checkOllamaConnection() {
    setConnectionStatus('checking');
    fetch('http://localhost:11434/api/tags')
      .then(response => response.json())
      .then(data => {
        if (data && data.models) {
          setConnectionStatus('ollama-connected');
          updateModelSelect(data.models);
          updateDownloadSection();
        } else {
          setConnectionStatus('ollama-disconnected');
        }
      })
      .catch(() => {
        setConnectionStatus('ollama-disconnected');
      });
  }

  function updateModelSelect(models) {
    ollamaModelSelect.innerHTML = '';

    if (models && models.length > 0) {
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        ollamaModelSelect.appendChild(option);
      });

      chrome.storage.sync.get('selectedModel', (data) => {
        if (data.selectedModel) {
          ollamaModelSelect.value = data.selectedModel;
        } else {
          chrome.storage.sync.set({selectedModel: ollamaModelSelect.options[0].value});
        }
      });
    } else {
      const option = document.createElement('option');
      option.value = "";
      option.textContent = "No models available";
      ollamaModelSelect.appendChild(option);
    }
  }

  function updateDownloadSection() {
    // Only show download section for Ollama provider
    if (providerSelect.value !== 'ollama') {
      downloadSection.style.display = 'none';
      return;
    }

    // Check if Ollama is running before attempting to fetch models
    fetch('http://localhost:11434/api/tags')
      .then(response => {
        if (!response.ok) {
          throw new Error('Ollama server not responding');
        }
        return response.json();
      })
      .then(data => {
        if (data && data.models) {
          const suggestedModels = ['llama3.2:latest', 'qwen2.5:latest', 'qwen2.5:3b'];
          const installedModels = data.models.map(model => model.name);
          
          downloadSection.innerHTML = '<h3>Download Suggested Models</h3>';
          let hasModelsToDownload = false;
          
          suggestedModels.forEach(model => {
            if (!installedModels.includes(model)) {
              hasModelsToDownload = true;
              const item = createDownloadButton(model);
              downloadSection.appendChild(item);
            }
          });
          
          downloadSection.style.display = hasModelsToDownload ? 'block' : 'none';
        } else {
          downloadSection.style.display = 'none';
        }
      })
      .catch(error => {
        console.error('Error fetching installed models:', error);
        downloadSection.style.display = 'none';
        if (providerSelect.value === 'ollama') {
          setConnectionStatus('ollama-disconnected');
        }
      });
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
                checkOllamaConnection();
              }, 2000);
              return;
            }

            accumulatedData += new TextDecoder().decode(value);
            const lines = accumulatedData.split('\n');
            accumulatedData = lines.pop();

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
      
      if (percentage >= roundedPercentage && roundedPercentage <= 100) {
        console.log('%c[navAssist] Download progress: ' + roundedPercentage + '%', 'color: #2980b9; font-weight: bold;');
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
  loadSettings();
  updateProviderUI(providerSelect.value);
});
