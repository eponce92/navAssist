// UI-related functionality for the chat window

let isDragging = false;
let isResizing = false;
let isResizingSidebar = false;
let initialPos = { x: 0, y: 0 };
let initialSize = { width: 0, height: 0 };
let initialSidebarWidth = 500;

function handleMouseMove(e) {
  if (isDragging) {
    const dx = e.clientX - initialPos.x;
    const dy = e.clientY - initialPos.y;
    const newLeft = chatWindow.offsetLeft + dx;
    const newTop = chatWindow.offsetTop + dy;
    chatWindow.style.left = `${newLeft}px`;
    chatWindow.style.top = `${newTop}px`;
    initialPos = { x: e.clientX, y: e.clientY };
  } else if (isResizing) {
    const dx = e.clientX - initialPos.x;
    const dy = e.clientY - initialPos.y;
    const newWidth = Math.max(300, initialSize.width + dx);
    const newHeight = Math.max(400, initialSize.height + dy);
    requestAnimationFrame(() => {
      chatWindow.style.width = `${newWidth}px`;
      chatWindow.style.height = `${newHeight}px`;
    });
  } else if (isResizingSidebar) {
    const dx = initialPos.x - e.clientX;
    const newWidth = Math.max(300, initialSidebarWidth + dx);
    requestAnimationFrame(() => {
      chatWindow.style.width = `${newWidth}px`;
      document.body.style.marginRight = `${newWidth}px`;
    });
  }
}

function handleMouseUp() {
  isDragging = false;
  isResizing = false;
  isResizingSidebar = false;
  document.body.style.userSelect = '';
  chatWindow.classList.remove('dragging');
}

function startDragging(e) {
  isDragging = true;
  initialPos = { x: e.clientX, y: e.clientY };
  document.body.style.userSelect = 'none';
  chatWindow.classList.add('dragging');
  e.preventDefault();
}

function startResizing(e) {
  if (isSidebar) return;
  isResizing = true;
  const rect = chatWindow.getBoundingClientRect();
  initialPos = { x: e.clientX, y: e.clientY };
  initialSize = { width: rect.width, height: rect.height };
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function startResizingSidebar(e) {
  if (!isSidebar) return;
  isResizingSidebar = true;
  initialPos = { x: e.clientX, y: e.clientY };
  initialSidebarWidth = chatWindow.offsetWidth;
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResizeTextarea() {
  this.style.height = 'auto';
  this.style.height = `${this.scrollHeight}px`;
}

function addEventListeners() {
  const dragHandle = chatWindow.querySelector('#dragHandle');
  dragHandle.addEventListener('mousedown', startDragging);

  const chatHeader = chatWindow.querySelector('#chatHeader');
  chatHeader.addEventListener('mousedown', startDragging);

  const sendButton = chatWindow.querySelector('#sendMessage');
  sendButton.addEventListener('click', sendMessage);

  const messageInput = chatWindow.querySelector('#messageInput');
  messageInput.addEventListener('keydown', handleKeyDown);
  messageInput.addEventListener('input', autoResizeTextarea);

  const restartButton = chatWindow.querySelector('#restartChat');
  restartButton.addEventListener('click', restartChat);

  const resizeHandle = chatWindow.querySelector('#resizeHandle');
  resizeHandle.addEventListener('mousedown', startResizing);

  const summarizeButton = chatWindow.querySelector('#summarizeContent');
  summarizeButton.addEventListener('click', summarizePageContent);

  const toggleSidebarButton = chatWindow.querySelector('#toggleSidebar');
  toggleSidebarButton.addEventListener('click', toggleSidebarMode);

  const sidebarResizeHandle = chatWindow.querySelector('#sidebarResizeHandle');
  sidebarResizeHandle.addEventListener('mousedown', startResizingSidebar);

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  const hideButton = chatWindow.querySelector('#hideChat');
  hideButton.addEventListener('click', hideChatWindow);
}

export {
  handleMouseMove,
  handleMouseUp,
  startDragging,
  startResizing,
  startResizingSidebar,
  handleKeyDown,
  autoResizeTextarea,
  addEventListeners
};