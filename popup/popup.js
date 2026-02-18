import { StorageManager } from '../utils/storage.js';
import { MessageManager } from '../utils/messages.js';
import { UIHelper } from '../utils/ui-helper.js';

class PopupController {
  constructor() {
    this.storageManager = new StorageManager();
    this.messageManager = new MessageManager();
    this.uiHelper = UIHelper;
    this.initializeEventListeners();
    this.loadSettings();
  }

  initializeEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', () =>
      this.handleRefreshPlaylist()
    );
    document.getElementById('openSidebarBtn').addEventListener('click', () =>
      this.handleOpenSidebar()
    );
    document.getElementById('openSidePanelBtn').addEventListener('click', () =>
      this.handleOpenSidePanel()
    );

    document.getElementById('closeSidePanelBtn').addEventListener('click', () =>
      this.handleCloseSidePanel()
    );

    document.getElementById('testSidePanelBtn').addEventListener('click', () =>
      this.handleTestSidePanel()
    );
    document.getElementById('settingsBtn').addEventListener('click', () =>
      this.handleOpenSettings()
    );

    // Settings listeners
    document.getElementById('autoRefresh').addEventListener('change', (e) =>
      this.handleAutoRefreshToggle(e)
    );
    document.getElementById('refreshInterval').addEventListener('change', (e) =>
      this.handleIntervalChange(e)
    );
  }

  async handleRefreshPlaylist() {
    const statusEl = document.getElementById('statusMessage');
    try {
      this.uiHelper.showStatus(statusEl, 'Refreshing playlist...', 'info');
      const response = await this.messageManager.sendToBackground({
        action: 'refreshPlaylist',
      });
      
      if (response.success) {
        this.uiHelper.showStatus(statusEl, '✓ Playlist refreshed successfully!', 'success');
      } else {
        this.uiHelper.showStatus(statusEl, `Error: ${response.message}`, 'error');
      }
    } catch (error) {
      this.uiHelper.showStatus(statusEl, `Error: ${error.message}`, 'error');
    }
  }

  async handleOpenSidebar() {
    try {
      const response = await this.messageManager.sendToBackground({
        action: 'openSidebar',
      });
      if (response.success) {
        this.uiHelper.showStatus(document.getElementById('statusMessage'), 'Sidebar opened!', 'success');
      }
    } catch (error) {
      this.uiHelper.showStatus(document.getElementById('statusMessage'), 'Could not open sidebar', 'error');
    }
  }

  async handleOpenSidePanel() {
    try {
      const response = await this.messageManager.sendToBackground({ action: 'openSidePanel' });
      if (response && response.success) {
        this.uiHelper.showStatus(document.getElementById('statusMessage'), 'Side panel opened!', 'success');
      }
    } catch (error) {
      this.uiHelper.showStatus(document.getElementById('statusMessage'), `Error: ${error.message}`, 'error');
    }
  }

  async handleCloseSidePanel() {
    try {
      const response = await this.messageManager.sendToBackground({ action: 'closeSidePanel' });
      if (response && response.success) {
        this.uiHelper.showStatus(document.getElementById('statusMessage'), 'Side panel closed!', 'success');
      }
    } catch (error) {
      this.uiHelper.showStatus(document.getElementById('statusMessage'), `Error: ${error.message}`, 'error');
    }
  }

  async handleTestSidePanel() {
    const statusEl = document.getElementById('statusMessage');
    try {
      this.uiHelper.showStatus(statusEl, 'Testing side panel open/close...', 'info');
      await this.messageManager.sendToBackground({ action: 'openSidePanel' });
      setTimeout(() => {
        this.messageManager.sendToBackground({ action: 'closeSidePanel' }).catch(() => {});
      }, 2500);
    } catch (error) {
      this.uiHelper.showStatus(statusEl, `Test error: ${error.message}`, 'error');
    }
  }

  handleOpenSettings() {
    chrome.runtime.openOptionsPage();
  }

  async handleAutoRefreshToggle(event) {
    await this.storageManager.set({
      autoRefresh: event.target.checked,
    });
    await this.messageManager.sendToBackground({
      action: 'updateAutoRefresh',
      enabled: event.target.checked,
    });
  }

  async handleIntervalChange(event) {
    const interval = parseInt(event.target.value);
    await this.storageManager.set({
      refreshInterval: interval,
    });
    await this.messageManager.sendToBackground({
      action: 'updateRefreshInterval',
      interval: interval,
    });
  }

  async loadSettings() {
    const settings = await this.storageManager.get(['autoRefresh', 'refreshInterval']);
    if (settings.autoRefresh !== undefined) {
      document.getElementById('autoRefresh').checked = settings.autoRefresh;
    }
    if (settings.refreshInterval !== undefined) {
      document.getElementById('refreshInterval').value = settings.refreshInterval;
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
