let chatHistory = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendMessage') {
    handleSendMessage(request, sender);
    return true; // Indicates that the response will be sent asynchronously
  } else if (request.action === 'clearChatHistory') {
    chatHistory = []; // Clear the chat history
    sendResponse({success: true});
    return true;
  } else if (request.action === 'summarizeContent') {
    handleSummarizeContent(sender);
    return true; // Indicates that the response will be sent asynchronously
  }
});

function handleSendMessage(request, sender) {
  chrome.storage.sync.get('selectedModel', (data) => {
    const model = data.selectedModel || 'llama3.2'; // Default to llama3.2 if no model is selected
    
    // Add the user's message to the chat history
    chatHistory.push({ role: 'user', content: request.message });
    
    streamResponse(model, chatHistory, sender.tab.id, true);
  });
}

function handleSummarizeContent(sender) {
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'getPageContent'}, pageContent => {
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
            `
            USE MARKDOWN FORMAT FOR YOUR RESPONSE !!!
            Summarize the following content in the same language as the content:

            Resuma el siguiente contenido en el mismo idioma que el contenido:

            Résumez le contenu suivant dans la même langue que le contenu:

            Zusammenfassen Sie den folgenden Inhalt in derselben Sprache wie den Inhalt:

            ${pageContent}         

            `;
          
          // We're not adding the summarization request to the visible chat history anymore
          // Instead, we're directly sending the prompt to the API
          streamResponse(model, [{ role: 'user', content: prompt }], sender.tab.id, false);
        });
      });
    } else {
      chrome.tabs.sendMessage(sender.tab.id, {action: 'streamResponse', reply: 'Error: No active tab found.', done: true});
    }
  });
}

function streamResponse(model, messages, tabId, updateChatHistory) {
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
    const reader = response.body.getReader();
    let accumulatedResponse = '';
    let buffer = '';

    function readStream() {
      reader.read().then(({ done, value }) => {
        if (done) {
          if (buffer) {
            chrome.tabs.sendMessage(tabId, {action: 'streamResponse', reply: buffer, done: false});
          }
          if (updateChatHistory) {
            chatHistory.push({ role: 'assistant', content: accumulatedResponse });
          }
          chrome.tabs.sendMessage(tabId, {action: 'streamResponse', reply: '', done: true});
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