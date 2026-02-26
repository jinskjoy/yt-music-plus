import { StorageManager } from './utils/storage.js';

class BackgroundService {
  constructor() {
    this.storageManager = new StorageManager();
    this.autoRefreshInterval = null;
    this.apiManager = null; // Will be initialized after receiving ytconfig from content script
    this.pageVariables = {};
    this.initializeListeners();
    this.setupAutoRefresh();
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

        case 'refreshPlaylist':
          const refreshResult = await this.refreshPlaylist();
          sendResponse(refreshResult);
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

        case 'getPlaylistData':
          const playlistData = await this.getPlaylistData();
          sendResponse(playlistData);
          break;

        case 'refreshAllPlaylists':
          const allRefresh = await this.refreshAllPlaylists();
          sendResponse(allRefresh);
          break;

        case 'updateAutoRefresh':
          await this.updateAutoRefresh(message.enabled);
          sendResponse({ success: true });
          break;

        case 'updateRefreshInterval':
          await this.updateRefreshInterval(message.interval);
          sendResponse({ success: true });
          break;

        case 'makeAPIRequest':
          const apiResult = await this.makeAPIRequest(message.request);
          sendResponse(apiResult);
          break;

        case 'variableResponse':

          // This is the response from content script with the variable value
          if (message.variableName && message.success) {
            this.processReceivedVariable(message.variableName, message.value, message.requestedBy);
            console.log('Stored page variable received from content script:', message.variableName, message.value);
          }
          if (message.variableName && !message.success) {
            console.warn('Failed to receive page variable:', message.variableName, message.error);
          }
          sendResponse({ success: true });
          break;
        case 'authTokenFound':
          console.log('Received auth token from content script:', message.token);
          this.storeAuthToken(message.token);
          // You can store this token or use it for API requests as needed
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, message: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, message: error.message });
    }
  }
  storeAuthToken(token) {
    // For demonstration, we're just logging it. In a real implementation, you might want to store it securely.
    console.log('Storing auth token:', token);
    this.authToken = token; // Store in memory for now
    if (this.apiManager) {
      this.apiManager.setAuthToken(token); // If your API manager supports setting an auth token, do it here
    }
  }

  processReceivedVariable(variableName, value, requestedBy) {
    console.log('Processing received variable:', variableName, 'requested by:', requestedBy);
    switch (requestedBy) {
      case 'ytCfgLoader':
        this.ytCfgLoadProcessor(variableName, value);
        break;
    }

  }
  ytCfgLoadProcessor(variableName, value) {
    if (variableName === 'ytcfg') {
      try {
        this.pageVariables[variableName] = value; // Store the raw JSON string for potential future use
        this.apiManager = new APIManager(value);
        if (this.authToken) {
          this.apiManager.setAuthToken(this.authToken); // Set the auth token if it was already captured
        }
        console.log('Parsed and stored ytcfg from content script');
      } catch (error) {
        console.error('Error parsing ytcfg value:', error);
      }
    }
  }

  async refreshPlaylist() {
    try {
      // Get the active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        throw new Error('No active tab');
      }

      if (!this.apiManager) {
        throw new Error('API Manager not initialized. ytconfig is required to make API requests.');
      }
      var playlists = this.apiManager.getPlaylists();
      if (!playlists || playlists.length === 0) {
        throw new Error('No playlists found to refresh');
      }

      const data = {
        playlists: playlists,
        timestamp: new Date().getTime()
      };

      // Store the result
      await this.storageManager.set({
        lastRefreshTime: new Date().getTime(),
        lastRefreshStatus: 'success',
      });

      return { success: true, message: 'Playlist refreshed', data: result };
    } catch (error) {
      return { success: false, message: error.message };
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

  async getPlaylistData() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) throw new Error('No active tab');

      const data = await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'gatherPlaylistData',
      });

      return { success: true, playlists: data.playlists || [] };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async refreshAllPlaylists() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) throw new Error('No active tab');

      const result = await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'refreshAllPlaylists',
      });

      await this.storageManager.set({
        lastRefreshTime: new Date().getTime(),
        lastRefreshStatus: 'success',
      });

      return { success: true, ...result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateAutoRefresh(enabled) {
    await this.storageManager.set({ autoRefresh: enabled });
    if (enabled) {
      this.setupAutoRefresh();
    } else {
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
      }
    }
  }

  async updateRefreshInterval(interval) {
    await this.storageManager.set({ refreshInterval: interval });
    this.setupAutoRefresh();
  }

  async setupAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    const settings = await this.storageManager.get(['autoRefresh', 'refreshInterval']);
    if (settings.autoRefresh) {
      const interval = (settings.refreshInterval || 30) * 60 * 1000; // Convert minutes to ms
      this.autoRefreshInterval = setInterval(() => {
        this.refreshPlaylist();
      }, interval);
    }
  }

  async makeAPIRequest(requestConfig) {
    try {
      const result = await this.apiManager.makeRequest(requestConfig);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, message: error.message };
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

