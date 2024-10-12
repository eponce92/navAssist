# <img src="icon.png" alt="navAssist Icon" width="48" height="48" style="vertical-align: middle;"> navAssist: Your AI-Powered Web Navigation Assistant

## 🌟 Features

- 💬 Chat with AI models right in your browser
- 🔄 Seamlessly switch between different AI providers (Ollama and OpenRouter)
- 📊 Summarize web page content with a single click
- 📝 AI-powered text editing and grammar correction
- 🔮 Text prediction as you type (optional feature)
- 📱 Responsive design with draggable and resizable chat window
- 🌓 Dark mode support
- 🔌 Dynamic connection status indicator
- 📥 Easy model management with one-click downloads for suggested Ollama models

## Latest Release

### Version 1.2.0

- Added support for OpenRouter as an alternative AI provider
- Implemented AI-powered text editing feature
- Added text prediction functionality (optional, off by default)
- Improved floating bar for text selection actions
- Enhanced error handling and user feedback
- Updated UI with new toggles for prediction bar and dark mode

## 🛠️ Installation

1. Go to the [Releases](https://github.com/eponce92/navAssist/releases) page of this repository.
2. Download the `navAssist-v1.2.0.zip` file from the latest release.
3. Unzip the downloaded file.
4. Open Chrome and go to `chrome://extensions/`.
5. Enable "Developer mode" in the top right corner.
6. Click "Load unpacked" and select the unzipped folder.

The navAssist extension should now be installed and ready to use!

## 📋 Prerequisites

- For Ollama: Ollama must be installed and running on your local machine. You can download the latest version for macOS, Linux, or Windows from [Ollama's official website](https://ollama.com).
- For OpenRouter: You need to sign up for an account at [OpenRouter](https://openrouter.ai/) and obtain an API key.

## 🚀 Getting Started

1. If using Ollama, set the `OLLAMA_ORIGINS` environment variable to allow connections from Chrome extensions:

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

2. Start Ollama (if using):

   - Option 1 (Recommended): Simply open the Ollama application you installed.
   - Option 2 (Advanced): If you prefer using the command line, you can start the Ollama server by running:
     ```
     ollama serve
     ```

3. Click the navAssist icon in your Chrome toolbar to open the popup.
4. Choose your preferred AI provider (Ollama or OpenRouter).
5. If using OpenRouter, enter your API key in the settings.
6. The extension will automatically check the connection to the selected provider and display the status.
7. If using Ollama, you can download suggested models directly from the popup if they're not already installed.
8. Select your preferred AI model from the dropdown menu.
9. Toggle the switches to enable navAssist, prediction bar (if desired), and dark mode.
10. Start chatting with your AI assistant on any web page!

## 💡 Usage Tips

- Use the summarize button to quickly summarize page content.
- Select text on any webpage to access the floating bar with grammar correction and AI editing features.
- Use the prediction bar for text suggestions as you type (if enabled).
- Drag the chat window to reposition it on the page.
- Resize the chat window using the bottom-right corner handle.
- Toggle between sidebar and popup modes for the chat window.

## 🛠️ Technologies Used

- HTML5, CSS3, and JavaScript
- Chrome Extension APIs
- Ollama API for local AI model integration
- OpenRouter API for cloud-based AI models

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/eponce92/navAssist/issues).

## 📜 License

This project is [MIT](https://choosealicense.com/licenses/mit/) licensed.

## 🙏 Acknowledgements

- [Ollama](https://ollama.com) for providing local AI models and API
- [OpenRouter](https://openrouter.ai/) for cloud-based AI model access

---

Made with ❤️ by [eponce92](https://github.com/eponce92)
