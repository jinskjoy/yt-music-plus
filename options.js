import { StorageManager } from '../utils/storage.js';

class OptionsPage {
  constructor() {
    this.defaultSettings = {
      showNavButton: true,
      showPlaylistButton: true,
    };
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

      let settings = await this.storageManager.get(Object.keys(this.defaultSettings));
      if (settings === null || Object.keys(settings).length === 0){
        await this.storageManager.set(this.defaultSettings);
        settings = this.defaultSettings;
      }
      const finalSettings = { ...this.defaultSettings, ...settings };

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
      const settings = {};
      // Access the elements directly from the form
      const elements = this.form.elements;

      for (let element of elements) {
        // Skip elements without a name (buttons, etc.)
        if (!element.name) continue;

        if (element.type === 'checkbox') {
          // This will now correctly catch 'false' for unchecked boxes
          settings[element.name] = element.checked;
        } else if (element.type === 'number') {
          settings[element.name] = parseInt(element.value) || 0;
        } else {
          settings[element.name] = element.value;
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
    await this.storageManager.set(this.defaultSettings);
    await this.loadSettings();
    this.showStatus('Settings reset to default.', 'success');
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
