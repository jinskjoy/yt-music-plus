/**
 * StorageManager - Handles all chrome storage operations
 */
export class StorageManager {
  /**
   * Get items from chrome storage
   * @param {string|string[]} keys - Key or array of keys to retrieve
   * @returns {Promise<Object>} Object with key-value pairs
   */
  get(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Set items in chrome storage
   * @param {Object} items - Object with key-value pairs to store
   * @returns {Promise<void>}
   */
  set(items) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Remove items from chrome storage
   * @param {string|string[]} keys - Key or array of keys to remove
   * @returns {Promise<void>}
   */
  remove(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear all items from chrome storage
   * @returns {Promise<void>}
   */
  clear() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}
