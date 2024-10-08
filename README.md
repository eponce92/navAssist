# <img src="icon.png" alt="navAssist Icon" width="48" height="48" style="vertical-align: middle;"> navAssist: Your AI-Powered Web Navigation Assistant

## 🌟 Features

- 💬 Chat with various Ollama models right in your browser
- 🔄 Seamlessly switch between different AI models
- 📊 Summarize web page content with a single click
- 📱 Responsive design with draggable and resizable chat window

## 🛠️ Installation

1. Clone this repository or download the ZIP file.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the extension directory.

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

2. Start the Ollama server:

   ```
   ollama serve
   ```

3. Click the navAssist icon in your Chrome toolbar to open the popup.
4. Select your preferred AI model from the dropdown menu.
5. Toggle the switch to enable navAssist.
6. Start chatting with your AI assistant on any web page!

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
