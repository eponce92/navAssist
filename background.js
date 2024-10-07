let chatHistory = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendMessage') {
    chrome.storage.sync.get('selectedModel', (data) => {
      const model = data.selectedModel || 'llama3.2'; // Default to llama3.2 if no model is selected
      
      // Add the user's message to the chat history
      chatHistory.push({ role: 'user', content: request.message });
      
      fetch('http://localhost:11434/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: chatHistory
        })
      })
      .then(response => response.json())
      .then(data => {
        const reply = data.choices[0].message.content;
        // Add the assistant's reply to the chat history
        chatHistory.push({ role: 'assistant', content: reply });
        sendResponse({reply: reply});
      })
      .catch(error => {
        console.error('Error:', error);
        sendResponse({reply: 'Error: Unable to get a response from the API.'});
      });
    });
    return true; // Indicates that the response will be sent asynchronously
  } else if (request.action === 'clearChatHistory') {
    chatHistory = []; // Clear the chat history
    sendResponse({success: true});
    return true;
  } else if (request.action === 'summarizeContent') {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getPageContent'}, pageContent => {
          if (chrome.runtime.lastError) {
            console.error('Error getting page content:', chrome.runtime.lastError);
            sendResponse({summary: 'Error: Unable to access page content.'});
            return;
          }
          
          if (!pageContent) {
            console.error('No page content received');
            sendResponse({summary: 'Error: No page content received.'});
            return;
          }

          console.log('Page content received, length:', pageContent.length);
          
          chrome.storage.sync.get('selectedModel', (data) => {
            const model = data.selectedModel || 'llama3.2';
            
            // Detect the language of the page content
            const language = detectLanguage(pageContent);
            
            const prompt = `Summarize the following content in ${language}:\n\n${pageContent}`;
            
            fetch('http://localhost:11434/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: model,
                messages: [{role: 'user', content: prompt}]
              })
            })
            .then(response => response.json())
            .then(data => {
              const summary = data.choices[0].message.content;
              sendResponse({summary: summary});
            })
            .catch(error => {
              console.error('Error:', error);
              sendResponse({summary: 'Error: Unable to summarize content.'});
            });
          });
        });
      } else {
        sendResponse({summary: 'Error: No active tab found.'});
      }
    });
    return true; // Indicates that the response will be sent asynchronously
  }
});

// Simple language detection function (you may want to use a more sophisticated library for better accuracy)
function detectLanguage(text) {
  // This is a very basic detection. You might want to use a proper language detection library.
  const langPatterns = {
    en: /^[a-zA-Z\s.,!?]+$/,
    es: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s.,!?¿¡]+$/,
    fr: /^[a-zàâçéèêëîïôûùüÿæœA-ZÀÂÇÉÈÊËÎÏÔÛÙÜŸÆŒ\s.,!?]+$/,
    // Add more languages as needed
  };

  for (const [lang, pattern] of Object.entries(langPatterns)) {
    if (pattern.test(text.slice(0, 100))) { // Check first 100 characters
      return lang;
    }
  }

  return 'en'; // Default to English if no match is found
}