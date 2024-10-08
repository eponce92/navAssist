let chatHistories = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab.id;

  if (request.action === 'sendMessage') {
    handleSendMessage(request, sender, tabId);
    return true;
  } else if (request.action === 'clearChatHistory') {
    clearChatHistory(tabId);
    sendResponse({success: true});
    return true;
  } else if (request.action === 'summarizeContent') {
    handleSummarizeContent(sender, tabId);
    return true;
  } else if (request.action === 'getChatHistory') {
    getChatHistory(tabId, sendResponse);
    return true;
  }
});

function handleSendMessage(request, sender, tabId) {
  chrome.storage.sync.get('selectedModel', (data) => {
    const model = data.selectedModel || 'llama3.2';
    
    getChatHistory(tabId, (history) => {
      history.push({ role: 'user', content: request.message });
      saveChatHistory(tabId, history);
      streamResponse(model, history, sender.tab.id, true);
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
    
    chrome.storage.sync.get('selectedModel', (data) => {
      const model = data.selectedModel || 'llama3.2';
      
      const prompt = 
        `USE MARKDOWN FORMAT FOR YOUR RESPONSE !!!
        Summarize the following content in the same language as the content:

        Resuma el siguiente contenido en el mismo idioma que el contenido:

        Résumez le contenu suivant dans la même langue que le contenu:

        Zusammenfassen Sie den folgenden Inhalt in derselben Sprache wie den Inhalt:

        ${pageContent}`;
      
      getChatHistory(tabId, (history) => {
        history.push({ role: 'user', content: 'Please summarize the content of this page.' });
        saveChatHistory(tabId, history);
        streamResponse(model, [...history, { role: 'user', content: prompt }], sender.tab.id, true);
      });
    });
  });
}

function streamResponse(model, messages, tabId, updateChatHistory) {
  console.log('Starting streamResponse');
  fetch('http://localhost:11434/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: true
    })
  })
  .then(response => {
    console.log('Received response from API');
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
              const content = jsonData.choices[0].delta.content;
              if (content) {
                accumulatedResponse += content;
                buffer += content;
                
                if (buffer.length > 20 || /[.!?]/.test(buffer)) {
                  chrome.tabs.sendMessage(tabId, {action: 'streamResponse', reply: buffer, done: false});
                  buffer = '';
                }
              }
            } catch (error) {
              console.error('Error parsing JSON:', error);
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

// Clean up chat histories when tabs are closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  clearChatHistory(tabId);
  console.log(`Chat history for tab ${tabId} has been removed.`);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({isExtensionActive: true});
});
