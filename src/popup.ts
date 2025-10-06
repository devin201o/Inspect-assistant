import browser from 'webextension-polyfill';
import { ExtensionSettings, DEFAULT_SETTINGS } from './types';

const enabledToggle = document.getElementById('enabledToggle') as HTMLInputElement;
const openOptionsBtn = document.getElementById('openOptions') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const promptModeRadios = document.querySelectorAll<HTMLInputElement>('input[name="promptMode"]');

// --- Functions ---

async function loadSettings() {
  try {
    const result = await browser.storage.local.get('settings');
    const settings: ExtensionSettings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
    
    updateUI(settings);

    if (!settings.apiKey) {
      showStatus('Set your API key in Settings', 'error');
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

function updateUI(settings: ExtensionSettings) {
  enabledToggle.checked = settings.enabled;

  promptModeRadios.forEach(radio => {
    if (radio.value === settings.promptMode) {
      radio.checked = true;
    }
  });
}

async function updateSetting(key: keyof ExtensionSettings, value: any) {
  try {
    const result = await browser.storage.local.get('settings');
    const settings: ExtensionSettings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };

    (settings[key] as any) = value;

    await browser.storage.local.set({ settings });
    await browser.runtime.sendMessage({ type: 'SETTINGS_CHANGED' });
  } catch (error) {
    console.error(`Error updating setting ${key}:`, error);
    showStatus('Error saving setting', 'error');
  }
}

function showStatus(message: string, type: 'success' | 'error' | 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type} show`;
  
  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 3000);
}

// --- Event Listeners ---

enabledToggle.addEventListener('change', () => {
  updateSetting('enabled', enabledToggle.checked);
  showStatus(`Extension ${enabledToggle.checked ? 'enabled' : 'disabled'}`, 'info');
});

promptModeRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    const selectedMode = (document.querySelector('input[name="promptMode"]:checked') as HTMLInputElement).value as 'auto' | 'manual';
    updateSetting('promptMode', selectedMode);
  });
});

openOptionsBtn.addEventListener('click', () => {
  browser.runtime.openOptionsPage();
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    const newSettings: ExtensionSettings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
    updateUI(newSettings);
  }
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', loadSettings);