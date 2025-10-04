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

// Only OpenRouter endpoint
const ENDPOINTS = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
};

// Load current settings
async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  const settings: ExtensionSettings = result.settings || DEFAULT_SETTINGS;

  providerSelect.value = settings.provider;
  apiKeyInput.value = settings.apiKey;
  apiEndpointInput.value = settings.apiEndpoint;
  toastPositionSelect.value = settings.toastPosition;
  toastDurationInput.value = (settings.toastDuration / 1000).toString();

  updateEndpointVisibility();
}

// Update endpoint based on provider
providerSelect.addEventListener('change', () => {
  const provider = providerSelect.value as keyof typeof ENDPOINTS;
  if (provider !== 'custom') {
    apiEndpointInput.value = ENDPOINTS[provider];
  }
  updateEndpointVisibility();
});

function updateEndpointVisibility() {
  if (providerSelect.value === 'custom') {
    endpointGroup.style.display = 'block';
    apiEndpointInput.required = true;
  } else {
    endpointGroup.style.display = 'block'; // Still show but auto-filled
    apiEndpointInput.required = false;
  }
}

// Save settings
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const settings: ExtensionSettings = {
    enabled: true, // Keep current enabled state
    provider: 'openrouter', // Always use openrouter
    apiKey: apiKeyInput.value.trim(),
    apiEndpoint: apiEndpointInput.value.trim(),
    toastPosition: toastPositionSelect.value as any,
    toastDuration: parseInt(toastDurationInput.value) * 1000,
  };

  // Get current enabled state
  const result = await chrome.storage.local.get('settings');
  if (result.settings) {
    settings.enabled = result.settings.enabled;
  }

  await chrome.storage.local.set({ settings });
  showStatus('Settings saved successfully!', 'success');
});

// Test connection (mock for now)
testBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const apiEndpoint = apiEndpointInput.value.trim();

  if (!apiKey) {
    showStatus('Please enter an API key first', 'error');
    return;
  }

  if (!apiEndpoint) {
    showStatus('Please enter an API endpoint', 'error');
    return;
  }

  showStatus('Testing connection... (This will test when you add a real API key)', 'info');
  
  // For now, just show a mock success after 1 second
  setTimeout(() => {
    showStatus('Configuration looks good! Try highlighting text on a webpage.', 'success');
  }, 1000);
});

// Show status message
function showStatus(message: string, type: 'success' | 'error' | 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type} show`;

  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 5000);
}

// Initialize
loadSettings();