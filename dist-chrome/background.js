import { b as browser } from "./browser-polyfill.js";
import { D as DEFAULT_SETTINGS } from "./types.js";
const DEFAULT_PROMPTS = {
  conciseAcademic: `You are a concise academic assistant.
Respond with the final answer first, then a brief explanation.
Format:
0. If the text received is not a question, respond normally with a 15 word answer and you can disregard points 1-3.
1. If the text received is a question, start with "Answer: <short answer>" (max ~15 words).
2. Then 1–4 short sentences explaining why or how.
3. If unsure, say "Insufficient information".`
};
const CONTEXT_MENU_ID = "ask-llm";
browser.runtime.onInstalled.addListener(async () => {
  const result = await browser.storage.local.get("settings");
  if (!result.settings) {
    await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  await updateContextMenu();
});
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.type === "SETTINGS_CHANGED") {
    await updateContextMenu();
    return { success: true };
  }
  if (message.type === "EXECUTE_MANUAL_PROMPT") {
    const { selectionText, prompt } = message.payload;
    const tabId = sender.tab?.id;
    if (tabId) {
      processLLMRequest(selectionText, tabId, prompt);
    }
    return { success: true };
  }
});
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText || !tab?.id || !tab.url) {
    return;
  }
  if (!/^(https?|file):/.test(tab.url)) {
    return;
  }
  const result = await browser.storage.local.get("settings");
  const currentSettings = { ...DEFAULT_SETTINGS, ...result.settings || {} };
  if (!currentSettings.apiKey) {
    await ensureAndSendMessage(tab.id, {
      type: "SHOW_TOAST",
      payload: { message: "Please set your API key in the extension options.", type: "error" }
    });
    return;
  }
  if (currentSettings.promptMode === "manual") {
    await ensureAndSendMessage(tab.id, {
      type: "SHOW_INPUT_BOX",
      payload: {
        selectionText: info.selectionText
      }
    });
  } else {
    await processLLMRequest(info.selectionText, tab.id);
  }
});
browser.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-extension") {
    const { settings } = await browser.storage.local.get("settings");
    const currentSettings = { ...DEFAULT_SETTINGS, ...settings || {} };
    currentSettings.enabled = !currentSettings.enabled;
    await browser.storage.local.set({ settings: currentSettings });
    await updateContextMenu();
    const tabs = await browser.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
      if (tab.id) {
        await ensureAndSendMessage(tab.id, {
          type: "SHOW_TOAST",
          payload: {
            message: `Ask LLM ${currentSettings.enabled ? "enabled" : "disabled"}`,
            type: "info",
            duration: 2e3
          }
        });
      }
    }
  }
});
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.settings) {
    updateContextMenu();
  }
});
async function processLLMRequest(text, tabId, customPrompt) {
  const { settings } = await browser.storage.local.get("settings");
  const currentSettings = { ...DEFAULT_SETTINGS, ...settings || {} };
  const isReady = await ensureContentScript(tabId);
  if (!isReady) {
    showRefreshNotification(tabId);
    return;
  }
  await ensureAndSendMessage(tabId, {
    type: "SHOW_TOAST",
    payload: { message: "Asking LLM...", type: "info", duration: 0 }
  });
  try {
    const response = await callLLM(text, currentSettings, customPrompt);
    await ensureAndSendMessage(tabId, {
      type: "SHOW_TOAST",
      payload: {
        message: response.content || "No response received",
        type: response.success ? "success" : "error",
        duration: currentSettings.toastDuration
      }
    });
  } catch (error) {
    await ensureAndSendMessage(tabId, {
      type: "SHOW_TOAST",
      payload: { message: String(error), type: "error" }
    });
  }
}
const MANUAL_MODE_PROMPT_APPENDIX = "Please be concise, while still being clear and informative.";
async function callLLM(text, settings, customPrompt) {
  const { apiKey, apiEndpoint } = settings;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "HTTP-Referer": browser.runtime.getURL(""),
    "X-Title": "Ask LLM Extension"
  };
  const systemPrompt = customPrompt ? `${customPrompt} ${MANUAL_MODE_PROMPT_APPENDIX}` : DEFAULT_PROMPTS.conciseAcademic;
  const requestBody = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text }
    ],
    max_tokens: 500
  };
  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "No response";
  return { success: true, content };
}
async function updateContextMenu() {
  const { settings } = await browser.storage.local.get("settings");
  const enabled = settings?.enabled ?? DEFAULT_SETTINGS.enabled;
  await browser.contextMenus.removeAll();
  if (enabled) {
    browser.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Ask LLM",
      contexts: ["selection"]
    });
  }
}
async function pingTab(tabId) {
  const timeoutPromise = new Promise(
    (resolve) => setTimeout(() => {
      console.log(`Ping timeout for tab ${tabId}`);
      resolve(false);
    }, 250)
  );
  const pingPromise = (async () => {
    try {
      const response = await browser.tabs.sendMessage(tabId, { type: "PING" });
      return response?.type === "PONG";
    } catch (error) {
      console.log(`Ping failed for tab ${tabId}:`, String(error));
      return false;
    }
  })();
  return Promise.race([pingPromise, timeoutPromise]);
}
async function reinjectContentScript(tabId) {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    console.log(`Successfully reinjected content script into tab ${tabId}`);
    return await pingTab(tabId);
  } catch (error) {
    console.warn(`Failed to reinject content script into tab ${tabId}:`, error);
    return false;
  }
}
async function ensureContentScript(tabId) {
  const isAlive = await pingTab(tabId);
  if (isAlive) {
    return true;
  }
  console.log(`Content script in tab ${tabId} is not responding. Attempting to reinject.`);
  return await reinjectContentScript(tabId);
}
function showRefreshNotification(tabId) {
  browser.notifications.create(`refresh-notification-${tabId || Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Ask LLM",
    message: "The extension seems to be out of sync on this page. Please refresh the tab and try again.",
    priority: 2
  });
}
async function ensureAndSendMessage(tabId, message) {
  const isReady = await ensureContentScript(tabId);
  if (!isReady) {
    showRefreshNotification(tabId);
    return;
  }
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.warn(`sendMessage failed even after ensureContentScript for tab ${tabId}`, error);
    showRefreshNotification(tabId);
  }
}
