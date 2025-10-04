// Chrome Extension Background Script - No imports allowed
const DEFAULT_SETTINGS = {
  enabled: true,
  apiKey: '',
  apiEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
  toastDuration: 20000,
  toastPosition: 'bottom-right',
  provider: 'openrouter',
};

const CONTEXT_MENU_ID = 'ask-llm';

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  // Set default settings
  const result = await chrome.storage.local.get('settings');
  if (!result.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  
  // Create context menu
  await updateContextMenu();
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SETTINGS_CHANGED') {
    updateContextMenu();
  }
});

// Update context menu based on enabled state
async function updateContextMenu() {
  const { settings } = await chrome.storage.local.get('settings');
  const currentSettings = settings || DEFAULT_SETTINGS;

  await chrome.contextMenus.removeAll();

  if (currentSettings.enabled) {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Ask LLM',
      contexts: ['selection'],
    });
    console.log('Context menu created - extension enabled');
  } else {
    console.log('Context menu removed - extension disabled');
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText && tab?.id) {
    const { settings } = await chrome.storage.local.get('settings');
    const currentSettings = settings || DEFAULT_SETTINGS;

    // Validate API key
    if (!currentSettings.apiKey) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SHOW_TOAST',
        payload: {
          message: 'Please set your API key in the extension options.',
          type: 'error',
        },
      });
      return;
    }

    // Show loading toast
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_TOAST',
      payload: {
        message: 'Asking LLM...',
        type: 'info',
        duration: 0, // Don't auto-dismiss
      },
    });

    // Make API call
    try {
      const response = await callLLM(info.selectionText, currentSettings);
      
      chrome.tabs.sendMessage(tab.id, {
        type: 'SHOW_TOAST',
        payload: {
          message: response.content || 'No response received',
          type: response.success ? 'success' : 'error',
          duration: currentSettings.toastDuration,
        },
      });
    } catch (error) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SHOW_TOAST',
        payload: {
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'error',
        },
      });
    }
  }
});

// Handle toggle command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-extension') {
    const { settings } = await chrome.storage.local.get('settings');
    const currentSettings = settings || DEFAULT_SETTINGS;
    
    currentSettings.enabled = !currentSettings.enabled;
    await chrome.storage.local.set({ settings: currentSettings });
    await updateContextMenu();

    // Notify all tabs
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SHOW_TOAST',
          payload: {
            message: `Ask LLM ${currentSettings.enabled ? 'enabled' : 'disabled'}`,
            type: 'info',
            duration: 2000,
          },
        });
      }
    });
  }
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    updateContextMenu();
  }
});

// API call function - ONLY uses OpenRouter with Gemini 2.5 Flash
async function callLLM(text, settings) {
  const { apiKey, apiEndpoint } = settings;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': chrome.runtime.getURL(''),
    'X-Title': 'Ask LLM Extension',
  };

  const requestBody = {
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: 'You are a helpful assistant. Provide clear, concise answers.' },
      { role: 'user', content: text },
    ],
    max_tokens: 500,
  };

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Parse OpenRouter response
  const content = data.choices?.[0]?.message?.content || 'No response';

  return {
    success: true,
    content,
  };
}