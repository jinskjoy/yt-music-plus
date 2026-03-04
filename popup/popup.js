import { StorageManager } from '../utils/storage.js';
import { MessageManager } from '../utils/messages.js';
import { UIHelper } from '../utils/ui-helper.js';

/**
 * PopupController - Manages the extension's popup interface
 * Handles user actions like refreshing playlists and managing UI panels
 */
class PopupController {
  // Constants for UI behavior
  static SIDE_PANEL_TEST_DURATION = 2500;

  constructor() {
    this.storageManager = new StorageManager();
    this.messageManager = new MessageManager();
    this.uiHelper = UIHelper;
    this.statusElement = document.getElementById('statusMessage');

    this.initializeEventListeners();
    this.loadSettings();
  }

  /**
   * Initializes all button and control event listeners
   */
  initializeEventListeners() {
    // Action buttons
    this.attachListener('refreshBtn', () => this.handleRefreshPlaylist());
    this.attachListener('openSidebarBtn', () => this.handleOpenSidebar());
    this.attachListener('openSidePanelBtn', () => this.handleOpenSidePanel());
    this.attachListener('closeSidePanelBtn', () => this.handleCloseSidePanel());
    this.attachListener('testSidePanelBtn', () => this.handleTestSidePanel());
    this.attachListener('settingsBtn', () => this.handleOpenSettings());

    // Settings controls
    this.attachListener('autoRefresh', (e) => this.handleAutoRefreshToggle(e), 'change');
    this.attachListener('refreshInterval', (e) => this.handleIntervalChange(e), 'change');
  }

  /**
   * Helper to attach event listeners to elements by ID
   * @param {string} elementId - Element ID
   * @param {Function} handler - Event handler
   * @param {string} eventType - Event type (default: click)
   */
  attachListener(elementId, handler, eventType = 'click') {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(eventType, handler);
    }
  }

  /**
   * Handles playlist refresh action
   * @async
   */
  async handleRefreshPlaylist() {
    try {
      this.showStatus('Refreshing playlist...', 'info');
      const response = await this.messageManager.sendToBackground({
        action: 'refreshPlaylist',
      });

      if (response?.success) {
        this.showStatus('✓ Playlist refreshed successfully!', 'success');
      } else {
        this.showStatus(`Error: ${response?.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Handles sidebar open action
   * @async
   */
  async handleOpenSidebar() {
    try {
      const response = await this.messageManager.sendToBackground({
        action: 'openSidebar',
      });
      if (response?.success) {
        this.showStatus('Sidebar opened!', 'success');
      }
    } catch (error) {
      this.showStatus('Could not open sidebar', 'error');
    }
  }

  /**
   * Handles side panel open action
   * @async
   */
  async handleOpenSidePanel() {
    try {
      const response = await this.messageManager.sendToBackground({
        action: 'openSidePanel',
      });
      if (response?.success) {
        this.showStatus('Side panel opened!', 'success');
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Handles side panel close action
   * @async
   */
  async handleCloseSidePanel() {
    try {
      const response = await this.messageManager.sendToBackground({
        action: 'closeSidePanel',
      });
      if (response?.success) {
        this.showStatus('Side panel closed!', 'success');
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Tests side panel by opening and closing it
   * @async
   */
  async handleTestSidePanel() {
    try {
      this.showStatus('Testing side panel...', 'info');
      await this.messageManager.sendToBackground({ action: 'openSidePanel' });

      // Auto-close after test duration
      setTimeout(() => {
        this.messageManager.sendToBackground({ action: 'closeSidePanel' }).catch(() => {
          // Test close failed - this is acceptable for testing
        });
      }, PopupController.SIDE_PANEL_TEST_DURATION);
    } catch (error) {
      this.showStatus(`Test error: ${error.message}`, 'error');
    }
  }

  /**
   * Opens the extension options page
   */
  handleOpenSettings() {
    chrome.runtime.openOptionsPage();
  }

  /**
   * Handles auto-refresh toggle change
   * @async
   * @param {Event} event - Change event
   */
  async handleAutoRefreshToggle(event) {
    const enabled = event.target.checked;
    await this.storageManager.set({ autoRefresh: enabled });
    await this.messageManager.sendToBackground({
      action: 'updateAutoRefresh',
      enabled,
    });
  }

  /**
   * Handles refresh interval change
   * @async
   * @param {Event} event - Change event
   */
  async handleIntervalChange(event) {
    const interval = parseInt(event.target.value) || 0;
    await this.storageManager.set({ refreshInterval: interval });
    await this.messageManager.sendToBackground({
      action: 'updateRefreshInterval',
      interval,
    });
  }

  /**
   * Loads and applies saved settings to popup controls
   * @async
   */
  async loadSettings() {
    try {
      const settings = await this.storageManager.get([
        'autoRefresh',
        'refreshInterval'
      ]);

      if (settings.autoRefresh !== undefined) {
        document.getElementById('autoRefresh').checked = settings.autoRefresh;
      }
      if (settings.refreshInterval !== undefined) {
        document.getElementById('refreshInterval').value = settings.refreshInterval;
      }
    } catch (error) {
      // Silently fail - use default values
    }
  }

  /**
   * Shows status message with optional auto-hide
   * @param {string} message - Message text
   * @param {string} type - Message type (success, error, info)
   */
  showStatus(message, type = 'info') {
    this.uiHelper.showStatus(this.statusElement, message, type);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
