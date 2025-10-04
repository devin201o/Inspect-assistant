export interface ExtensionSettings {
  enabled: boolean;
  apiKey: string;
  apiEndpoint: string;
  toastDuration: number;
  toastPosition: 'bottom-left' | 'bottom-right';
  provider: 'openrouter';
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
  toastDuration: 20000,
  toastPosition: 'bottom-right',
  provider: 'openrouter',
};