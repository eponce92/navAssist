// UI-related functionality for the chat window

let isDragging = false;
let isResizing = false;
let isResizingSidebar = false;
let initialPos = { x: 0, y: 0 };
let initialSize = { width: 0, height: 0 };
let initialSidebarWidth = 500;
let chatWindow = null;

export function initializeChatWindowUI(window) {
  chatWindow = window;
  const dragHandle = chatWindow.querySelector('#dragHandle');
  const resizeHandle = chatWindow.querySelector('#resizeHandle');
  const sidebarResizeHandle = chatWindow.querySelector('#sidebarResizeHandle');

  if (dragHandle) {
    dragHandle.addEventListener('mousedown', startDragging);
  }

  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', startResizing);
  }

  if (sidebarResizeHandle) {
    sidebarResizeHandle.addEventListener('mousedown', startResizingSidebar);
  }

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function startDragging(e) {
  isDragging = true;
  initialPos = { x: e.clientX, y: e.clientY };
  document.body.style.userSelect = 'none';
  chatWindow.classList.add('dragging');
  e.preventDefault();
}

function startResizing(e) {
  if (chatWindow.classList.contains('sidebar-mode')) return;
  isResizing = true;
  const rect = chatWindow.getBoundingClientRect();
  initialPos = { x: e.clientX, y: e.clientY };
  initialSize = { width: rect.width, height: rect.height };
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function startResizingSidebar(e) {
  if (!chatWindow.classList.contains('sidebar-mode')) return;
  isResizingSidebar = true;
  initialPos = { x: e.clientX, y: e.clientY };
  initialSidebarWidth = chatWindow.offsetWidth;
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function handleMouseMove(e) {
  if (isDragging) {
    const dx = e.clientX - initialPos.x;
    const dy = e.clientY - initialPos.y;
    const newLeft = chatWindow.offsetLeft + dx;
    const newTop = chatWindow.offsetTop + dy;
    requestAnimationFrame(() => {
      chatWindow.style.left = `${newLeft}px`;
      chatWindow.style.top = `${newTop}px`;
    });
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

export function enableDragging(window) {
  const dragHandle = window.querySelector('#dragHandle');
  if (dragHandle) {
    dragHandle.addEventListener('mousedown', startDragging);
  }
}

export function enableResizing(window) {
  const resizeHandle = window.querySelector('#resizeHandle');
  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', startResizing);
  }
}

export default {
  initializeChatWindowUI,
  enableDragging,
  enableResizing,
};