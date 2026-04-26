import { StorageManager } from './utils/storage.js';

/**
 * BackgroundService - Manages extension background operations
 * Handles messaging between content scripts and popup controllers
 */
class BackgroundService {
  constructor() {
    this.storageManager = new StorageManager();
    this.autoRefreshInterval = null;
    this.apiManager = null;
    this.pageVariables = {};
    this.initializeListeners();
  }

  /**
   * Initializes message listeners for communication from content and popup scripts
   */
  initializeListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep the message channel open
    });
  }

  /**
   * Handles incoming messages from content scripts
   * Routes messages to appropriate handler methods
   * 
   * @param {Object} message - Message object with action property
   * @param {Object} sender - Information about the message sender
   * @param {Function} sendResponse - Callback to send response
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      const { action } = message;

      switch (action) {
        case 'contentScriptLoaded':
          sendResponse({ success: true });
          break;

        case 'settingsUpdated':
          // Broadcast settings to all YouTube Music tabs
          chrome.tabs.query({ url: '*://music.youtube.com/*' }, (tabs) => {
            tabs.forEach((tab) => {
              chrome.tabs.sendMessage(tab.id, {
                action: 'settingsUpdated',
                settings: message.settings
              });
            });
          });
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, message: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, message: error.message });
    }
  }
}

// Initialize the background service
new BackgroundService();

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});
