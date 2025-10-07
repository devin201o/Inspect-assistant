import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import browser from 'webextension-polyfill';

// Mock the entire webextension-polyfill module
vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      onMessage: {
        addListener: vi.fn(),
      },
      sendMessage: vi.fn(),
      getURL: (path: string) => `mock-extension-url/${path}`,
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ settings: {} }),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
  },
}));

vi.stubGlobal('navigator', {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('Content Script Toasts', () => {
  let messageListener: (message: any, sender: any, sendResponse: any) => Promise<void> | void;

  beforeEach(async () => {
    // Use fake timers to control setTimeout and clearTimeout
    vi.useFakeTimers();

    // Set up a fresh DOM for each test
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('HTMLDivElement', dom.window.HTMLDivElement);

    // Reset mocks
    vi.mocked(browser.runtime.onMessage.addListener).mockClear();
    vi.mocked(browser.storage.local.get).mockResolvedValue({ settings: {} });

    // Dynamically import the content script to re-run its setup logic for each test.
    // The cache-busting query `?v=` ensures the module is re-evaluated.
    await import('./content.ts?v=' + Date.now());

    // The script adds a listener, so we grab it from our mock.
    if (vi.mocked(browser.runtime.onMessage.addListener).mock.calls.length > 0) {
      messageListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0];
    }
  });

  afterEach(() => {
    // Restore real timers and clean up globals
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should clear both toast and copy timeouts when dismissed', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    // 1. Show a success toast
    await messageListener(
      { type: 'SHOW_TOAST', payload: { message: 'Success!', type: 'success', duration: 5000 } },
      {},
      () => {}
    );

    // 2. Click the "Copy" button, which is inside the Shadow DOM
    const container = document.getElementById('ask-llm-toast-container');
    const shadowRoot = container.shadowRoot;
    const copyBtn = shadowRoot.querySelector('.copy-btn');
    expect(copyBtn).not.toBeNull();
    copyBtn.dispatchEvent(new window.Event('click'));

    // 3. Dismiss the toast immediately
    const closeBtn = shadowRoot.querySelector('.close-btn');
    expect(closeBtn).not.toBeNull();
    closeBtn.dispatchEvent(new window.Event('click'));

    // 4. Assert that clearTimeout was called twice: once for the main toast
    // and once for the copy button's text-revert timeout.
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);

    clearTimeoutSpy.mockRestore();
  });
});