import utils from './utils.js';

let predictionBar = null;
let currentPrediction = '';
let jsonResponse = null;
let isTyping = false;
let typingTimer = null;
const TYPING_INTERVAL = 700; // ms

function createPredictionBar() {
  if (predictionBar) return;

  predictionBar = document.createElement('div');
  predictionBar.id = 'navAssistPredictionBar';
  predictionBar.style.cssText = `
    position: absolute;
    display: none;
    background-color: var(--primary-color);
    color: white;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    z-index: 2147483646;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  document.body.appendChild(predictionBar);
}

function showPredictionBar(x, y, prediction) {
  if (!predictionBar) {
    createPredictionBar();
  }

  // Add the key hint to the prediction
  const predictionWithHint = `${prediction} <span style="opacity: 0.7; font-size: 0.9em;">(Shift+Tab to accept)</span>`;

  predictionBar.innerHTML = predictionWithHint;
  
  const offset = 5; // Reduced offset for more precise positioning
  const viewportHeight = window.innerHeight;
  let top = y - predictionBar.offsetHeight - offset;
  
  if (top < 0) {
    top = y + offset; // Position below the cursor if not enough space above
  }
  
  if (top + predictionBar.offsetHeight > viewportHeight) {
    top = viewportHeight - predictionBar.offsetHeight - offset;
  }
  
  predictionBar.style.left = `${x}px`;
  predictionBar.style.top = `${top}px`;
  predictionBar.style.display = 'block';
  
  setTimeout(() => {
    predictionBar.style.opacity = '1';
  }, 10);
}

function hidePredictionBar() {
  if (predictionBar) {
    predictionBar.style.opacity = '0';
    setTimeout(() => {
      predictionBar.style.display = 'none';
    }, 300);
  }
}

function getTextBeforeCursor(element) {
  let text;
  if (element.isContentEditable) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(element);
    range.setEnd(range.endContainer, range.endOffset);
    text = range.toString();
  } else {
    text = element.value.substring(0, element.selectionStart);
  }
  
  // Limit the text to the last 1000 characters
  const maxLength = 1000;
  if (text.length > maxLength) {
    text = text.slice(-maxLength);
  }
  
  console.log('Text before cursor (limited to 1000 chars):', text);
  console.log('Length of text before cursor:', text.length);
  
  return text;
}

function insertPrediction(element) {
  if (jsonResponse) {
    const incompleteSentence = jsonResponse.incomplete_sentence.trim();
    const completeSentence = jsonResponse.complete_sentence.trim();
    
    // Extract the additional text from the model response
    const additionalText = completeSentence.slice(incompleteSentence.length).trim();
    
    if (element.isContentEditable) {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      let textBeforeCursor = preCaretRange.toString();
      
      // Determine the insertion point
      const lastWord = textBeforeCursor.split(/\s+/).pop();
      let insertionText = '';
      
      if (lastWord && additionalText.toLowerCase().startsWith(lastWord.toLowerCase())) {
        // We're midway through a word
        const completeWord = additionalText.split(/\s+/)[0];
        insertionText = completeWord.slice(lastWord.length) + additionalText.slice(completeWord.length);
      } else if (textBeforeCursor.endsWith(' ') || textBeforeCursor === '') {
        // We're after a space or at the beginning
        insertionText = additionalText;
      } else {
        // We're at the end of a word
        insertionText = ' ' + additionalText;
      }
      
      const textNode = document.createTextNode(insertionText);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      const start = element.selectionStart;
      const end = element.selectionEnd;
      const textBeforeCursor = element.value.substring(0, start);
      
      // Determine the insertion point
      const lastWord = textBeforeCursor.split(/\s+/).pop();
      let insertionText = '';
      
      if (lastWord && additionalText.toLowerCase().startsWith(lastWord.toLowerCase())) {
        // We're midway through a word
        const completeWord = additionalText.split(/\s+/)[0];
        insertionText = completeWord.slice(lastWord.length) + additionalText.slice(completeWord.length);
      } else if (textBeforeCursor.endsWith(' ') || textBeforeCursor === '') {
        // We're after a space or at the beginning
        insertionText = additionalText;
      } else {
        // We're at the end of a word
        insertionText = ' ' + additionalText;
      }
      
      const newText = textBeforeCursor + insertionText + element.value.substring(end);
      element.value = newText;
      const newCursorPosition = start + insertionText.length;
      element.setSelectionRange(newCursorPosition, newCursorPosition);
    }
    
    hidePredictionBar();
    currentPrediction = '';
    jsonResponse = null;
  }
}

function getCurrentPageUrl() {
  return window.location.href;
}

function triggerPrediction(element) {
  const textBeforeCursor = getTextBeforeCursor(element);
  const currentUrl = getCurrentPageUrl();
  
  const prompt = `Given the following context and text, 
  predict the next few words or complete the current word. 
  Predict what the user is typing next, as if you were the user.\n
  Provide the output in JSON format with the following fields:\n
  - incomplete_sentence: The incomplete sentence from the input, 
  including any partial word\n
  - complete_sentence: A possible completion of the sentence\n\n
  Examples:\n
  Input: "Hello, my name is Ernes"\n
  Output: {\n  
    "incomplete_sentence": "Hello, my name is Ernes",\n  
    "complete_sentence": "Hello, my name is Ernesto and I am a software engineer"\n
  }\n\n
  Input: "We booked a table for si"\n
  Output: {\n  
    "incomplete_sentence": "We booked a table for si",\n  
    "complete_sentence": "We booked a table for six people at 8pm tonight"\n
  }\n
  DONT USE MARKDOWN, JUST PLAIN TEXT, DONT USE bullet quotes for code block.\n
  Now, predict for the following text:\n
  ${textBeforeCursor}\n`;

  chrome.runtime.sendMessage({ action: 'getPrediction', prompt: prompt }, (response) => {
    if (response && response.prediction) {
      console.log('Full raw answer from model:', response.prediction);
      
      try {
        jsonResponse = JSON.parse(response.prediction);
        currentPrediction = jsonResponse.complete_sentence.substring(jsonResponse.incomplete_sentence.length).trim();
        const cursorPos = getCursorPosition(element);
        showPredictionBar(
          cursorPos.x + window.scrollX,
          cursorPos.y + window.scrollY,
          currentPrediction
        );
      } catch (error) {
        console.error('Error parsing JSON response:', error);
        jsonResponse = null;
      }
    }
  });
}

function getCursorPosition(element) {
  if (element.isContentEditable) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const clone = range.cloneRange();
    clone.selectNodeContents(element);
    clone.setEnd(range.endContainer, range.endOffset);
    const rect = clone.getBoundingClientRect();
    return { 
      x: rect.right, 
      y: rect.top 
    };
  } else {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    const lineHeight = parseInt(computedStyle.lineHeight);
    const paddingTop = parseInt(computedStyle.paddingTop);
    const borderTop = parseInt(computedStyle.borderTopWidth);
    const text = element.value.substring(0, element.selectionStart);
    const span = document.createElement('span');
    span.style.font = computedStyle.font;
    span.style.fontSize = computedStyle.fontSize;
    span.style.whiteSpace = 'pre-wrap';
    span.textContent = text;
    document.body.appendChild(span);
    const textWidth = span.offsetWidth;
    document.body.removeChild(span);
    const lines = Math.floor(textWidth / rect.width);
    return { 
      x: rect.left + (textWidth % rect.width), 
      y: rect.top + paddingTop + borderTop + (lines * lineHeight)
    };
  }
}

function addPredictionListeners() {
  document.addEventListener('focusin', (e) => {
    if (utils.isEditableElement(e.target)) {
      e.target.addEventListener('input', utils.handleInput);
      e.target.addEventListener('keydown', handleKeyDown);
    }
  });

  document.addEventListener('focusout', (e) => {
    if (utils.isEditableElement(e.target)) {
      e.target.removeEventListener('input', utils.handleInput);
      e.target.removeEventListener('keydown', handleKeyDown);
      hidePredictionBar();
    }
  });
}

function handleKeyDown(e) {
  if (!isExtensionActive) return;

  if (e.key === 'Enter') {
    if (!e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  } else if (e.key === 'Tab' && e.shiftKey && currentPrediction) {
    e.preventDefault();
    insertPrediction(e.target);
  } else if (e.key === 'Escape') {
    hidePredictionBar();
  } else {
    hidePredictionBar();
  }
}

export default {
  createPredictionBar,
  showPredictionBar,
  hidePredictionBar,
  getTextBeforeCursor,
  insertPrediction,
  getCurrentPageUrl,
  triggerPrediction,
  getCursorPosition,
  addPredictionListeners
};