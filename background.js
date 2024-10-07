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
  }
});