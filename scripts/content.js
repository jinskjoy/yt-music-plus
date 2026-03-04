import { DOMModifier } from '../utils/dom-modifier.js';
import { MessageManager } from '../utils/messages.js';
import { StorageManager } from '../utils/storage.js';

/**
 * ContentScriptController - Manages content script operations
 * Handles page interactions, DOM injection, popup management, and sidebar functionality
 */
class ContentScriptController {
  // Sidebar styling constants
  static SIDEBAR_STYLES = `
    position: fixed;
    right: 0;
    top: 0;
    width: 400px;
    height: 100vh;
    border: none;
    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
    z-index: 2147483647;
    border-radius: 0;
  `;

  constructor() {
    this.domModifier = DOMModifier;
    this.messageManager = new MessageManager();
    this.storageManager = new StorageManager();
    this.extSettings = { 
      showNavButton: true, 
      showPlaylistButton: true 
    };
    this.sidebarElement = null;

    this.setupListeners();
    this.init();
  }

  /**
   * Initializes content script by loading settings and injecting UI elements
   * @async
   * @returns {Promise<void>}
   */
  async init() {
    await this.loadSettings();
    await this.injectPopup();
    this.injectBridgeScript();
    this.injectNavBarButton();
  }

  /**
   * Loads extension settings from storage
   * Falls back to default settings on error
   * @async
   * @returns {Promise<void>}
   */
  async loadSettings() {
    try {
      const stored = await this.storageManager.get(Object.keys(this.extSettings));
      this.extSettings = { ...this.extSettings, ...stored };
    } catch (error) {
      // Use default settings if load fails
      this.extSettings = { showNavButton: true, showPlaylistButton: true };
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
    button.className = 'nav-bar-btn hidden';
    button.textContent = 'YouTube Music +';
    navBarRightSide.appendChild(button);
  }

  /**
   * Injects bridge script into page context for direct API access
   * Bridge script runs in page context and can access window APIs
   */
  injectBridgeScript() {
    try {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = chrome.runtime.getURL('scripts/bridge.js');
      (document.head || document.documentElement).appendChild(script);
    } catch (error) {
      // Script injection may fail in certain page contexts
    }
  }

  /**
   * Injects popup HTML and CSS into the page
   * Sets up popup event listeners and toggle handlers
   * @async
   * @returns {Promise<void>}
   */
  async injectPopup() {
    try {
      // Inject popup styles
      const cssUrl = chrome.runtime.getURL('styles/in-site-popup.css');
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = cssUrl;
      document.head.appendChild(cssLink);

      // Fetch and inject popup HTML
      const htmlUrl = chrome.runtime.getURL('html/in-site-popup.html');
      const response = await fetch(htmlUrl);
      const htmlText = await response.text();

      const popupContainer = document.createElement('div');
      popupContainer.className = 'yt-music-extended-popup-container-holder hidden';
      popupContainer.id = 'yt-music-plus-popup';
      popupContainer.innerHTML = htmlText;
      document.body.appendChild(popupContainer);

      this.setupPopupListeners();
    } catch (error) {
      // Popup injection failed - extension will continue without in-page popup
    }
  }

  /**
   * Sets up all popup event listeners
   */
  setupPopupListeners() {
    const popupElement = this.getPopupElement();
    if (!popupElement) return;

    // Select all checkbox handler
    const selectAllCheckbox = popupElement.querySelector('#yt-music-plus-selectAllCheckbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = popupElement.querySelectorAll('.item-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
      });
    }

    // Individual checkbox change handler with delegation
    popupElement.addEventListener('change', (e) => {
      const isRelevantCheckbox = e.target.classList.contains('item-checkbox') ||
                                  e.target.classList.contains('select-all-checkbox');
      if (isRelevantCheckbox) {
        this.updateCheckAllCheckbox();
      }
    });

