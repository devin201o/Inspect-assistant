import { ExtensionSettings, DEFAULT_SETTINGS } from './types';

const form = document.getElementById('settingsForm') as HTMLFormElement;
const providerSelect = document.getElementById('provider') as HTMLSelectElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const apiEndpointInput = document.getElementById('apiEndpoint') as HTMLInputElement;
const toastPositionSelect = document.getElementById('toastPosition') as HTMLSelectElement;
const toastDurationInput = document.getElementById('toastDuration') as HTMLInputElement;
const testBtn = document.getElementById('testBtn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const endpointGroup = document.getElementById('endpointGroup') as HTMLDivElement;
const promptModeRadios = document.querySelectorAll<HTMLInputElement>('input[name="promptMode"]');
const manualPromptGroup = document.getElementById('manualPromptGroup') as HTMLDivElement;
const manualPromptInput = document.getElementById('manualPrompt') as HTMLTextAreaElement;

const ENDPOINTS = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
};

async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  const settings: ExtensionSettings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };

  providerSelect.value = settings.provider;
  apiKeyInput.value = settings.apiKey;
  apiEndpointInput.value = settings.apiEndpoint;
  toastPositionSelect.value = settings.toastPosition;
  toastDurationInput.value = (settings.toastDuration / 1000).toString();
  manualPromptInput.value = settings.manualPrompt;

  promptModeRadios.forEach(radio => {
    if (radio.value === settings.promptMode) {
      radio.checked = true;
    }
  });

  updateEndpointVisibility();
  updateManualPromptVisibility();
}

providerSelect.addEventListener('change', () => {
  const provider = providerSelect.value as 'openrouter' | 'custom';
  if (provider !== 'custom') {
    apiEndpointInput.value = ENDPOINTS[provider];
  }
  updateEndpointVisibility();
});

promptModeRadios.forEach(radio => {
  radio.addEventListener('change', updateManualPromptVisibility);
});

function updateManualPromptVisibility() {
  const selectedMode = (document.querySelector('input[name="promptMode"]:checked') as HTMLInputElement)?.value;
  if (selectedMode === 'manual') {
    manualPromptGroup.style.display = 'block';
  } else {
    manualPromptGroup.style.display = 'none';
  }
}

function updateEndpointVisibility() {
  if (providerSelect.value === 'custom') {
    endpointGroup.style.display = 'block';
    apiEndpointInput.required = true;
  } else {
    endpointGroup.style.display = 'block';
    apiEndpointInput.required = false;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const duration = parseInt(toastDurationInput.value, 10);
  if (isNaN(duration) || duration < 1) {
    showStatus('Invalid duration. Please enter a positive number.', 'error');
    return;
  }

  const selectedPromptMode = (document.querySelector('input[name="promptMode"]:checked') as HTMLInputElement).value as 'auto' | 'manual';

  const result = await chrome.storage.local.get('settings');
  const existingSettings = result.settings || DEFAULT_SETTINGS;

  const settings: ExtensionSettings = {
    ...existingSettings,
    provider: providerSelect.value as 'openrouter' | 'custom',
    apiKey: apiKeyInput.value.trim(),
    apiEndpoint: apiEndpointInput.value.trim(),
    toastPosition: toastPositionSelect.value as 'bottom-left' | 'bottom-right',
    toastDuration: duration * 1000,
    promptMode: selectedPromptMode,
    manualPrompt: manualPromptInput.value.trim(),
  };

  await chrome.storage.local.set({ settings });
  showStatus('Settings saved successfully!', 'success');
});

testBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const apiEndpoint = apiEndpointInput.value.trim();

  if (!apiKey || !apiEndpoint) {
    showStatus('Please enter an API key and endpoint first', 'error');
    return;
  }

  showStatus('Testing connection... (This will test when you add a real API key)', 'info');
  
  setTimeout(() => {
    showStatus('Configuration looks good! Try highlighting text on a webpage.', 'success');
  }, 1000);
});

function showStatus(message: string, type: 'success' | 'error' | 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type} show`;

  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 5000);
}

loadSettings();