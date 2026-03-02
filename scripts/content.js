import { DOMModifier } from '../utils/dom-modifier.js';
import { MessageManager } from '../utils/messages.js';

class ContentScriptController {
  constructor() {
    this.domModifier = DOMModifier;
    this.messageManager = new MessageManager();
    this.sidebarElement = null;
    this.listenForPageMessages();
    this.initializeListeners();
    this.init();
  }

  async init() {  
    await this.injectPopup();
    this.injectBridgeScript();
    this.injectNavBarButton();
  }

  injectNavBarButton() {
    const navBarRightSide = document.getElementById('right-content');
    if (navBarRightSide) {
      const button = document.createElement('div');
      button.id = 'yt-music-plus-nav-btn';
      button.className = 'nav-bar-btn hidden';
      button.textContent = 'YouTube Music +';
      navBarRightSide.appendChild(button);
    } else {
      console.warn('Could not find the right side of the navigation bar to inject the button.');
    }
  }

  injectBridgeScript() {
    // Inject the bridge script into the page context
    try {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = chrome.runtime.getURL('scripts/bridge.js');
      (document.head || document.documentElement).appendChild(script);
      console.log('Bridge script injected successfully');
    } catch (error) {
      console.error('Failed to inject bridge script:', error);
    }
  }

  async injectPopup() {
    // Inject the popup HTML and CSS
    try {
      // Inject CSS
      const cssUrl = chrome.runtime.getURL('styles/in-site-popup.css');
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = cssUrl;
      document.head.appendChild(cssLink);

      // Fetch and inject HTML
      const htmlUrl = chrome.runtime.getURL('html/in-site-popup.html');
      const response = await fetch(htmlUrl);
      const htmlText = await response.text();

      const popupContainer = document.createElement('div');
      popupContainer.className = 'yt-music-extended-popup-container-holder hidden';
      popupContainer.id = 'yt-music-plus-popup';
      popupContainer.innerHTML = htmlText;
      document.body.appendChild(popupContainer);
      const popupElement = this.getPopupElement();



      const selectAllCheckbox = popupElement.querySelector('#yt-music-plus-selectAllCheckbox');
      if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
          const checkboxes = popupElement.querySelectorAll('.item-checkbox');
          checkboxes.forEach(cb => cb.checked = e.target.checked);
        });
      }

      //Detect if any checkbox is unchecked, if so uncheck the selectAllCheckbox
      // Grid container will be dynamically generated, so we need to use event delegation
      popupElement.addEventListener('change', (e) => {
        // If the changed element is not a checkbox, ignore
        if (!e.target.classList.contains('item-checkbox') && !e.target.classList.contains('select-all-checkbox')) return;
        // If all checkboxes are checked, check the selectAllCheckbox        

        this.setCheckAllCheckBox();
      });

      // Add back button listener for returning to playlist selection
      const backButton = popupElement.querySelector('#backButton');
      if (backButton) {
        backButton.addEventListener('click', () => this.showPlaylistSelection());
      }

      console.log('Popup injected successfully');
    } catch (error) {
      console.error('Error injecting popup:', error);
    }
  }

  setCheckAllCheckBox() {
    const popupElement = this.getPopupElement();
    const selectAllCheckbox = popupElement.querySelector('#yt-music-plus-selectAllCheckbox');
    const checkboxes = popupElement.querySelectorAll('.item-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    selectAllCheckbox.checked = allChecked;

    //If none of the checkboxes are checked, disable the action buttons, else enable them
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
    const actionButtons = popupElement.querySelectorAll('.action-buttons-container button');
    actionButtons.forEach(btn => btn.disabled = !anyChecked);
  }

  showPlaylistSelection() {
    const popupElement = this.getPopupElement();
    if (popupElement) {
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
  }

  getPopupElement() {
    return document.querySelector('.yt-music-extended-popup-container');
  }

  showPlaylistDetails() {
    const popupElement = this.getPopupElement();
    if (popupElement) {
      const selectionScreen = popupElement.querySelector('#playlistSelectionScreen');
      const detailsScreen = popupElement.querySelector('#playlistDetailsScreen');
      if (selectionScreen && detailsScreen) {
        selectionScreen.classList.add('hidden');
        detailsScreen.classList.remove('hidden');
      }
    }
  }


  listenForPageMessages() {
    // Listen for messages from the bridge script running in page context
    window.addEventListener('message', (event) => {
      console.log('Content script received message from page:', event, event.data);
      // Only accept messages from the same window
      if (event.source !== window) return;

      if (event.data.type === 'BRIDGE_LOADED') {
        console.log('Bridge script and content script have loaded and are ready. Notifying background script.');
        this.notifyBackgroundOfContentScript();
      }
    }, false);
  }

  notifyBackgroundOfContentScript() {
    this.messageManager.sendToBackground({ action: 'contentScriptLoaded' })
      .then(response => {
        console.log('Notified background of content script load:', response);
      })
      .catch(error => {
        console.error('Error notifying background of content script load:', error);
      });
  }


  initializeListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true; // Keep the message channel open
    });
  }

  async handleMessage(message, sendResponse) {
    console.log('Content script received message:', message);
    try {
      switch (message.action) {

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


  async showSidebar() {
    if (this.sidebarElement) {
      this.sidebarElement.style.display = 'block';
      return;
    }

    // Create iframe for sidebar
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
    iframe.id = 'extension-sidebar';
    iframe.style.cssText = `
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

    document.body.appendChild(iframe);
    this.sidebarElement = iframe;
  }

  async hideSidebar() {
    if (this.sidebarElement) {
      this.sidebarElement.style.display = 'none';
    }
  }

}

// Initialize the content script
new ContentScriptController();
