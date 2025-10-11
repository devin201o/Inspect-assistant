export interface ExtensionSettings {
  enabled: boolean;
  apiKey: string;
  apiEndpoint: string;
  model: string;
  toastDuration: number;
  toastPosition: 'bottom-left' | 'bottom-right';
  provider: 'openrouter' | 'custom';
  // To add a new prompt mode:
  // 1. Add the new mode name to this union type (e.g., 'auto' | 'manual' | 'concise' | 'your-new-mode').
  // 2. Add a corresponding <option> in `popup.html`.
  // 3. Update the type assertion in `popup.ts` to include the new mode.
  // 4. If the mode uses a default prompt, add a corresponding key-value pair in `src/prompts.ts`.
  // 5. Update the logic in `background.ts` (`callLLM` function) to handle the new mode if it's not a simple prompt selection.
  promptMode: 'auto' | 'manual' | 'concise';
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
};