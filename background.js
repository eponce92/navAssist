let chatHistories = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : 'popup';

  switch (request.action) {
    case 'sendMessage':
      handleSendMessage(request, sender, tabId);
      return true;
    case 'clearChatHistory':
      clearChatHistory(tabId);
      sendResponse({success: true});
      return false;
    case 'summarizeContent':
      handleSummarizeContent(sender, tabId);
      return true;
    case 'getChatHistory':
      getChatHistory(tabId, sendResponse);
      return true;
    case 'fixGrammar':
      handleFixGrammar(request.prompt, tabId, sendResponse);
      return true;
    case 'getPrediction':
      handleGetPrediction(request.prompt, tabId, sendResponse);
      return true;
    case 'toggleExtensionPower':
      handleToggleExtensionPower(request.isEnabled, sender.tab.id);
      return false;
    case 'getExtensionState':
      handleGetExtensionState(sendResponse);
      return true;
    case 'getTabId':
      sendResponse({tabId: sender.tab.id});
      return true;
    case 'aiEdit':
      handleAiEdit(request.prompt, tabId, sendResponse);
      return true;
  }
});

function handleSendMessage(request, sender, tabId) {
  console.log('Handling send message request:', request);
  chrome.storage.sync.get([
    'selectedProvider', 
    'selectedModel', 
    'openrouterApiKey',
    'openrouterSelectedModel',
    'ollamaSelectedModel'
  ], (data) => {
    const provider = data.selectedProvider || 'ollama';
    let model;
    
    if (provider === 'ollama') {
      model = data.ollamaSelectedModel || data.selectedModel || 'llama3.2';
    } else {
      model = data.openrouterSelectedModel || 'deepseek/deepseek-chat';
    }
    
    const apiKey = data.openrouterApiKey;
    
    getChatHistory(tabId, (history) => {
      history.push({ role: 'user', content: request.message });
      saveChatHistory(tabId, history);
      streamResponse(provider, model, apiKey, history, tabId, true);
    });
  });
}

function handleSummarizeContent(sender, tabId) {
  chrome.tabs.sendMessage(sender.tab.id, {action: 'getPageContent'}, pageContent => {
    if (chrome.runtime.lastError) {
      console.error('Error getting page content:', chrome.runtime.lastError);
      chrome.tabs.sendMessage(sender.tab.id, {action: 'streamResponse', reply: 'Error: Unable to access page content.', done: true});
      return;
    }
    
    if (!pageContent) {
      console.error('No page content received');
      chrome.tabs.sendMessage(sender.tab.id, {action: 'streamResponse', reply: 'Error: No page content received.', done: true});
      return;
    }

    console.log('Page content received, length:', pageContent.length);
    
  chrome.storage.sync.get([
    'selectedProvider', 
    'selectedModel', 
    'openrouterApiKey',
    'openrouterSelectedModel',
    'ollamaSelectedModel'
  ], (data) => {
    const provider = data.selectedProvider || 'ollama';
    let model;
    
    if (provider === 'ollama') {
      model = data.ollamaSelectedModel || data.selectedModel || 'llama3.2';
    } else {
      model = data.openrouterSelectedModel || 'deepseek/deepseek-chat';
    }
    
    const apiKey = data.openrouterApiKey;
      
      const prompt = 
        `Summarize the following content in the same language as the content:

        Resuma el siguiente contenido en el mismo idioma que el contenido:

        Résumez le contenu suivant dans la même langue que le contenu:

        Zusammenfassen Sie den folgenden Inhalt in derselben Sprache wie den Inhalt:

        NEVER CHANGE THE LANGUAGE OF THE CONTENT, JUST SUMMARIZE IT.
        DO NOT USE CODE BLOCKS OR MARKDOWN FORMATTING IN YOUR RESPONSE.

        ${pageContent}`;
      
      getChatHistory(tabId, (history) => {
        history.push({ role: 'user', content: 'Please summarize the content of this page.' });
        saveChatHistory(tabId, history);
        streamResponse(provider, model, apiKey, [...history, { role: 'user', content: prompt }], tabId, true);
      });
    });
  });
}

