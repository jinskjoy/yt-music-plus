/**
 * MessageManager - Handles message passing between extension components
 */
export class MessageManager {
  /**
   * Send message to background script
   * @param {Object} message - Message object
   * @returns {Promise<Object>} Response from background script
   */
  sendToBackground(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send message to content script
   * @param {number} tabId - Tab ID (optional, uses active tab if not provided)
   * @param {Object} message - Message object
   * @returns {Promise<Object>} Response from content script
   */
  static async sendToContent(message, tabId = null) {
    return new Promise((resolve, reject) => {
      try {
        const sendMsg = (id) => {
          chrome.tabs.sendMessage(id, message, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        };

        if (tabId) {
          sendMsg(tabId);
        } else {
          // Get active tab if tabId not provided
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              sendMsg(tabs[0].id);
            } else {
              reject(new Error('No active tab found'));
            }
          });
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Broadcast message to all content scripts
   * @param {Object} message - Message object
   * @returns {Promise<Object[]>} Array of responses
   */
  static async broadcast(message) {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        const promises = tabs.map((tab) =>
          this.sendToContent(message, tab.id).catch(() => null)
        );
        Promise.all(promises).then(resolve);
      });
    });
  }

  /**
   * Listen for messages (use in background/content scripts)
   * @param {Function} handler - Message handler function
   */
  listen(handler) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      Promise.resolve(handler(message, sender))
        .then((response) => sendResponse(response))
        .catch((error) => sendResponse({ error: error.message }));
      return true; // Keep channel open
    });
  }
}
