import { StorageManager } from './utils/storage.js';

/**
 * OptionsPage - Manages the extension's options/settings page
 * Handles loading, saving, and resetting user preferences
 */
class OptionsPage {
  // Constants for UI behavior
  static STATUS_MESSAGE_DURATION = 3000;

  constructor() {
    this.defaultSettings = {
      showNavButton: true,
      showPlaylistButton: true,
      loadAllPlaylists: false,
    };
    this.storageManager = new StorageManager();
    this.form = document.getElementById('settingsForm');
    this.statusMessage = document.getElementById('statusMessage');
    
    this.initializeEventListeners();
    this.loadSettings();
  }

  /**
   * Initializes form event listeners
   */
  initializeEventListeners() {
    this.form.addEventListener('submit', (e) => this.handleSave(e));
    this.form.addEventListener('reset', (e) => this.handleReset(e));
  }

  /**
   * Loads settings from storage and populates form fields
   * Uses default settings as fallback if no stored settings exist
   * @async
   * @returns {Promise<void>}
   */
  async loadSettings() {
    try {
      const storedSettings = await this.storageManager.get(Object.keys(this.defaultSettings));
      const finalSettings = { ...this.defaultSettings, ...storedSettings };

      // Initialize storage with defaults if empty
      if (Object.keys(storedSettings).length === 0) {
        await this.storageManager.set(this.defaultSettings);
      }

      // Populate form fields from settings
      Object.entries(finalSettings).forEach(([key, value]) => {
        const element = document.getElementById(key);
        if (element) {
          if (element.type === 'checkbox') {
            element.checked = value;
          } else {
            element.value = value;
          }
        }
      });
    } catch (error) {
      this.showStatus('Failed to load settings', 'error');
    }
  }

  /**
   * Saves form settings to storage and notifies background script
   * @async
   * @param {Event} e - Form submit event
   * @returns {Promise<void>}
   */
  async handleSave(e) {
    e.preventDefault();

    try {
      const settings = this.extractFormSettings();

      // Save to extension storage
      await this.storageManager.set(settings);

      // Notify background script of setting changes
      chrome.runtime.sendMessage({
        action: 'settingsUpdated',
        settings,
      });

      this.showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      this.showStatus('Failed to save settings', 'error');
    }
  }

  /**
   * Extracts form field values into a settings object
   * Handles different input types (checkbox, number, text)
   * @returns {Object} Settings object with form values
   */
  extractFormSettings() {
    const settings = {};

    for (const element of this.form.elements) {
      // Skip elements without a name attribute
      if (!element.name) continue;

      if (element.type === 'checkbox') {
        settings[element.name] = element.checked;
      } else if (element.type === 'number') {
        settings[element.name] = parseInt(element.value) || 0;
      } else {
        settings[element.name] = element.value;
      }
    }

    return settings;
  }

  /**
   * Resets settings to defaults with user confirmation
   * @async
   * @param {Event} e - Form reset event
   * @returns {Promise<void>}
   */
  async handleReset(e) {
    if (!confirm('Are you sure you want to reset to default settings?')) {
      e.preventDefault();
      return;
    }

    try {
      await this.storageManager.set(this.defaultSettings);
      await this.loadSettings();
      this.showStatus('Settings reset to default.', 'success');
    } catch (error) {
      this.showStatus('Failed to reset settings', 'error');
    }
  }

  /**
   * Displays status message with auto-hide on timeout
   * @param {string} message - Message to display
   * @param {string} type - Message type (success, error, info)
   */
  showStatus(message, type = 'success') {
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status-message show ${type}`;

    setTimeout(() => {
      this.statusMessage.classList.remove('show');
    }, OptionsPage.STATUS_MESSAGE_DURATION);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsPage();
});