function streamResponse(provider, model, apiKey, messages, tabId, updateChatHistory) {
  console.log('Starting streamResponse');
  
  let apiUrl, headers, body;
  
  if (!provider || !messages || messages.length === 0) {
    console.error('Invalid parameters:', { provider, messages });
    chrome.tabs.sendMessage(tabId, {
      action: 'streamResponse', 
      reply: 'Error: Missing required parameters', 
      done: true
    });
    return;
  }

  if (provider === 'openrouter' && !apiKey) {
    console.error('OpenRouter API key is missing');
    chrome.tabs.sendMessage(tabId, {
      action: 'streamResponse', 
      reply: 'Error: OpenRouter API key is required', 
      done: true
    });
    return;
  }

  if (provider === 'ollama') {
    apiUrl = 'http://localhost:11434/v1/chat/completions';
    headers = {
      'Content-Type': 'application/json',
    };
    body = JSON.stringify({
      model: model,
      messages: messages,
      stream: true
    });
  } else if (provider === 'openrouter') {
    apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': chrome.runtime.getURL(''),
      'X-Title': 'navAssist'
    };
    body = JSON.stringify({
      model: model || "deepseek/deepseek-chat",
      messages: messages,
      stream: true,
      max_tokens: 2000,
      temperature: 0.7,
      context_length: 64000,
      top_p: 0.9,
      frequency_penalty: 0,
      presence_penalty: 0
    });
  }

  console.log('Request configuration:', {
    provider,
    apiUrl,
    model: model || "deepseek/deepseek-chat",
    messageCount: messages.length,
    headers: {
      ...headers,
      'Authorization': headers.Authorization ? '(set)' : '(not set)'
    }
  });

  console.log('Making API request:', {
    url: apiUrl,
    model: JSON.parse(body).model,
    messageCount: messages.length
  });

  fetch(apiUrl, {
    method: 'POST',
    headers: headers,
    body: body
  })
  .then(async response => {
    console.log('Received response from API:', {
      status: response.status,
      statusText: response.statusText
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body received');
    }

    const reader = response.body.getReader();
    let accumulatedResponse = '';
    let buffer = '';

    function readStream() {
      reader.read().then(({ done, value }) => {
        if (done) {
          console.log('Stream completed');
          if (buffer) {
            chrome.tabs.sendMessage(tabId, {action: 'streamResponse', reply: buffer, done: false});
          }
          if (updateChatHistory) {
            getChatHistory(tabId, (history) => {
              history.push({ role: 'assistant', content: accumulatedResponse });
              saveChatHistory(tabId, history);
            });
          }
          chrome.tabs.sendMessage(tabId, {action: 'streamResponse', reply: '', done: true});
          
          console.log('Final raw response:', accumulatedResponse);
          chrome.tabs.sendMessage(tabId, {action: 'logFinalResponse', response: accumulatedResponse});
          
          return;
        }

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        lines.forEach(line => {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const jsonData = JSON.parse(line.slice(6));
              console.log('Received chunk:', jsonData);
              
              if (!jsonData.choices || !jsonData.choices[0] || !jsonData.choices[0].delta) {
                console.error('Invalid chunk format:', jsonData);
                return;
              }

              const content = jsonData.choices[0].delta.content;
              if (content) {
                accumulatedResponse += content;
                buffer += content;
                
                if (buffer.length > 20 || /[.!?]/.test(buffer)) {
                  console.log('Sending buffer:', buffer);
                  chrome.tabs.sendMessage(tabId, {action: 'streamResponse', reply: buffer, done: false});
                  buffer = '';
                }
              }
            } catch (error) {
              console.error('Error parsing JSON:', error, 'Line:', line);
            }
          }
        });

        readStream();
      });
    }

    readStream();
  })
  .catch(error => {
    console.error('Error:', error);
    chrome.tabs.sendMessage(tabId, {action: 'streamResponse', reply: 'Error: Unable to get a response from the API.', done: true});
  });
}

function getChatHistory(tabId, callback) {
  chrome.storage.local.get(`chatHistory_${tabId}`, (result) => {
    callback(result[`chatHistory_${tabId}`] || []);
  });
}

function saveChatHistory(tabId, history) {
  chrome.storage.local.set({ [`chatHistory_${tabId}`]: history });
}

function clearChatHistory(tabId) {
  chrome.storage.local.remove(`chatHistory_${tabId}`);
}

// Remove this listener to prevent clearing chat history when a tab is closed
// chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
//   clearChatHistory(tabId);
//   console.log(`Chat history for tab ${tabId} has been removed.`);
// });

