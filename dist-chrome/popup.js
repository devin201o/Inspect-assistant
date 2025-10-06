import "./modulepreload-polyfill.js";
import { b as browser } from "./browser-polyfill.js";
import { D as DEFAULT_SETTINGS } from "./types.js";
const enabledToggle = document.getElementById("enabledToggle");
const openOptionsBtn = document.getElementById("openOptions");
const statusDiv = document.getElementById("status");
const promptModeRadios = document.querySelectorAll('input[name="promptMode"]');
async function loadSettings() {
  try {
    const result = await browser.storage.local.get("settings");
    const settings = { ...DEFAULT_SETTINGS, ...result.settings || {} };
    updateUI(settings);
    if (!settings.apiKey) {
      showStatus("Set your API key in Settings", "error");
    }
  } catch (error) {
    console.error("Error loading settings:", error);
    showStatus("Error loading settings", "error");
  }
}
function updateUI(settings) {
  enabledToggle.checked = settings.enabled;
  promptModeRadios.forEach((radio) => {
    if (radio.value === settings.promptMode) {
      radio.checked = true;
    }
  });
}
async function updateSetting(key, value) {
  try {
    const result = await browser.storage.local.get("settings");
    const settings = { ...DEFAULT_SETTINGS, ...result.settings || {} };
    settings[key] = value;
    await browser.storage.local.set({ settings });
    await browser.runtime.sendMessage({ type: "SETTINGS_CHANGED" });
  } catch (error) {
    console.error(`Error updating setting ${key}:`, error);
    showStatus("Error saving setting", "error");
  }
}
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type} show`;
  setTimeout(() => {
    statusDiv.classList.remove("show");
  }, 3e3);
}
enabledToggle.addEventListener("change", () => {
  updateSetting("enabled", enabledToggle.checked);
  showStatus(`Extension ${enabledToggle.checked ? "enabled" : "disabled"}`, "info");
});
promptModeRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    const selectedMode = document.querySelector('input[name="promptMode"]:checked').value;
    updateSetting("promptMode", selectedMode);
  });
});
openOptionsBtn.addEventListener("click", () => {
  browser.runtime.openOptionsPage();
});
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.settings) {
    const newSettings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
    updateUI(newSettings);
  }
});
document.addEventListener("DOMContentLoaded", loadSettings);
