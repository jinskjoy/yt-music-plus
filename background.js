import { StorageManager } from './utils/storage.js';

class BackgroundService {
  constructor() {
    this.storageManager = new StorageManager();
    this.autoRefreshInterval = null;
    this.apiManager = null; // Will be initialized after receiving ytconfig from content script
    this.pageVariables = {};
    this.initializeListeners();
  }

  async initAfterContentScriptLoad() {
    // ytconfig will be received from content script via the bridge script
    // We'll wait a bit for it or use a fallback
    
  }

  initializeListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep the message channel open
    });
  }

  async handleMessage(message, sender, sendResponse) {
    console.log('Background received message:', message);
    try {
      switch (message.action) {
        case 'contentScriptLoaded':
          console.log('Content script has loaded and is ready');
          sendResponse({ success: true });
          this.initAfterContentScriptLoad();
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


  async openSidebar() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) throw new Error('No active tab');

      await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'showSidebar',
      });
    } catch (error) {
      console.error('Error opening sidebar:', error);
      throw error;
    }
  }

  async closeSidebar() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) throw new Error('No active tab');

      await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'hideSidebar',
      });
    } catch (error) {
      console.error('Error closing sidebar:', error);
      throw error;
    }
  }

  async openSidePanel() {
    // Try to use the chrome.sidePanel API when available
    try {
      if (chrome.sidePanel && chrome.sidePanel.setOptions) {
        await chrome.sidePanel.setOptions({ path: 'sidebar/sidebar.html' });
        if (chrome.sidePanel.open) {
          chrome.sidePanel.open();
        } else if (chrome.sidePanel.show) {
          chrome.sidePanel.show();
        }
        return;
      }

      // Fallback to injecting/showing the page sidebar if sidePanel API isn't available
      await this.openSidebar();
    } catch (error) {
      console.error('Error opening side panel:', error);
      throw error;
    }
  }

  async closeSidePanel() {
    try {
      if (chrome.sidePanel && (chrome.sidePanel.close || chrome.sidePanel.hide)) {
        if (chrome.sidePanel.close) chrome.sidePanel.close();
        else if (chrome.sidePanel.hide) chrome.sidePanel.hide();
        return;
      }

      // Fallback to hiding the injected sidebar
      await this.closeSidebar();
    } catch (error) {
      console.error('Error closing side panel:', error);
      throw error;
    }
  }
}

// Initialize the background service
new BackgroundService();

// Optional: Listen for chrome extension events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

