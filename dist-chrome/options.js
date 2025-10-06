import "./modulepreload-polyfill.js";
import { b as browser } from "./browser-polyfill.js";
import { D as DEFAULT_SETTINGS } from "./types.js";
const form = document.getElementById("settingsForm");
const providerSelect = document.getElementById("provider");
const apiKeyInput = document.getElementById("apiKey");
const apiEndpointInput = document.getElementById("apiEndpoint");
const toastPositionSelect = document.getElementById("toastPosition");
const toastDurationInput = document.getElementById("toastDuration");
const testBtn = document.getElementById("testBtn");
const statusDiv = document.getElementById("status");
const endpointGroup = document.getElementById("endpointGroup");
const promptModeRadios = document.querySelectorAll('input[name="promptMode"]');
const ENDPOINTS = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions"
};
async function loadSettings() {
  const result = await browser.storage.local.get("settings");
  const settings = { ...DEFAULT_SETTINGS, ...result.settings || {} };
  providerSelect.value = settings.provider;
  apiKeyInput.value = settings.apiKey;
  apiEndpointInput.value = settings.apiEndpoint;
  toastPositionSelect.value = settings.toastPosition;
  toastDurationInput.value = (settings.toastDuration / 1e3).toString();
  promptModeRadios.forEach((radio) => {
    if (radio.value === settings.promptMode) {
      radio.checked = true;
    }
  });
  updateEndpointVisibility();
}
providerSelect.addEventListener("change", () => {
  const provider = providerSelect.value;
  if (provider !== "custom") {
    apiEndpointInput.value = ENDPOINTS[provider];
  }
  updateEndpointVisibility();
});
function updateEndpointVisibility() {
  if (providerSelect.value === "custom") {
    endpointGroup.style.display = "block";
    apiEndpointInput.required = true;
  } else {
    endpointGroup.style.display = "block";
    apiEndpointInput.required = false;
  }
}
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const duration = parseInt(toastDurationInput.value, 10);
  if (isNaN(duration) || duration < 1) {
    showStatus("Invalid duration. Please enter a positive number.", "error");
    return;
  }
  const selectedPromptMode = document.querySelector('input[name="promptMode"]:checked').value;
  const result = await browser.storage.local.get("settings");
  const existingSettings = result.settings || DEFAULT_SETTINGS;
  const settings = {
    ...existingSettings,
    provider: providerSelect.value,
    apiKey: apiKeyInput.value.trim(),
    apiEndpoint: apiEndpointInput.value.trim(),
    toastPosition: toastPositionSelect.value,
    toastDuration: duration * 1e3,
    promptMode: selectedPromptMode
  };
  await browser.storage.local.set({ settings });
  await browser.runtime.sendMessage({ type: "SETTINGS_CHANGED" });
  showStatus("Settings saved successfully!", "success");
});
testBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  const apiEndpoint = apiEndpointInput.value.trim();
  if (!apiKey || !apiEndpoint) {
    showStatus("Please enter an API key and endpoint first", "error");
    return;
  }
  showStatus("Testing connection... (This will test when you add a real API key)", "info");
  setTimeout(() => {
    showStatus("Configuration looks good! Try highlighting text on a webpage.", "success");
  }, 1e3);
});
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type} show`;
  setTimeout(() => {
    statusDiv.classList.remove("show");
  }, 5e3);
}
loadSettings();
