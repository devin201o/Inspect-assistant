import { DEFAULT_SETTINGS } from './types';
import type { ExtensionSettings, LLMResponse } from './types';

const CONTEXT_MENU_ID = 'ask-llm';

// --- INITIALIZATION ---
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get('settings');
  if (!result.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  await updateContextMenu();
});

// --- LISTENERS ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SETTINGS_CHANGED') {
    updateContextMenu();
    sendResponse({ success: true });
    return;
  }

  if (message.type === 'EXECUTE_MANUAL_PROMPT') {
    (async () => {
      const { selectionText, prompt } = message.payload;
      const tabId = sender.tab?.id;
      if (tabId) {
        await processLLMRequest(selectionText, tabId, prompt);
      }
    })();
    sendResponse({ success: true });
    return true; // Indicate async response
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !tab.url || info.menuItemId !== CONTEXT_MENU_ID) {
    return;
  }

  // First, check if the user is trying to use the extension on a PDF.
  // This must be done before checking for selectionText, as the PDF viewer
  // may not correctly report the selected text to the context menu API.
  const isPdf = tab.url.endsWith('.pdf') || tab.url.includes('pdf.js/viewer.html');
  if (isPdf) {
    chrome.notifications.create(
      `pdf-notification-${tab.id || Date.now()}`,
      {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Ask LLM',
        message: 'This extension cannot be used on PDF files.',
        priority: 2,
      },
      (notificationId) => {
        if (chrome.runtime.lastError) {
          console.error(
            `Failed to create notification: ${chrome.runtime.lastError.message}`,
            notificationId
          );
        }
      }
    );
    return;
  }

  // Now that we've handled PDFs, we can safely check for selectionText.
  if (!info.selectionText) {
    return;
  }

  // Ensure the extension doesn't run on unsupported pages like chrome://
  if (!/^(https?|file):/.test(tab.url)) {
    return;
  }

  const { settings } = await chrome.storage.local.get('settings');
  const currentSettings: ExtensionSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };

  if (!currentSettings.apiKey) {
    await ensureAndSendMessage(tab.id, {
      type: 'SHOW_TOAST',
      payload: { message: 'Please set your API key in the extension options.', type: 'error' },
    });
    return;
  }

  if (currentSettings.promptMode === 'manual') {
    await ensureAndSendMessage(tab.id, {
      type: 'SHOW_INPUT_BOX',
      payload: {
        selectionText: info.selectionText,
      },
    });
  } else {
    await processLLMRequest(info.selectionText, tab.id);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-extension') {
    const { settings } = await chrome.storage.local.get('settings');
    const currentSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    
    currentSettings.enabled = !currentSettings.enabled;
    await chrome.storage.local.set({ settings: currentSettings });

    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (tab.id) {
        await ensureAndSendMessage(tab.id, {
          type: 'SHOW_TOAST',
          payload: {
            message: `Ask LLM ${currentSettings.enabled ? 'enabled' : 'disabled'}`,
            type: 'info',
            duration: 2000,
          },
        });
      }
    }
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    updateContextMenu();
  }
});

// --- CORE LOGIC ---
async function processLLMRequest(text: string, tabId: number, customPrompt?: string) {
  const { settings } = await chrome.storage.local.get('settings');
  const currentSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };

  const isReady = await ensureContentScript(tabId);
  if (!isReady) {
    showRefreshNotification(tabId);
    return;
  }

  await ensureAndSendMessage(tabId, {
    type: 'SHOW_TOAST',
    payload: { message: 'Asking LLM...', type: 'info', duration: 0 },
  });

  try {
    const response = await callLLM(text, currentSettings, customPrompt);
    await ensureAndSendMessage(tabId, {
      type: 'SHOW_TOAST',
      payload: {
        message: response.content || 'No response received',
        type: response.success ? 'success' : 'error',
        duration: currentSettings.toastDuration,
      },
    });
  } catch (error) {
    await ensureAndSendMessage(tabId, {
      type: 'SHOW_TOAST',
      payload: { message: String(error), type: 'error' },
    });
  }
}

import { DEFAULT_PROMPTS } from './prompts';

const MANUAL_MODE_PROMPT_APPENDIX = 'Please be concise, while still being clear and informative.';

async function callLLM(text: string, settings: ExtensionSettings, customPrompt?: string): Promise<LLMResponse> {
  const { apiKey, apiEndpoint } = settings;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': chrome.runtime.getURL(''),
    'X-Title': 'Ask LLM Extension',
  };

  const systemPrompt = customPrompt
    ? `${customPrompt} ${MANUAL_MODE_PROMPT_APPENDIX}`
    : DEFAULT_PROMPTS.conciseAcademic;

  const requestBody = {
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
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
  const content = data.choices?.[0]?.message?.content || 'No response';

  return { success: true, content };
}

// --- HELPERS ---
async function updateContextMenu() {
  const { settings } = await chrome.storage.local.get('settings');
  const enabled = settings?.enabled ?? DEFAULT_SETTINGS.enabled;

  await chrome.contextMenus.removeAll();

  if (enabled) {
    chrome.contextMenus.create(
      {
        id: CONTEXT_MENU_ID,
        title: 'Ask LLM',
        contexts: ['selection'],
      },
      () => {
        if (chrome.runtime.lastError) {
          // This error is expected if the menu already exists, which can happen
          // due to a race condition on install or reload. We can safely ignore it.
          const expectedError = `Cannot create item with duplicate id ${CONTEXT_MENU_ID}`;
          if (chrome.runtime.lastError.message !== expectedError) {
            console.error('Error creating context menu:', chrome.runtime.lastError);
          }
        }
      }
    );
  }
}

async function pingTab(tabId: number): Promise<boolean> {
  let timeout: NodeJS.Timeout;
  return new Promise((resolve) => {
    timeout = setTimeout(() => {
      console.log(`Ping timeout for tab ${tabId}`);
      resolve(false);
    }, 250);

    chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        console.log(`Ping failed for tab ${tabId}:`, chrome.runtime.lastError.message);
        resolve(false);
      } else if (response?.type === 'PONG') {
        resolve(true);
      } else {
        console.warn(`Unexpected response to ping in tab ${tabId}:`, response);
        resolve(false);
      }
    });
  });
}

async function reinjectContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    console.log(`Successfully reinjected content script into tab ${tabId}`);
    return await pingTab(tabId);
  } catch (error) {
    console.warn(`Failed to reinject content script into tab ${tabId}:`, error);
    return false;
  }
}

async function ensureContentScript(tabId: number): Promise<boolean> {
  const isAlive = await pingTab(tabId);
  if (isAlive) {
    return true;
  }
  console.log(`Content script in tab ${tabId} is not responding. Attempting to reinject.`);
  return await reinjectContentScript(tabId);
}

function showRefreshNotification(tabId: number) {
  chrome.notifications.create(`refresh-notification-${tabId || Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Ask LLM',
    message: 'The extension seems to be out of sync on this page. Please refresh the tab and try again.',
    priority: 2,
  });
}

export async function ensureAndSendMessage(tabId: number, message: any) {
  const isReady = await ensureContentScript(tabId);
  if (!isReady) {
    // If the script isn't ready, we can't show a toast. Show a system notification instead.
    showRefreshNotification(tabId);
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.warn(`sendMessage failed even after ensureContentScript for tab ${tabId}`, error);
    showRefreshNotification(tabId);
  }
}