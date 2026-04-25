import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageManager } from '../../utils/storage.js';

describe('StorageManager', () => {
  let storageManager;

  beforeEach(() => {
    storageManager = new StorageManager();
    vi.clearAllMocks();
  });

  it('should get items from chrome storage', async () => {
    const mockData = { key1: 'value1' };
    chrome.storage.local.get.mockImplementation((keys, callback) => callback(mockData));

    const result = await storageManager.get('key1');
    expect(result).toEqual(mockData);
    expect(chrome.storage.local.get).toHaveBeenCalledWith('key1', expect.any(Function));
  });

  it('should set items in chrome storage', async () => {
    const mockData = { key1: 'value1' };
    chrome.storage.local.set.mockImplementation((items, callback) => callback());

    await storageManager.set(mockData);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(mockData, expect.any(Function));
  });

  it('should remove items from chrome storage', async () => {
    const keys = ['key1'];
    chrome.storage.local.remove.mockImplementation((k, callback) => callback());

    await storageManager.remove(keys);
    expect(chrome.storage.local.remove).toHaveBeenCalledWith(keys, expect.any(Function));
  });

  it('should clear chrome storage', async () => {
    chrome.storage.local.clear.mockImplementation((callback) => callback());

    await storageManager.clear();
    expect(chrome.storage.local.clear).toHaveBeenCalled();
  });

  it('should reject on chrome.runtime.lastError', async () => {
    const error = { message: 'Storage error' };
    chrome.runtime.lastError = error;
    chrome.storage.local.get.mockImplementation((keys, callback) => callback({}));

    await expect(storageManager.get('key1')).rejects.toEqual(error);
    chrome.runtime.lastError = null;
  });
});
