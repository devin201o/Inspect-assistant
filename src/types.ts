export interface ExtensionSettings {
  enabled: boolean;
  apiKey: string;
  apiEndpoint: string;
  model: string;
  toastDuration: number;
  toastPosition: 'bottom-left' | 'bottom-right';
  provider: 'openrouter' | 'custom';
  promptMode: 'auto' | 'manual';
  discreteMode: boolean;
  discreteModeOpacity: number;
}

export interface LLMResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export interface ToastOptions {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
  position?: 'bottom-left' | 'bottom-right';
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  apiKey: '',
  apiEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'google/gemini-2.5-flash',
  toastDuration: 20000,
  toastPosition: 'bottom-right',
  provider: 'openrouter',
  promptMode: 'auto',
  discreteMode: false,
  discreteModeOpacity: 0.85,
};