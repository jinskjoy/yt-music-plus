import { StorageManager } from '../utils/storage.js';

class OptionsPage {
  constructor() {
    this.storageManager = new StorageManager();
    this.form = document.getElementById('settingsForm');
    this.statusMessage = document.getElementById('statusMessage');
    this.initializeEventListeners();
    this.loadSettings();
  }

  initializeEventListeners() {
    this.form.addEventListener('submit', (e) => this.handleSave(e));
    this.form.addEventListener('reset', (e) => this.handleReset(e));
  }

  async loadSettings() {
    try {
      const defaultSettings = {
        autoRefresh: true,
        refreshInterval: 30,
        enableNotifications: true,
        notificationDuration: 3,
        apiTimeout: 10000,
        logAPIRequests: false,
        theme: 'auto',
        compactView: false,
      };

      const settings = await this.storageManager.get(Object.keys(defaultSettings));
      const finalSettings = { ...defaultSettings, ...settings };

      // Load settings into form
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
      console.error('Error loading settings:', error);
    }
  }

  async handleSave(e) {
    e.preventDefault();

    try {
      const formData = new FormData(this.form);
      const settings = {};

      // Convert form data to settings object
      for (let [key, value] of formData.entries()) {
        const element = document.getElementById(key);
        if (element.type === 'checkbox') {
          settings[key] = element.checked;
        } else if (element.type === 'number') {
          settings[key] = parseInt(value);
        } else {
          settings[key] = value;
        }
      }

      // Save to storage
      await this.storageManager.set(settings);

      // Notify background script of changes
      chrome.runtime.sendMessage({
        action: 'settingsUpdated',
        settings,
      });

      this.showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      this.showStatus('Failed to save settings', 'error');
      console.error('Error saving settings:', error);
    }
  }

  async handleReset(e) {
    if (!confirm('Are you sure you want to reset to default settings?')) {
      e.preventDefault();
      return;
    }
    this.showStatus('Settings reset to default. Please save to apply changes.', 'info');
  }

  showStatus(message, type = 'success') {
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status-message show ${type}`;

    setTimeout(() => {
      this.statusMessage.classList.remove('show');
    }, 3000);
  }
}

// Initialize options page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsPage();
});
