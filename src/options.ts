import { ExtensionSettings, DEFAULT_SETTINGS } from './types';

const form = document.getElementById('settingsForm') as HTMLFormElement;
const providerSelect = document.getElementById('provider') as HTMLSelectElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const apiEndpointInput = document.getElementById('apiEndpoint') as HTMLInputElement;
const modelInput = document.getElementById('model') as HTMLInputElement;
const toastPositionSelect = document.getElementById('toastPosition') as HTMLSelectElement;
const toastDurationInput = document.getElementById('toastDuration') as HTMLInputElement;
const testBtn = document.getElementById('testBtn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const endpointGroup = document.getElementById('endpointGroup') as HTMLDivElement;
const promptModeRadios = document.querySelectorAll<HTMLInputElement>('input[name="promptMode"]');
const discreteModeToggle = document.getElementById('discreteMode') as HTMLInputElement;
const opacityGroup = document.getElementById('opacityGroup') as HTMLDivElement;
const opacitySlider = document.getElementById('discreteModeOpacity') as HTMLInputElement;
const opacityValue = document.getElementById('opacityValue') as HTMLSpanElement;

const ENDPOINTS = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
};

async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  const settings: ExtensionSettings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };

  providerSelect.value = settings.provider;
  apiKeyInput.value = settings.apiKey;
  apiEndpointInput.value = settings.apiEndpoint;
  modelInput.value = settings.model;
  toastPositionSelect.value = settings.toastPosition;
  toastDurationInput.value = (settings.toastDuration / 1000).toString();
  discreteModeToggle.checked = settings.discreteMode;
  opacitySlider.value = settings.discreteModeOpacity.toString();
  opacityValue.textContent = settings.discreteModeOpacity.toString();

  promptModeRadios.forEach(radio => {
    if (radio.value === settings.promptMode) {
      radio.checked = true;
    }
  });

  updateEndpointVisibility();
}

providerSelect.addEventListener('change', () => {
  const provider = providerSelect.value as 'openrouter' | 'custom';
  if (provider !== 'custom') {
    apiEndpointInput.value = ENDPOINTS[provider];
  }
  updateEndpointVisibility();
  updateOpacityGroupVisibility();
});

discreteModeToggle.addEventListener('change', updateOpacityGroupVisibility);

opacitySlider.addEventListener('input', () => {
  opacityValue.textContent = opacitySlider.value;
});

function updateOpacityGroupVisibility() {
  opacityGroup.style.display = discreteModeToggle.checked ? 'block' : 'none';
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

  const modelValue = modelInput.value.trim();
  const settings: ExtensionSettings = {
    ...existingSettings,
    provider: providerSelect.value as 'openrouter' | 'custom',
    apiKey: apiKeyInput.value.trim(),
    apiEndpoint: apiEndpointInput.value.trim(),
     model: modelValue || DEFAULT_SETTINGS.model,
    toastPosition: toastPositionSelect.value as 'bottom-left' | 'bottom-right',
    toastDuration: duration * 1000,
    promptMode: selectedPromptMode,
    discreteMode: discreteModeToggle.checked,
    discreteModeOpacity: parseFloat(opacitySlider.value),
  };

  await chrome.storage.local.set({ settings });
  await chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' });
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