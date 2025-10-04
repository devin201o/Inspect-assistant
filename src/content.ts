import type { ToastOptions } from './types';

// --- STATE ---
let currentToast: HTMLDivElement | null = null;
let toastTimeout: number | null = null;
let copyTimeout: number | null = null;
let currentModal: HTMLDivElement | null = null;

// --- MESSAGE LISTENER ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);

  if (message.type === 'SHOW_TOAST') {
    (async () => {
      await showToast(message.payload);
      sendResponse({ success: true });
    })();
    return true; // Indicate async response
  }

  if (message.type === 'SHOW_PROMPT_MODAL') {
    showPromptModal(message.payload.selectionText, message.payload.manualPrompt);
    sendResponse({ success: true });
    return false;
  }

  sendResponse({ success: true });
  return false;
});

// --- MODAL IMPLEMENTATION ---
function showPromptModal(selectionText: string, defaultPrompt: string) {
  dismissPromptModal();

  const backdrop = document.createElement('div');
  backdrop.id = 'ask-llm-modal-container';
  document.body.appendChild(backdrop);

  const shadowRoot = backdrop.attachShadow({ mode: 'open' });

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('styles/modal.css');
  shadowRoot.appendChild(styleLink);

  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'ask-llm-modal-backdrop';
  modalBackdrop.addEventListener('click', dismissPromptModal);

  const dialog = document.createElement('div');
  dialog.className = 'ask-llm-modal-dialog';
  dialog.addEventListener('click', (e) => e.stopPropagation());

  const header = document.createElement('div');
  header.className = 'ask-llm-modal-header';
  const title = document.createElement('h2');
  title.textContent = 'Ask LLM';
  header.appendChild(title);

  const body = document.createElement('div');
  body.className = 'ask-llm-modal-body';

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Enter your prompt...';
  textarea.value = defaultPrompt;
  textarea.maxLength = 200;

  const charCount = document.createElement('div');
  charCount.className = 'ask-llm-modal-char-count';
  const updateCharCount = () => {
      charCount.textContent = `${textarea.value.length} / ${textarea.maxLength}`;
  };
  textarea.addEventListener('input', updateCharCount);
  updateCharCount();

  body.appendChild(textarea);
  body.appendChild(charCount);

  const footer = document.createElement('div');
  footer.className = 'ask-llm-modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'ask-llm-modal-btn ask-llm-modal-btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = dismissPromptModal;

  const submitBtn = document.createElement('button');
  submitBtn.className = 'ask-llm-modal-btn ask-llm-modal-btn-primary';
  submitBtn.textContent = 'Submit';
  submitBtn.onclick = () => {
      const userPrompt = textarea.value.trim();
      if (userPrompt) {
          chrome.runtime.sendMessage({
              type: 'EXECUTE_MANUAL_PROMPT',
              payload: {
                  selectionText,
                  prompt: userPrompt,
              },
          });
          dismissPromptModal();
      }
  };

  footer.appendChild(cancelBtn);
  footer.appendChild(submitBtn);

  dialog.appendChild(header);
  dialog.appendChild(body);
  dialog.appendChild(footer);
  modalBackdrop.appendChild(dialog);
  shadowRoot.appendChild(modalBackdrop);

  currentModal = backdrop;

  document.addEventListener('keydown', handleEscapeForModal);

  textarea.focus();
  textarea.select();
}

function handleEscapeForModal(e: KeyboardEvent) {
  if (e.key === 'Escape') {
      dismissPromptModal();
  }
}

function dismissPromptModal() {
  if (currentModal) {
      currentModal.remove();
      currentModal = null;
  }
  document.removeEventListener('keydown', handleEscapeForModal);
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
      if (copyTimeout !== null) {
        clearTimeout(copyTimeout);
      }
      copyTimeout = window.setTimeout(() => {
        if (copyBtn) copyBtn.textContent = 'Copy';
      }, 2000);
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