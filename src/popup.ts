import { ExtensionSettings, DEFAULT_SETTINGS } from './types';

const enabledToggle = document.getElementById('enabledToggle') as HTMLInputElement;
const openOptionsBtn = document.getElementById('openOptions') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

// Load current settings
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings: ExtensionSettings = result.settings || DEFAULT_SETTINGS;
    
    console.log('Loaded settings:', settings); // Debug log
    enabledToggle.checked = settings.enabled;
    
    // Show warning if no API key
    if (!settings.apiKey) {
      showStatus('Please set your API key in Settings', 'error');
    } else {
      showStatus(`Extension ${settings.enabled ? 'enabled' : 'disabled'}`, 'info');
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

// Toggle enabled state
enabledToggle.addEventListener('change', async () => {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings: ExtensionSettings = result.settings || DEFAULT_SETTINGS;
    
    settings.enabled = enabledToggle.checked;
    await chrome.storage.local.set({ settings });
    
    console.log('Settings saved:', settings); // Debug log
    
    showStatus(
      `Extension ${settings.enabled ? 'enabled' : 'disabled'}`,
      'success'
    );
    
    // Notify background script to update context menu
    chrome.runtime.sendMessage({
      type: 'SETTINGS_CHANGED',
      settings: settings
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings', 'error');
  }
});

// Open options page
openOptionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Show status message
function showStatus(message: string, type: 'success' | 'error' | 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type} show`;
  
  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 3000);
}

// Initialize
document.addEventListener('DOMContentLoaded', loadSettings);
// Also call immediately in case DOMContentLoaded already fired
loadSettings();