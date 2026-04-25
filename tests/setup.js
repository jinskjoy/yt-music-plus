import { vi } from 'vitest';

// Mock chrome API
global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys, callback) => callback({})),
      set: vi.fn((items, callback) => callback?.()),
      remove: vi.fn((keys, callback) => callback?.()),
      clear: vi.fn((callback) => callback?.()),
    },
  },
  runtime: {
    lastError: null,
    sendMessage: vi.fn((message, callback) => callback?.({ success: true })),
    onMessage: {
      addListener: vi.fn(),
    },
    getURL: vi.fn((path) => `chrome-extension://id/${path}`),
  },
  tabs: {
    query: vi.fn((queryInfo, callback) => callback([{ id: 1 }])),
    sendMessage: vi.fn((tabId, message, callback) => callback?.({ success: true })),
  },
};

// Mock fetch
global.fetch = vi.fn();

// Mock window.ytcfg
global.window.ytcfg = {
  data_: {
    INNERTUBE_CONTEXT: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20240101.01.00' } }
  }
};

// Mock window.location
delete global.window.location;
global.window.location = new URL('https://music.youtube.com/playlist?list=PLxyz');
