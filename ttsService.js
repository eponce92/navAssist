async function textToSpeech(text, voiceId) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('API key not found');
  }

  const model = await getSelectedModel();
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate speech: ${errorText}`);
    }

    // Create a new Audio context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const reader = response.body.getReader();
    const chunks = [];

    // Read the stream
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine all chunks into a single Uint8Array
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const audioData = new Uint8Array(totalLength);
    let position = 0;
    for (const chunk of chunks) {
      audioData.set(chunk, position);
      position += chunk.length;
    }

    // Decode the audio data
    const audioBuffer = await audioContext.decodeAudioData(audioData.buffer);
    
    // Create source and connect to destination
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    // Start playing
    source.start(0);

    return source; // Return the audio source for control (stop, etc.)
  } catch (error) {
    console.error('Error in textToSpeech:', error);
    throw error;
  }
}

async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('elevenLabsApiKey', (data) => {
      resolve(data.elevenLabsApiKey);
    });
  });
}

async function getSelectedModel() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('selectedTTSModel', (data) => {
      resolve(data.selectedTTSModel || 'eleven_monolingual_v1');
    });
  });
}

export default {
  textToSpeech,
  getApiKey,
  getSelectedModel
};