chrome.runtime.onInstalled.addListener(() => {
  // Only set these values if they don't already exist
  chrome.storage.local.get(['isExtensionActive', 'isPredictionBarEnabled'], (data) => {
    const updates = {};
    if (data.isExtensionActive === undefined) {
      updates.isExtensionActive = true;
    }
    if (data.isPredictionBarEnabled === undefined) {
      updates.isPredictionBarEnabled = false; // Default to false
    }
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });
});

chrome.tabs.onCreated.addListener((tab) => {
  chrome.storage.local.get('isExtensionActive', (data) => {
    const isActive = data.isExtensionActive !== false; // Default to true if not set
    // Wait for content script to be ready
    const retry = (attempt = 0) => {
      chrome.tabs.sendMessage(tab.id, {action: 'ping'}, (response) => {
        if (chrome.runtime.lastError) {
          if (attempt < 5) {
            setTimeout(() => retry(attempt + 1), 200);
          } else {
            console.error('Content script not ready after retries');
          }
          return;
        }
        // Content script is ready, send the actual message
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleExtensionPower',
          isEnabled: isActive
        });
      });
    };
    retry();
  });
});

function handleFixGrammar(prompt, tabId, sendResponse) {
  chrome.storage.sync.get([
    'selectedProvider', 
    'selectedModel', 
    'openrouterApiKey',
    'openrouterSelectedModel',
    'ollamaSelectedModel'
  ], (data) => {
    const provider = data.selectedProvider || 'ollama';
    let model;
    
    if (provider === 'ollama') {
      model = data.ollamaSelectedModel || data.selectedModel || 'llama3.2';
    } else {
      model = data.openrouterSelectedModel || 'deepseek/deepseek-chat';
    }
    
    const apiKey = data.openrouterApiKey;
    
    let apiUrl, headers, body;
    
    if (!provider || !prompt) {
      console.error('Invalid parameters:', { provider, prompt });
      sendResponse({ error: 'Missing required parameters' });
      return;
    }

    if (provider === 'openrouter' && !apiKey) {
      console.error('OpenRouter API key is missing');
      sendResponse({ error: 'OpenRouter API key is required' });
      return;
    }

    if (provider === 'ollama') {
      apiUrl = 'http://localhost:11434/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
      };
      body = JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      });
    } else if (provider === 'openrouter') {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': chrome.runtime.getURL(''),
        'X-Title': 'navAssist'
      };
      body = JSON.stringify({
        model: model || "deepseek/deepseek-chat",
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        max_tokens: 2000,
        temperature: 0.7,
        context_length: 64000,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0
      });
    }

    console.log('Request configuration:', {
      provider,
      apiUrl,
      model: model || "deepseek/deepseek-chat",
      headers: {
        ...headers,
        'Authorization': headers.Authorization ? '(set)' : '(not set)'
      }
    });
    
    fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: body
    })
    .then(async response => {
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('API response:', data);
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from API');
      }
      const fixedText = data.choices[0].message.content.trim();
      console.log('Fixed text:', fixedText);
      sendResponse({ fixedText: fixedText });
    })
    .catch(error => {
      console.error('Error:', error);
      sendResponse({ error: error.message || 'Failed to fix grammar' });
    });
  });
}

function handleGetPrediction(prompt, tabId, sendResponse) {
  chrome.storage.sync.get([
    'selectedProvider', 
    'selectedModel', 
    'openrouterApiKey',
    'openrouterSelectedModel',
    'ollamaSelectedModel'
  ], (data) => {
    const provider = data.selectedProvider || 'ollama';
    let model;
    
    if (provider === 'ollama') {
      model = data.ollamaSelectedModel || data.selectedModel || 'llama3.2';
    } else {
      model = data.openrouterSelectedModel || 'deepseek/deepseek-chat';
    }
    
    const apiKey = data.openrouterApiKey;
    
    let apiUrl, headers, body;
    
    if (!provider || !prompt) {
      console.error('Invalid parameters:', { provider, prompt });
      sendResponse({ error: 'Missing required parameters' });
      return;
    }

    if (provider === 'openrouter' && !apiKey) {
      console.error('OpenRouter API key is missing');
      sendResponse({ error: 'OpenRouter API key is required' });
      return;
    }

    if (provider === 'ollama') {
      apiUrl = 'http://localhost:11434/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
      };
      body = JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      });
    } else if (provider === 'openrouter') {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': chrome.runtime.getURL(''),
        'X-Title': 'navAssist'
      };
      body = JSON.stringify({
        model: model || "deepseek/deepseek-chat",
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        max_tokens: 2000,
        temperature: 0.7,
        context_length: 64000,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0
      });
    }

    console.log('Request configuration:', {
      provider,
      apiUrl,
      model: model || "deepseek/deepseek-chat",
      headers: {
        ...headers,
        'Authorization': headers.Authorization ? '(set)' : '(not set)'
      }
    });
    
    fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: body
    })
    .then(async response => {
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('API response:', data);
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from API');
      }
      const prediction = data.choices[0].message.content.trim();
      console.log('Prediction:', prediction);
      sendResponse({ prediction: prediction });
    })
    .catch(error => {
      console.error('Error:', error);
      sendResponse({ error: error.message || 'Failed to get prediction' });
    });
  });
}

