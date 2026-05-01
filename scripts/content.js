import { DOMModifier } from '../utils/dom-modifier.js';
import { MessageManager } from '../utils/messages.js';
import { StorageManager } from '../utils/storage.js';
import { PopupManager } from '../utils/popup-manager.js';
import { CONSTANTS } from '../utils/constants.js';
import bridgeUrl from './bridge.js?script&module';
import popupHtmlUrl from '../html/in-site-popup.html?url';
import '../styles/in-site-popup.scss';

/**
 * ContentScriptController - Manages content script operations
 * Handles page interactions, DOM injection, and popup management
 */
class ContentScriptController {
  constructor() {
    this.domModifier = DOMModifier;
    this.messageManager = new MessageManager();
    this.storageManager = new StorageManager();
    this.extSettings = { ...CONSTANTS.SETTINGS.DEFAULT };
    this.popupManager = null;

    this.setupListeners();
    this.init();
  }

  /**
   * Initializes content script by loading settings and injecting UI elements
   * @async
   */
  async init() {
    await this.loadSettings();
    
    this.popupManager = new PopupManager({
      storageManager: this.storageManager,
      popupHtmlUrl: chrome.runtime.getURL(popupHtmlUrl),
      extSettings: this.extSettings
    });

    await this.popupManager.injectPopup();
    this.injectBridgeScript();
    this.injectNavBarButton();
  }

  /**
   * Loads extension settings from storage
   * @async
   */
  async loadSettings() {
    try {
      const stored = await this.storageManager.get(Object.keys(this.extSettings));
      this.extSettings = { ...this.extSettings, ...stored };
    } catch (error) {
      // Use default settings if load fails
      this.extSettings = { ...CONSTANTS.SETTINGS.DEFAULT };
    }
  }

  /**
   * Injects navigation bar button based on extension settings
   */
  injectNavBarButton() {
    if (!this.extSettings?.showNavButton) return;

    const navBarRightSide = document.getElementById('right-content');
    if (!navBarRightSide) return;

    const button = document.createElement('div');
    button.id = 'yt-music-plus-nav-btn';
    button.className = `${CONSTANTS.UI.CLASSES.NAV_BAR_BTN || 'yt-music-plus-nav-bar-btn'} ${CONSTANTS.UI.CLASSES.HIDDEN}`;
    button.textContent = 'YouTube Music +';
    navBarRightSide.appendChild(button);
  }

  /**
   * Injects bridge script into page context for direct API access
   */
  injectBridgeScript() {
    try {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = chrome.runtime.getURL(bridgeUrl);
      (document.head || document.documentElement).appendChild(script);
    } catch (error) {
      // Script injection may fail in certain page contexts
    }
  }

  /**
   * Listens for messages from bridge script running in page context
   */
  setupListeners() {
    // Listen for page context messages
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;

      if (event.data.type === 'BRIDGE_LOADED') {
        this.notifyBackgroundOfContentScript();
        // Send current settings to bridge
        try {
          window.postMessage({ 
            type: 'EXT_SETTINGS', 
            settings: this.extSettings,
            version: chrome.runtime.getManifest().version
          }, '*');
        } catch (error) {
          // Message posting may fail in certain contexts
        }
      }
    });

    // Listen for background script messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true; // Keep the message channel open
    });
  }

  /**
   * Notifies background script that content script is ready
   * @async
   */
  async notifyBackgroundOfContentScript() {
    try {
      await this.messageManager.sendToBackground({ 
        action: 'contentScriptLoaded' 
      });
    } catch (error) {
      // Notification failed - this is acceptable
    }
  }

  /**
   * Handles incoming messages from background script
   * @async
   * @param {Object} message - Message object with action property
   * @param {Function} sendResponse - Callback to send response
   */
  async handleMessage(message, sendResponse) {
    try {
      const { action } = message;

      switch (action) {
        case 'showPopup':
          this.popupManager?.showPopup();
          sendResponse({ success: true });
          break;

        case 'hidePopup':
          this.popupManager?.hidePopup();
          sendResponse({ success: true });
          break;

        case 'settingsUpdated':
          this.extSettings = { ...this.extSettings, ...message.settings };
          if (this.popupManager) {
            this.popupManager.extSettings = this.extSettings;
          }
          // Update bridge context
          window.postMessage({ 
            type: 'EXT_SETTINGS', 
            settings: this.extSettings 
          }, '*');
          sendResponse({ success: true });
          break;

        case 'refreshAllPlaylists':
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

// Initialize content script
new ContentScriptController();