    // Back button handler
    const backButton = popupElement.querySelector('#backButton');
    if (backButton) {
      backButton.addEventListener('click', () => this.showPlaylistSelection());
    }
  }

  /**
   * Updates the select-all checkbox state based on individual checkbox states
   * Also enables/disables action buttons based on selection
   */
  updateCheckAllCheckbox() {
    const popupElement = this.getPopupElement();
    if (!popupElement) return;

    const selectAllCheckbox = popupElement.querySelector('#yt-music-plus-selectAllCheckbox');
    const checkboxes = popupElement.querySelectorAll('.item-checkbox');
    
    // Update select-all checkbox state
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    selectAllCheckbox.checked = allChecked;

    // Enable/disable action buttons based on selection
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
    const actionButtons = popupElement.querySelectorAll('.action-buttons-container button');
    actionButtons.forEach(btn => btn.disabled = !anyChecked);
  }

  /**
   * Shows playlist selection screen in popup
   */
  showPlaylistSelection() {
    const popupElement = this.getPopupElement();
    if (!popupElement) return;

    const selectionScreen = popupElement.querySelector('#playlistSelectionScreen');
    const detailsScreen = popupElement.querySelector('#playlistDetailsScreen');
    
    if (selectionScreen && detailsScreen) {
      selectionScreen.classList.remove('hidden');
      detailsScreen.classList.add('hidden');
    }

    const titleElement = popupElement.querySelector('#popupTitle');
    if (titleElement) {
      titleElement.textContent = '';
    }
  }

  /**
   * Shows playlist details screen in popup
   */
  showPlaylistDetails() {
    const popupElement = this.getPopupElement();
    if (!popupElement) return;

    const selectionScreen = popupElement.querySelector('#playlistSelectionScreen');
    const detailsScreen = popupElement.querySelector('#playlistDetailsScreen');
    
    if (selectionScreen && detailsScreen) {
      selectionScreen.classList.add('hidden');
      detailsScreen.classList.remove('hidden');
    }
  }

  /**
   * Gets the popup container element
   * @returns {Element|null} Popup element
   */
  getPopupElement() {
    return document.querySelector('.yt-music-extended-popup-container');
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
            settings: this.extSettings 
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
          this.showPopup();
          sendResponse({ success: true });
          break;

        case 'hidePopup':
          this.hidePopup();
          sendResponse({ success: true });
          break;

        case 'showSidebar':
          await this.showSidebar();
          sendResponse({ success: true });
          break;

        case 'hideSidebar':
          await this.hideSidebar();
          sendResponse({ success: true });
          break;

        case 'refreshAllPlaylists':
          const refreshResult = await this.refreshAllPlaylists();
          sendResponse(refreshResult);
          break;

        default:
          sendResponse({ success: false, message: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, message: error.message });
    }
  }

  /**
   * Shows the popup element on the page
   */
  showPopup() {
    const popupContainer = document.getElementById('yt-music-plus-popup');
    if (popupContainer) {
      popupContainer.classList.remove('hidden');
    }
  }

  /**
   * Hides the popup element on the page
   */
  hidePopup() {
    const popupContainer = document.getElementById('yt-music-plus-popup');
    if (popupContainer) {
      popupContainer.classList.add('hidden');
    }
  }

  /**
   * Shows sidebar by creating iframe or displaying existing one
   * @async
   */
  async showSidebar() {
    if (this.sidebarElement) {
      this.sidebarElement.style.display = 'block';
      return;
    }

    // Create sidebar iframe
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
    iframe.id = 'extension-sidebar';
    iframe.style.cssText = ContentScriptController.SIDEBAR_STYLES;

    document.body.appendChild(iframe);
    this.sidebarElement = iframe;
  }

  /**
   * Hides the sidebar iframe
   * @async
   */
  async hideSidebar() {
    if (this.sidebarElement) {
      this.sidebarElement.style.display = 'none';
    }
  }

  /**
   * Refreshes all playlists
   * @async
   * @returns {Promise<Object>} Refresh result
   */
  async refreshAllPlaylists() {
    try {
      // Implementation would go here
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

// Initialize content script
new ContentScriptController();
