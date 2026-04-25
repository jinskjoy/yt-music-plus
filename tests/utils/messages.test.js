import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageManager } from '../../utils/messages.js';

describe('MessageManager', () => {
  let messageManager;

  beforeEach(() => {
    messageManager = new MessageManager();
    vi.clearAllMocks();
    chrome.runtime.lastError = null;
  });

  it('should send message to background script', async () => {
    const message = { action: 'test' };
    const mockResponse = { success: true };
    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback(mockResponse));

    const response = await messageManager.sendToBackground(message);
    expect(response).toEqual(mockResponse);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(message, expect.any(Function));
  });

  it('should send message to content script', async () => {
    const message = { action: 'test' };
    const mockResponse = { success: true };
    chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => callback(mockResponse));

    const response = await MessageManager.sendToContent(message, 123);
    expect(response).toEqual(mockResponse);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, message, expect.any(Function));
  });

  it('should get active tab if tabId is not provided', async () => {
    const message = { action: 'test' };
    chrome.tabs.query.mockImplementation((query, callback) => callback([{ id: 456 }]));
    chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => callback({ success: true }));

    await MessageManager.sendToContent(message);
    expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true }, expect.any(Function));
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(456, message, expect.any(Function));
  });

  it('should broadcast message to all tabs', async () => {
    const message = { action: 'broadcast' };
    chrome.tabs.query.mockImplementation((query, callback) => callback([{ id: 1 }, { id: 2 }]));
    chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => callback({ id }));

    const responses = await MessageManager.broadcast(message);
    expect(responses).toEqual([{ id: 1 }, { id: 2 }]);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });
});