function handleToggleExtensionPower(isEnabled, tabId) {
  chrome.storage.local.set({ isExtensionActive: isEnabled }, () => {
    chrome.tabs.sendMessage(tabId, {
      action: 'toggleExtensionPower',
      isEnabled: isEnabled
    });
  });
}

function handleGetExtensionState(sendResponse) {
  chrome.storage.local.get('isExtensionActive', (result) => {
    sendResponse({ isExtensionActive: result.isExtensionActive !== false });
  });
}

function sendMessageWithRetry(tabId, message, maxRetries = 5) {
  let attempt = 0;
  
  function trySendMessage() {
    chrome.tabs.sendMessage(tabId, {action: 'ping'}, (response) => {
      if (chrome.runtime.lastError) {
        if (attempt < maxRetries) {
          attempt++;
          setTimeout(trySendMessage, 200 * attempt);
        }
        return;
      }
      chrome.tabs.sendMessage(tabId, message).catch(error => {
        console.log('Error sending message:', error);
      });
    });
  }
  
  trySendMessage();
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.local.get(['isExtensionActive', 'isPredictionBarEnabled'], (result) => {
      const isActive = result.isExtensionActive !== false;
      const isPredictionBarEnabled = result.isPredictionBarEnabled === true;
      
      // Send messages with retry logic
      sendMessageWithRetry(tabId, {
        action: 'toggleExtensionPower',
        isEnabled: isActive
      });
      
      if (isActive) {
        sendMessageWithRetry(tabId, {
          action: 'togglePredictionBar',
          isEnabled: isPredictionBarEnabled
        });
      }
    });
  }
});

function handleAiEdit(prompt, tabId, sendResponse) {
  chrome.storage.sync.get([
    'selectedProvider', 
    'selectedModel', 
    'openrouterApiKey',
    'openrouterSelectedModel',
    'ollamaSelectedModel'
  ], (data) => {
    const provider = data.selectedProvider || 'ollama';
    let model;
    
    if (provider === 'ollama') {
      model = data.ollamaSelectedModel || data.selectedModel || 'llama3.2';
    } else {
      model = data.openrouterSelectedModel || 'deepseek/deepseek-chat';
    }
    
    const apiKey = data.openrouterApiKey;
    
    let apiUrl, headers, body;
    
    if (!provider || !prompt) {
      console.error('Invalid parameters:', { provider, prompt });
      sendResponse({ error: 'Missing required parameters' });
      return;
    }

    if (provider === 'openrouter' && !apiKey) {
      console.error('OpenRouter API key is missing');
      sendResponse({ error: 'OpenRouter API key is required' });
      return;
    }

    if (provider === 'ollama') {
      apiUrl = 'http://localhost:11434/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
      };
      body = JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      });
    } else if (provider === 'openrouter') {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': chrome.runtime.getURL(''),
        'X-Title': 'navAssist'
      };
      body = JSON.stringify({
        model: model || "deepseek/deepseek-chat",
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        max_tokens: 2000,
        temperature: 0.7,
        context_length: 64000,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0
      });
    }

    console.log('Request configuration:', {
      provider,
      apiUrl,
      model: model || "deepseek/deepseek-chat",
      headers: {
        ...headers,
        'Authorization': headers.Authorization ? '(set)' : '(not set)'
      }
    });
    
    fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: body
    })
    .then(async response => {
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('API response:', data);
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from API');
      }
      const editedText = data.choices[0].message.content.trim();
      console.log('Edited text:', editedText);
      sendResponse({ editedText: editedText });
    })
    .catch(error => {
      console.error('Error:', error);
      sendResponse({ error: error.message || 'Failed to edit text' });
    });
  });
}
