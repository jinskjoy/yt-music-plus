import { StorageManager } from './utils/storage.js';

/**
 * BackgroundService - Manages extension background operations
 * Handles messaging between content scripts and sidebar/panel controllers
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

        case 'openSidebar':
          await this.openSidebar();
          sendResponse({ success: true });
          break;

        case 'closeSidebar':
          await this.closeSidebar();
          sendResponse({ success: true });
          break;

        case 'openSidePanel':
          await this.openSidePanel();
          sendResponse({ success: true });
          break;

        case 'closeSidePanel':
          await this.closeSidePanel();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, message: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, message: error.message });
    }
  }

  /**
   * Opens sidebar in the active tab
   * @throws {Error} If no active tab is found
   */
  async openSidebar() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) throw new Error('No active tab found');

      await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'showSidebar',
      });
    } catch (error) {
      // Silently handle error - sidebar may not be available in this context
    }
  }

  /**
   * Closes sidebar in the active tab
   * @throws {Error} If no active tab is found
   */
  async closeSidebar() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) throw new Error('No active tab found');

      await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'hideSidebar',
      });
    } catch (error) {
      // Silently handle error - sidebar may not be available in this context
    }
  }

  /**
   * Opens the side panel using chrome.sidePanel API or falls back to sidebar
   */
  async openSidePanel() {
    try {
      if (chrome.sidePanel?.setOptions) {
        await chrome.sidePanel.setOptions({ path: 'sidebar/sidebar.html' });
        if (chrome.sidePanel.open) {
          chrome.sidePanel.open();
        } else if (chrome.sidePanel.show) {
          chrome.sidePanel.show();
        }
        return;
      }

      // Fallback to injecting/showing the page sidebar
      await this.openSidebar();
    } catch (error) {
      // Silently handle side panel errors
    }
  }

  /**
   * Closes the side panel using chrome.sidePanel API or falls back to sidebar
   */
  async closeSidePanel() {
    try {
      if (chrome.sidePanel?.close || chrome.sidePanel?.hide) {
        if (chrome.sidePanel.close) chrome.sidePanel.close();
        else if (chrome.sidePanel.hide) chrome.sidePanel.hide();
        return;
      }

      // Fallback to hiding the injected sidebar
      await this.closeSidebar();
    } catch (error) {
      // Silently handle side panel errors
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

