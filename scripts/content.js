import { DOMModifier } from '../utils/dom-modifier.js';
import { MessageManager } from '../utils/messages.js';

class ContentScriptController {
  constructor() {
    this.domModifier = DOMModifier;
    this.messageManager = new MessageManager();
    this.sidebarElement = null;
    this.ytconfig = null;
    this.listenForPageMessages();
    this.initializeListeners();
    this.injectBridgeScript();
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
    
        case 'showSidebar':
          await this.showSidebar();
          sendResponse({ success: true });
          break;

        case 'hideSidebar':
          await this.hideSidebar();
          sendResponse({ success: true });
          break;

        case 'modifyDOM':
          const modifyResult = await this.domModifier.modifyElement(
            message.selector,
            message.modifications
          );
          sendResponse(modifyResult);
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

// Inject styles for highlights
const style = document.createElement('style');
style.textContent = `
  [data-playlist].refreshing {
    opacity: 0.6;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  [data-playlist].highlighted {
    border-radius: 4px;
    transition: background-color 0.3s ease;
  }
`;
document.head.appendChild(style);
