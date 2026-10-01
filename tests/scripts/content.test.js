import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentScriptController } from '../../scripts/content.js';
import { CONSTANTS } from '../../utils/constants.js';

describe('ContentScriptController', () => {
  let controller;

  beforeEach(() => {
    document.body.innerHTML = '<div id="right-content"></div><div id="head"></div>';
    global.chrome.runtime.getManifest = vi.fn(() => ({ version: CONSTANTS.VERSION }));
    global.fetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve('<div id="yt-music-plus-popup"></div>')
    });
  });

  describe('injectNavBarButton', () => {
    it('should inject nav bar button with YTM+ text when showNavButton is true', () => {
      const navRight = document.getElementById('right-content');
      const dummy = Object.create(ContentScriptController.prototype);
      dummy.extSettings = { showNavButton: true };
      dummy.injectNavBarButton();

      const btn = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.NAV_BTN);
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe('YTM+');
      expect(navRight.contains(btn)).toBe(true);
    });

    it('should not inject nav bar button if showNavButton is false', () => {
      const dummy = Object.create(ContentScriptController.prototype);
      dummy.extSettings = { showNavButton: false };
      dummy.injectNavBarButton();

      const btn = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.NAV_BTN);
      expect(btn).toBeNull();
    });

    it('should not inject if right-content element is missing', () => {
      document.body.innerHTML = '';
      const dummy = Object.create(ContentScriptController.prototype);
      dummy.extSettings = { showNavButton: true };
      expect(() => dummy.injectNavBarButton()).not.toThrow();
      expect(document.getElementById(CONSTANTS.UI.ELEMENT_IDS.NAV_BTN)).toBeNull();
    });
  });

  describe('loadSettings', () => {
    it('should load settings from storage manager', async () => {
      const dummy = Object.create(ContentScriptController.prototype);
      dummy.extSettings = { ...CONSTANTS.SETTINGS.DEFAULT };
      dummy.storageManager = {
        get: vi.fn().mockResolvedValue({ showNavButton: false, customSetting: 123 })
      };

      await dummy.loadSettings();
      expect(dummy.extSettings.showNavButton).toBe(false);
      expect(dummy.extSettings.customSetting).toBe(123);
    });

    it('should fallback to default settings if storage fails', async () => {
      const dummy = Object.create(ContentScriptController.prototype);
      dummy.extSettings = { showNavButton: false };
      dummy.storageManager = {
        get: vi.fn().mockRejectedValue(new Error('Storage failure'))
      };

      await dummy.loadSettings();
      expect(dummy.extSettings).toEqual(CONSTANTS.SETTINGS.DEFAULT);
    });
  });

  describe('injectBridgeScript', () => {
    it('should inject script into document head', () => {
      let appendedNode = null;
      const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
        appendedNode = node;
        return node;
      });

      const dummy = Object.create(ContentScriptController.prototype);
      dummy.injectBridgeScript();

      expect(appendedNode).not.toBeNull();
      expect(appendedNode.tagName.toLowerCase()).toBe('script');
      expect(appendedNode.type).toBe('module');
      expect(appendedNode.src).toContain('chrome-extension://');

      appendSpy.mockRestore();
    });

    it('should handle injection failure gracefully', () => {
      const dummy = Object.create(ContentScriptController.prototype);
      const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation(() => {
        throw new Error('DOM Error');
      });

      expect(() => dummy.injectBridgeScript()).not.toThrow();
      appendSpy.mockRestore();
    });
  });

  describe('notifyBackgroundOfContentScript', () => {
    it('should send contentScriptLoaded message to background', async () => {
      const dummy = Object.create(ContentScriptController.prototype);
      dummy.messageManager = {
        sendToBackground: vi.fn().mockResolvedValue({ success: true })
      };

      await dummy.notifyBackgroundOfContentScript();
      expect(dummy.messageManager.sendToBackground).toHaveBeenCalledWith({
        action: 'contentScriptLoaded'
      });
    });

    it('should catch error when notification fails', async () => {
      const dummy = Object.create(ContentScriptController.prototype);
      dummy.messageManager = {
        sendToBackground: vi.fn().mockRejectedValue(new Error('Send failed'))
      };

      await expect(dummy.notifyBackgroundOfContentScript()).resolves.not.toThrow();
    });
  });

  describe('handleMessage', () => {
    it('should handle showPopup action', async () => {
      const dummy = Object.create(ContentScriptController.prototype);
      dummy.popupManager = { showPopup: vi.fn() };
      const sendResponse = vi.fn();

      await dummy.handleMessage({ action: 'showPopup' }, sendResponse);
      expect(dummy.popupManager.showPopup).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should handle hidePopup action', async () => {
      const dummy = Object.create(ContentScriptController.prototype);
      dummy.popupManager = { hidePopup: vi.fn() };
      const sendResponse = vi.fn();

      await dummy.handleMessage({ action: 'hidePopup' }, sendResponse);
      expect(dummy.popupManager.hidePopup).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should handle settingsUpdated action and post message', async () => {
      const dummy = Object.create(ContentScriptController.prototype);
      dummy.extSettings = { showNavButton: true };
      dummy.popupManager = { extSettings: null };
      const postMessageSpy = vi.spyOn(window, 'postMessage');
      const sendResponse = vi.fn();

      await dummy.handleMessage(
        { action: 'settingsUpdated', settings: { showNavButton: false } },
        sendResponse
      );

      expect(dummy.extSettings.showNavButton).toBe(false);
      expect(dummy.popupManager.extSettings.showNavButton).toBe(false);
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          type: CONSTANTS.MESSAGE_TYPES.EXT_SETTINGS,
          settings: { showNavButton: false }
        },
        '*'
      );
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
      postMessageSpy.mockRestore();
    });

    it('should handle refreshAllPlaylists action', async () => {
      const dummy = Object.create(ContentScriptController.prototype);
      const sendResponse = vi.fn();

      await dummy.handleMessage({ action: 'refreshAllPlaylists' }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should handle unknown action', async () => {
      const dummy = Object.create(ContentScriptController.prototype);
      const sendResponse = vi.fn();

      await dummy.handleMessage({ action: 'nonExistentAction' }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ success: false, message: 'Unknown action' });
    });

    it('should catch errors and send failure response', async () => {
      const dummy = Object.create(ContentScriptController.prototype);
      dummy.popupManager = {
        showPopup: vi.fn(() => {
          throw new Error('Popup error');
        })
      };
      const sendResponse = vi.fn();

      await dummy.handleMessage({ action: 'showPopup' }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ success: false, message: 'Popup error' });
    });
  });

  describe('setupListeners', () => {
    it('should set up window and chrome runtime message listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      let onMessageCallback;
      global.chrome.runtime.onMessage.addListener = vi.fn((cb) => {
        onMessageCallback = cb;
      });

      const dummy = Object.create(ContentScriptController.prototype);
      dummy.extSettings = { ...CONSTANTS.SETTINGS.DEFAULT };
      dummy.notifyBackgroundOfContentScript = vi.fn();
      dummy.handleMessage = vi.fn();

      dummy.setupListeners();

      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
      expect(global.chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));

      // Trigger chrome.runtime.onMessage
      const sendResponse = vi.fn();
      const res = onMessageCallback({ action: 'showPopup' }, {}, sendResponse);
      expect(res).toBe(true);
      expect(dummy.handleMessage).toHaveBeenCalledWith({ action: 'showPopup' }, sendResponse);

      addEventListenerSpy.mockRestore();
    });

    it('should handle BRIDGE_LOADED window message event', () => {
      let windowMessageCallback;
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
        if (event === 'message') windowMessageCallback = cb;
      });

      const dummy = Object.create(ContentScriptController.prototype);
      dummy.extSettings = { ...CONSTANTS.SETTINGS.DEFAULT };
      dummy.notifyBackgroundOfContentScript = vi.fn();

      dummy.setupListeners();

      const postMessageSpy = vi.spyOn(window, 'postMessage');

      // Test foreign event
      windowMessageCallback({ source: {} });
      expect(dummy.notifyBackgroundOfContentScript).not.toHaveBeenCalled();

      // Test correct source but other type
      windowMessageCallback({ source: window, data: { type: 'OTHER' } });
      expect(dummy.notifyBackgroundOfContentScript).not.toHaveBeenCalled();

      // Test BRIDGE_LOADED
      windowMessageCallback({ source: window, data: { type: 'BRIDGE_LOADED' } });
      expect(dummy.notifyBackgroundOfContentScript).toHaveBeenCalled();
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          type: CONSTANTS.MESSAGE_TYPES.EXT_SETTINGS,
          settings: dummy.extSettings,
          version: CONSTANTS.VERSION
        },
        '*'
      );

      postMessageSpy.mockRestore();
      addEventListenerSpy.mockRestore();
    });
  });

  describe('constructor & init', () => {
    it('should initialize successfully', async () => {
      const initSpy = vi.spyOn(ContentScriptController.prototype, 'init').mockImplementation(async function () {
        await this.loadSettings();
      });
      const setupSpy = vi.spyOn(ContentScriptController.prototype, 'setupListeners').mockImplementation(() => {});

      const instance = new ContentScriptController();
      expect(instance.domModifier).toBeDefined();
      expect(instance.messageManager).toBeDefined();
      expect(instance.storageManager).toBeDefined();

      initSpy.mockRestore();
      setupSpy.mockRestore();
    });

    it('should run full init method', async () => {
      const dummy = Object.create(ContentScriptController.prototype);
      dummy.storageManager = { get: vi.fn().mockResolvedValue({}) };
      dummy.extSettings = { ...CONSTANTS.SETTINGS.DEFAULT };
      dummy.injectBridgeScript = vi.fn();
      dummy.injectNavBarButton = vi.fn();

      await dummy.init();
      expect(dummy.popupManager).toBeDefined();
      expect(dummy.injectBridgeScript).toHaveBeenCalled();
      expect(dummy.injectNavBarButton).toHaveBeenCalled();
    });
  });
});
