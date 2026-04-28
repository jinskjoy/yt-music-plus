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

  it('should handle error when sending message to background script', async () => {
    const message = { action: 'test' };
    chrome.runtime.lastError = { message: 'Failed to send' };
    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback(null));

    await expect(messageManager.sendToBackground(message)).rejects.toEqual(chrome.runtime.lastError);
  });

  it('should catch synchronous error when sending to background script', async () => {
    const message = { action: 'test' };
    chrome.runtime.sendMessage.mockImplementation(() => {
      throw new Error('Sync error');
    });

    await expect(messageManager.sendToBackground(message)).rejects.toThrow('Sync error');
  });

  it('should handle error when sending message to content script', async () => {
    const message = { action: 'test' };
    chrome.runtime.lastError = { message: 'Failed to send' };
    chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => callback(null));

    await expect(MessageManager.sendToContent(message, 123)).rejects.toEqual(chrome.runtime.lastError);
  });

  it('should reject if no active tab is found', async () => {
    const message = { action: 'test' };
    chrome.tabs.query.mockImplementation((query, callback) => callback([]));

    await expect(MessageManager.sendToContent(message)).rejects.toThrow('No active tab found');
  });

  it('should catch synchronous error when sending to content script', async () => {
    const message = { action: 'test' };
    chrome.tabs.query.mockImplementation(() => {
      throw new Error('Sync error');
    });

    await expect(MessageManager.sendToContent(message)).rejects.toThrow('Sync error');
  });

  it('should broadcast message to all tabs and handle partial failures', async () => {
    const message = { action: 'broadcast' };
    chrome.tabs.query.mockImplementation((query, callback) => callback([{ id: 1 }, { id: 2 }]));
    chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
      if (id === 1) callback({ success: true });
      else {
        chrome.runtime.lastError = { message: 'Error' };
        callback(null);
        chrome.runtime.lastError = null;
      }
    });

    const responses = await MessageManager.broadcast(message);
    expect(responses).toEqual([{ success: true }, null]);
  });

  it('should listen for messages and call the handler', async () => {
    const handler = vi.fn().mockResolvedValue({ success: true });
    const sendResponse = vi.fn();
    
    // Simulate addListener call
    chrome.runtime.onMessage.addListener.mockImplementation((callback) => {
      callback({ action: 'test' }, { id: 'sender' }, sendResponse);
    });

    messageManager.listen(handler);

    expect(handler).toHaveBeenCalledWith({ action: 'test' }, { id: 'sender' });
    // Wait for promise resolution
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('should handle handler error in listen', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
    const sendResponse = vi.fn();
    
    chrome.runtime.onMessage.addListener.mockImplementation((callback) => {
      callback({ action: 'test' }, { id: 'sender' }, sendResponse);
    });

    messageManager.listen(handler);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sendResponse).toHaveBeenCalledWith({ error: 'Handler error' });
  });
});
