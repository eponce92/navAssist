# <img src="icon.png" alt="navAssist Icon" width="48" height="48" style="vertical-align: middle;"> navAssist: Your AI-Powered Web Navigation Assistant

## 🌟 Features

- 💬 Chat with various Ollama models right in your browser
- 🔄 Seamlessly switch between different AI models
- 📊 Summarize web page content with a single click
- 📱 Responsive design with draggable and resizable chat window

## Latest Release

### Version 1.0.2

- Removed hardcoded model names and uses installed models instead

## 🛠️ Installation

1. Go to the [Releases](https://github.com/yourusername/navAssist/releases) page of this repository.
2. Download the `navAssist-vX.X.X.zip` file from the latest release.
3. Unzip the downloaded file.
4. Open Chrome and go to `chrome://extensions/`.
5. Enable "Developer mode" in the top right corner.
6. Click "Load unpacked" and select the unzipped folder.

The navAssist extension should now be installed and ready to use!

## 📋 Prerequisites

- Ollama must be installed and running on your local machine.
- Ensure the Ollama API is accessible at `http://localhost:11434`.

## 🚀 Getting Started

1. Set the `OLLAMA_ORIGINS` environment variable to allow connections from Chrome extensions:

   - On Windows:
     - Open Command Prompt or PowerShell as administrator
     - Run the following command:
       ```
       setx OLLAMA_ORIGINS "chrome-extension://*"
       ```
     - Restart your computer for the changes to take effect
   - On macOS/Linux:
     - Add the following line to your shell configuration file (e.g., `~/.bashrc`, `~/.zshrc`):
       ```
       export OLLAMA_ORIGINS="chrome-extension://*"
       ```
     - Restart your terminal or run `source ~/.bashrc` (or the appropriate config file)

2. Download the required Ollama models:

   Open a terminal and run the following commands to download the models:

   ```
   ollama pull llama3.2
   ollama pull qwen2.5:latest
   ollama pull qwen2.5:3b
   ollama pull my-dolphin-mistral-nemo:latest
   ollama pull gemma2
   ollama pull gemma2:2b
   ollama pull phi3.5
   ```

   This process may take some time depending on your internet connection and the size of the models.

3. Start the Ollama server:

   ```
   ollama serve
   ```

4. Click the navAssist icon in your Chrome toolbar to open the popup.
5. Select your preferred AI model from the dropdown menu.
6. Toggle the switch to enable navAssist.
7. Start chatting with your AI assistant on any web page!

## 💡 Usage Tips

- Use the summarize button to quickly summarize page content.
- Drag the chat window to reposition it on the page.
- Resize the chat window using the bottom-right corner handle.

## 🛠️ Technologies Used

- HTML5, CSS3, and JavaScript
- Chrome Extension APIs
- Ollama API for AI model integration

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/eponce92/navAssist/issues).

## 📜 License

This project is [MIT](https://choosealicense.com/licenses/mit/) licensed.

## 🙏 Acknowledgements

- [Ollama](https://ollama.ai/) for providing the AI models

---

Made with ❤️ by [eponce92](https://github.com/eponce92)

## Installation

1. Go to the [Releases](https://github.com/yourusername/navAssist/releases) page of this repository.
2. Download the `navAssist-vX.X.X.zip` file from the latest release.
3. Unzip the downloaded file.
4. Open Chrome and go to `chrome://extensions/`.
5. Enable "Developer mode" in the top right corner.
6. Click "Load unpacked" and select the unzipped folder.

The navAssist extension should now be installed and ready to use!
