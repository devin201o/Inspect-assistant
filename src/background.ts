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
  if (
    info.menuItemId !== CONTEXT_MENU_ID ||
    !info.selectionText ||
    !tab?.id ||
    !tab.url ||
    !/^(https?|file):/.test(tab.url)
  ) {
    return;
  }

  const { settings } = await chrome.storage.local.get('settings');
  const currentSettings: ExtensionSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };

  if (!currentSettings.apiKey) {
    await sendMessageToTab(tab.id, {
      type: 'SHOW_TOAST',
      payload: { message: 'Please set your API key in the extension options.', type: 'error' },
    });
    return;
  }

  if (currentSettings.promptMode === 'manual') {
    await sendMessageToTab(tab.id, {
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
    await updateContextMenu();

    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (tab.id) {
        await sendMessageToTab(tab.id, {
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

  await sendMessageToTab(tabId, {
    type: 'SHOW_TOAST',
    payload: { message: 'Asking LLM...', type: 'info', duration: 0 },
  });

  try {
    const response = await callLLM(text, currentSettings, customPrompt);
    await sendMessageToTab(tabId, {
      type: 'SHOW_TOAST',
      payload: {
        message: response.content || 'No response received',
        type: response.success ? 'success' : 'error',
        duration: currentSettings.toastDuration,
      },
    });
  } catch (error) {
    await sendMessageToTab(tabId, {
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
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Ask LLM',
      contexts: ['selection'],
    });
  }
}

async function sendMessageToTab(tabId: number, message: any) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.warn(`Could not send message to tab ${tabId}:`, error);
  }
}