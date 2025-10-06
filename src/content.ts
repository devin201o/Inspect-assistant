import type { ToastOptions } from './types';

// --- STATE ---
let currentToast: HTMLDivElement | null = null;
let toastTimeout: number | null = null;
let copyTimeout: number | null = null;
let currentInputBox: HTMLDivElement | null = null;
let lastMousePosition = { x: 0, y: 0 };

// --- EVENT LISTENERS ---

// Track mouse position to place the input box correctly
document.addEventListener('mousemove', (event) => {
  lastMousePosition = { x: event.clientX, y: event.clientY };
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_TOAST') {
    (async () => {
      await showToast(message.payload);
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.type === 'SHOW_INPUT_BOX') {
    showInputBox(message.payload.selectionText);
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
    return false; // Not async
  }

  sendResponse({ success: true });
  return false;
});

// --- INPUT BOX IMPLEMENTATION ---

function showInputBox(selectionText: string) {
  dismissInputBox(); // Ensure no other box is open

  const container = document.createElement('div');
  container.id = 'ask-llm-input-container';
  document.body.appendChild(container);

  const shadowRoot = container.attachShadow({ mode: 'open' });

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('styles/input-box.css');
  shadowRoot.appendChild(styleLink);

  const inputBox = document.createElement('div');
  inputBox.className = 'ask-llm-input-box-container';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Your prompt... (Press Enter to submit)';

  const helpText = document.createElement('p');
  helpText.textContent = 'Press Esc or click away to cancel.';

  inputBox.appendChild(input);
  inputBox.appendChild(helpText);
  shadowRoot.appendChild(inputBox);

  // Position the box near the cursor
  inputBox.style.left = `${lastMousePosition.x}px`;
  inputBox.style.top = `${lastMousePosition.y}px`;

  currentInputBox = container;

  // Handle submission
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const userPrompt = input.value.trim();
      if (userPrompt) {
        chrome.runtime.sendMessage({
          type: 'EXECUTE_MANUAL_PROMPT',
          payload: { selectionText, prompt: userPrompt },
        });
        dismissInputBox();
      }
    }
  });

  // Handle dismissal via Escape key
  document.addEventListener('keydown', handleEscapeForInputBox);

  // Handle dismissal via click outside
  setTimeout(() => {
    document.addEventListener('click', handleDocumentClickForInputBox);
  }, 0);

  input.focus();
}

function dismissInputBox() {
  if (currentInputBox) {
    currentInputBox.remove();
    currentInputBox = null;
  }
  document.removeEventListener('click', handleDocumentClickForInputBox);
  document.removeEventListener('keydown', handleEscapeForInputBox);
}

function handleDocumentClickForInputBox(e: MouseEvent) {
  if (currentInputBox && !currentInputBox.shadowRoot?.contains(e.target as Node)) {
    dismissInputBox();
  }
}

function handleEscapeForInputBox(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    dismissInputBox();
  }
}

// --- TOAST IMPLEMENTATION ---
async function showToast(options: ToastOptions) {
  const result = await chrome.storage.local.get('settings');
  const position = result.settings?.toastPosition || options.position || 'bottom-right';
  createToast(options, position);
}

function createToast(options: ToastOptions, position: 'bottom-left' | 'bottom-right') {
  dismissToast();
  const { message, type, duration = 20000 } = options;

  const container = document.createElement('div');
  container.id = 'ask-llm-toast-container';
  container.style.cssText = `
    position: fixed;
    ${position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;'}
    bottom: 20px;
    z-index: 2147483647;
  `;

  const shadowRoot = container.attachShadow({ mode: 'open' });

  const toast = document.createElement('div');
  toast.className = `ask-llm-toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  const style = document.createElement('style');
  style.textContent = `
    .ask-llm-toast {
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 16px 20px;
      max-width: 400px;
      min-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
      animation: slideIn 0.3s ease-out;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    @keyframes slideIn {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .toast-success { border-left: 4px solid #10b981; }
    .toast-error { border-left: 4px solid #ef4444; }
    .toast-info { border-left: 4px solid #3b82f6; }
    .toast-content { flex: 1; word-wrap: break-word; white-space: pre-wrap; }
    .toast-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .toast-btn { background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 12px; transition: background 0.2s; }
    .toast-btn:hover { background: #f3f4f6; }
    .toast-btn:focus { outline: 2px solid #3b82f6; outline-offset: 2px; }
    .close-btn { color: #6b7280; font-weight: bold; }
    .copy-btn { color: #3b82f6; }
  `;
  shadowRoot.appendChild(style);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'toast-content';
  contentDiv.textContent = message;

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'toast-actions';

  if (type === 'success') {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'toast-btn copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.setAttribute('aria-label', 'Copy response');
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(message);
      copyBtn.textContent = 'Copied!';
      if (copyTimeout !== null) clearTimeout(copyTimeout);
      copyTimeout = window.setTimeout(() => { if (copyBtn) copyBtn.textContent = 'Copy'; }, 2000);
    };
    actionsDiv.appendChild(copyBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-btn close-btn';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close notification');
  closeBtn.onclick = dismissToast;
  actionsDiv.appendChild(closeBtn);

  toast.appendChild(contentDiv);
  toast.appendChild(actionsDiv);
  shadowRoot.appendChild(toast);
  document.body.appendChild(container);

  currentToast = container;

  if (duration > 0) {
    toastTimeout = window.setTimeout(dismissToast, duration);
  }

  document.addEventListener('keydown', handleEscapeForToast);
}

function handleEscapeForToast(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    dismissToast();
  }
}

function dismissToast() {
  if (currentToast) {
    currentToast.remove();
    currentToast = null;
  }
  if (toastTimeout !== null) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  if (copyTimeout !== null) {
    clearTimeout(copyTimeout);
    copyTimeout = null;
  }
  document.removeEventListener('keydown', handleEscapeForToast);
}