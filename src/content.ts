import type { ToastOptions } from './types';

let currentToast: HTMLDivElement | null = null;
let toastTimeout: number | null = null;
let copyTimeout: number | null = null;

// Listen for messages from background script
// Use an async wrapper to allow `await` inside the listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  if (message.type === 'SHOW_TOAST') {
    (async () => {
      await showToast(message.payload);
      sendResponse({ success: true });
    })();
    // Return true to indicate we will send a response asynchronously
    return true;
  }
  // If not a toast message, respond synchronously
  sendResponse({ success: true });
  return false;
});

// Refactored to be async to handle the promise-based storage API
async function showToast(options: ToastOptions) {
  console.log('Showing toast:', options);

  // Await the settings from storage
  const result = await chrome.storage.local.get('settings');
  const position = result.settings?.toastPosition || options.position || 'bottom-right';

  // createToast now handles dismissal to ensure the operation is atomic
  createToast(options, position);
}

function createToast(options: ToastOptions, position: 'bottom-left' | 'bottom-right') {
  // THE FIX: Always dismiss the previous toast *before* creating a new one.
  // This prevents a race condition where a second toast could be created
  // before the first one is dismissed.
  dismissToast();
  const { message, type, duration = 20000 } = options;

  // Create container with Shadow DOM
  const container = document.createElement('div');
  container.id = 'ask-llm-toast-container';
  container.style.cssText = `
    position: fixed;
    ${position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;'}
    bottom: 20px;
    z-index: 2147483647;
  `;

  const shadowRoot = container.attachShadow({ mode: 'open' });

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `ask-llm-toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  // Apply styles
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

    .toast-success {
      border-left: 4px solid #10b981;
    }

    .toast-error {
      border-left: 4px solid #ef4444;
    }

    .toast-info {
      border-left: 4px solid #3b82f6;
    }

    .toast-content {
      flex: 1;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    .toast-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .toast-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      transition: background 0.2s;
    }

    .toast-btn:hover {
      background: #f3f4f6;
    }

    .toast-btn:focus {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    .close-btn {
      color: #6b7280;
      font-weight: bold;
    }

    .copy-btn {
      color: #3b82f6;
    }
  `;

  shadowRoot.appendChild(style);

  // Create content
  const contentDiv = document.createElement('div');
  contentDiv.className = 'toast-content';
  contentDiv.textContent = message;

  // Create actions
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'toast-actions';

  // Copy button (only for success messages)
  if (type === 'success') {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'toast-btn copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.setAttribute('aria-label', 'Copy response');
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(message);
      copyBtn.textContent = 'Copied!';
      // Clear any existing timeout to prevent race conditions
      if (copyTimeout !== null) {
        clearTimeout(copyTimeout);
      }
      copyTimeout = window.setTimeout(() => {
        if (copyBtn) copyBtn.textContent = 'Copy';
      }, 2000);
    };
    actionsDiv.appendChild(copyBtn);
  }

  // Close button
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

  // Auto-dismiss after duration (if duration > 0)
  if (duration > 0) {
    toastTimeout = window.setTimeout(dismissToast, duration);
  }

  // Add keyboard listener for Escape
  document.addEventListener('keydown', handleEscape);
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    dismissToast();
  }
}

function dismissToast() {
  if (currentToast) {
    currentToast.remove();
    currentToast = null;
  }
  // Use `!== null` to correctly handle timeout IDs that might be 0
  if (toastTimeout !== null) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  if (copyTimeout !== null) {
    clearTimeout(copyTimeout);
    copyTimeout = null;
  }
  document.removeEventListener('keydown', handleEscape);
}