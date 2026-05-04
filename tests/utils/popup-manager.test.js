import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PopupManager } from '../../utils/popup-manager.js';
import { UIHelper } from '../../utils/ui-helper.js';
import { CONSTANTS } from '../../utils/constants.js';

describe('PopupManager', () => {
  let popupManager;
  let mockStorageManager;
  const popupHtmlUrl = 'chrome-extension://id/popup.html';

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    
    // Spy on UIHelper methods instead of global mock
    vi.spyOn(UIHelper, 'updateCheckAllCheckbox').mockImplementation(() => {});
    vi.spyOn(UIHelper, 'toggleGrid').mockImplementation(() => {});
    
    mockStorageManager = {
      set: vi.fn().mockResolvedValue(true),
    };
    
    popupManager = new PopupManager({
      storageManager: mockStorageManager,
      popupHtmlUrl,
      extSettings: { hideWarningMessage: false }
    });
  });

  it('should initialize with provided options', () => {
    expect(popupManager.storageManager).toBe(mockStorageManager);
    expect(popupManager.popupHtmlUrl).toBe(popupHtmlUrl);
    expect(popupManager.extSettings.hideWarningMessage).toBe(false);
  });

  describe('injectPopup', () => {
    it('should fetch and inject popup HTML', async () => {
      const mockHtml = `
        <div id="yt-music-plus-warningMessage">Warning</div>
        <input id="${CONSTANTS.UI.ELEMENT_IDS.SELECT_ALL_CHECKBOX_ID}" type="checkbox">
        <button id="${CONSTANTS.UI.BUTTON_IDS.BACK_BUTTON}">Back</button>
        <a id="${CONSTANTS.UI.BUTTON_IDS.OPEN_SETTINGS}">Settings</a>
        <button id="${CONSTANTS.UI.ELEMENT_IDS.CLOSE_WARNING_BTN}">Close</button>
        <button id="${CONSTANTS.UI.ELEMENT_IDS.TOGGLE_GRID_BTN}">Toggle Grid</button>
      `;
      
      global.fetch.mockResolvedValue({
        text: () => Promise.resolve(mockHtml)
      });

      const container = await popupManager.injectPopup();
      
      expect(global.fetch).toHaveBeenCalledWith(popupHtmlUrl);
      expect(container).not.toBeNull();
      expect(container.id).toBe(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
      expect(document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER)).toBe(container);
    });

    it('should hide warning message if setting is true', async () => {
      popupManager.extSettings.hideWarningMessage = true;
      const mockHtml = '<div id="yt-music-plus-warningMessage">Warning</div>';
      
      global.fetch.mockResolvedValue({
        text: () => Promise.resolve(mockHtml)
      });

      const container = await popupManager.injectPopup();
      const warningMessage = container.querySelector('#yt-music-plus-warningMessage');
      expect(warningMessage.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });

    it('should handle fetch errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch.mockRejectedValue(new Error('Fetch failed'));

      const container = await popupManager.injectPopup();
      
      expect(container).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Popup injection failed'), expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should not hide warning if it does not exist', async () => {
      popupManager.extSettings.hideWarningMessage = true;
      global.fetch.mockResolvedValue({
        text: () => Promise.resolve('<div>No warning here</div>')
      });
      const container = await popupManager.injectPopup();
      expect(container.querySelector('#yt-music-plus-warningMessage')).toBeNull();
    });
  });

  describe('setupPopupListeners', () => {
    let popupElement;

    beforeEach(() => {
      popupElement = document.createElement('div');
      popupElement.id = CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER;
      popupElement.innerHTML = `
        <input id="${CONSTANTS.UI.ELEMENT_IDS.SELECT_ALL_CHECKBOX_ID}" class="${CONSTANTS.UI.CLASSES.SELECT_ALL_CHECKBOX}" type="checkbox">
        <div class="${CONSTANTS.UI.CLASSES.GRID_ROW}">
          <input class="${CONSTANTS.UI.CLASSES.ITEM_CHECKBOX}" type="checkbox">
        </div>
        <div class="${CONSTANTS.UI.CLASSES.GRID_ROW} ${CONSTANTS.UI.CLASSES.HIDDEN}">
          <input class="${CONSTANTS.UI.CLASSES.ITEM_CHECKBOX}" type="checkbox">
        </div>
        <button id="${CONSTANTS.UI.BUTTON_IDS.BACK_BUTTON}">Back</button>
        <a id="${CONSTANTS.UI.BUTTON_IDS.OPEN_SETTINGS}">Settings</a>
        <div id="${CONSTANTS.UI.ELEMENT_IDS.WARNING_MESSAGE}">
          <button id="${CONSTANTS.UI.ELEMENT_IDS.CLOSE_WARNING_BTN}">Close</button>
        </div>
        <button id="${CONSTANTS.UI.ELEMENT_IDS.TOGGLE_GRID_BTN}">Toggle Grid</button>
        <div id="${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_SCREEN}"></div>
        <div id="${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_DETAILS_SCREEN}"></div>
        <div id="${CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER}"></div>
      `;
      document.body.appendChild(popupElement);
      popupManager.setupPopupListeners(popupElement);
    });

    it('should handle select all checkbox change', () => {
      const selectAll = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.SELECT_ALL_CHECKBOX_ID}`);
      const checkboxes = popupElement.querySelectorAll(`.${CONSTANTS.UI.CLASSES.ITEM_CHECKBOX}`);
      
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event('change'));

      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[0].dataset.userInteracted).toBe('true');
      // Hidden row checkbox should not be checked by Select All
      expect(checkboxes[1].checked).toBe(false);
      expect(UIHelper.updateCheckAllCheckbox).toHaveBeenCalled();
    });

    it('should handle individual checkbox change via delegation', () => {
      const checkbox = popupElement.querySelector(`.${CONSTANTS.UI.CLASSES.ITEM_CHECKBOX}`);
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      expect(UIHelper.updateCheckAllCheckbox).toHaveBeenCalled();
    });

    it('should handle back button click', () => {
      const backButton = popupElement.querySelector(`#${CONSTANTS.UI.BUTTON_IDS.BACK_BUTTON}`);
      const selectionScreen = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_SCREEN}`);
      const detailsScreen = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_DETAILS_SCREEN}`);
      
      detailsScreen.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
      selectionScreen.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      
      backButton.click();

      expect(selectionScreen.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
      expect(detailsScreen.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });

    it('should handle settings link click', () => {
      const settingsLink = popupElement.querySelector(`#${CONSTANTS.UI.BUTTON_IDS.OPEN_SETTINGS}`);
      settingsLink.click();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'openOptions' });
    });

    it('should handle close warning button click', async () => {
      const closeBtn = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.CLOSE_WARNING_BTN}`);
      const warningMessage = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.WARNING_MESSAGE}`);
      
      await closeBtn.click();

      expect(warningMessage.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
      expect(popupManager.extSettings.hideWarningMessage).toBe(true);
      expect(mockStorageManager.set).toHaveBeenCalledWith({ hideWarningMessage: true });
    });

    it('should handle toggle grid button click', () => {
      const toggleBtn = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.TOGGLE_GRID_BTN}`);
      toggleBtn.click();
      expect(UIHelper.toggleGrid).toHaveBeenCalled();
    });
  });

  describe('setupPopupListeners edge cases', () => {
    it('should return early if no popupElement', () => {
      expect(popupManager.setupPopupListeners(null)).toBeUndefined();
    });

    it('should handle missing elements during setup', () => {
      const minimalPopup = document.createElement('div');
      // Should not throw
      popupManager.setupPopupListeners(minimalPopup);
    });

    it('should handle missing row or hidden row in select all', () => {
      const popup = document.createElement('div');
      popup.innerHTML = `
        <input id="${CONSTANTS.UI.ELEMENT_IDS.SELECT_ALL_CHECKBOX_ID}" type="checkbox">
        <input class="${CONSTANTS.UI.CLASSES.ITEM_CHECKBOX}" type="checkbox">
      `;
      popupManager.setupPopupListeners(popup);
      
      const selectAll = popup.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.SELECT_ALL_CHECKBOX_ID}`);
      const checkbox = popup.querySelector(`.${CONSTANTS.UI.CLASSES.ITEM_CHECKBOX}`);
      
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event('change'));
      
      // Checkbox has no row, so it shouldn't be checked by the current filter
      expect(checkbox.checked).toBe(false);
    });

    it('should handle non-relevant checkbox changes', () => {
      const popup = document.createElement('div');
      popup.innerHTML = '<input id="other" type="checkbox">';
      popupManager.setupPopupListeners(popup);
      
      const other = popup.querySelector('#other');
      other.dispatchEvent(new Event('change', { bubbles: true }));
      
      expect(UIHelper.updateCheckAllCheckbox).not.toHaveBeenCalled();
    });

    it('should handle missing warningMessage or storageManager on close warning click', async () => {
      const popup = document.createElement('div');
      popup.innerHTML = `<button id="${CONSTANTS.UI.ELEMENT_IDS.CLOSE_WARNING_BTN}">Close</button>`;
      
      // Case 1: missing warningMessage
      popupManager.setupPopupListeners(popup);
      const closeBtn = popup.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.CLOSE_WARNING_BTN}`);
      await closeBtn.click();
      expect(popupManager.extSettings.hideWarningMessage).toBe(false);

      // Case 2: missing storageManager
      popup.innerHTML = `
        <div id="${CONSTANTS.UI.ELEMENT_IDS.WARNING_MESSAGE}"></div>
        <button id="${CONSTANTS.UI.ELEMENT_IDS.CLOSE_WARNING_BTN}">Close</button>
      `;
      const noStorageManager = new PopupManager({ storageManager: null });
      noStorageManager.setupPopupListeners(popup);
      await popup.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.CLOSE_WARNING_BTN}`).click();
      expect(noStorageManager.extSettings.hideWarningMessage).toBe(true);
    });
  });

  describe('View switching', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="${CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER}">
          <div id="${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_SCREEN}"></div>
          <div id="${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_DETAILS_SCREEN}"></div>
          <div id="${CONSTANTS.UI.ELEMENT_IDS.SELECTION_FOOTER}">
            <div id="${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_ACTIONS}"></div>
            <div id="${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_COUNTS}"></div>
            <div id="${CONSTANTS.UI.ELEMENT_IDS.SELECTION_COUNT}"></div>
            <div id="${CONSTANTS.UI.ELEMENT_IDS.PROGRESS_TEXT}"></div>
            <div id="${CONSTANTS.UI.ELEMENT_IDS.SEARCH_PROGRESS}"></div>
            <button id="${CONSTANTS.UI.BUTTON_IDS.CANCEL_SEARCH}"></button>
          </div>
          <div id="${CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER}">
            <div>Item 1</div>
          </div>
          <div id="${CONSTANTS.UI.ELEMENT_IDS.POPUP_TITLE}">Some Title</div>
        </div>
      `;
    });

    it('should show playlist selection', () => {
      popupManager.showPlaylistSelection();
      
      const selectionScreen = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_SCREEN);
      const detailsScreen = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_DETAILS_SCREEN);
      const gridContainer = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
      const titleElement = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_TITLE);
      
      expect(selectionScreen.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
      expect(detailsScreen.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
      expect(gridContainer.children.length).toBe(0);
      expect(titleElement.textContent).toBe('');
    });

    it('should show playlist details', () => {
      popupManager.showPlaylistDetails();
      
      const selectionScreen = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_SCREEN);
      const detailsScreen = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_DETAILS_SCREEN);
      const selectionCount = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SELECTION_COUNT);
      
      expect(selectionScreen.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
      expect(detailsScreen.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
      expect(selectionCount.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
    });
  });

  describe('View switching edge cases', () => {
    it('should handle missing elements in showPlaylistSelection', () => {
      document.body.innerHTML = `<div id="${CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER}"></div>`;
      // Should not throw
      popupManager.showPlaylistSelection();
    });

    it('should handle missing footer children in showPlaylistSelection', () => {
      document.body.innerHTML = `
        <div id="${CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER}">
          <div id="${CONSTANTS.UI.ELEMENT_IDS.SELECTION_FOOTER}"></div>
        </div>
      `;
      // Should not throw
      popupManager.showPlaylistSelection();
    });

    it('should handle missing popupElement in showPlaylistSelection', () => {
      document.body.innerHTML = '';
      popupManager.showPlaylistSelection();
    });

    it('should handle missing elements in showPlaylistDetails', () => {
      document.body.innerHTML = `<div id="${CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER}"></div>`;
      // Should not throw
      popupManager.showPlaylistDetails();
    });

    it('should handle missing popupElement in showPlaylistDetails', () => {
      document.body.innerHTML = '';
      popupManager.showPlaylistDetails();
    });
  });

  describe('Visibility management', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="${CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER}" class="${CONSTANTS.UI.CLASSES.HIDDEN}">
          <div class="${CONSTANTS.UI.CLASSES.POPUP_CONTAINER}">
            <button id="${CONSTANTS.UI.BUTTON_IDS.MINIMIZE_POPUP}">−</button>
          </div>
        </div>
      `;
    });

    it('should show popup', () => {
      popupManager.showPopup();
      const popupHolder = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
      expect(popupHolder.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
    });

    it('should restore from minimized when showing', () => {
      const popupHolder = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
      const container = popupHolder.querySelector(`.${CONSTANTS.UI.CLASSES.POPUP_CONTAINER}`);
      const minimizeBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.MINIMIZE_POPUP);
      
      container.classList.add(CONSTANTS.UI.CLASSES.MINIMIZED);
      popupHolder.classList.add(CONSTANTS.UI.CLASSES.MINIMIZED);
      
      popupManager.showPopup();
      
      expect(container.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)).toBe(false);
      expect(popupHolder.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)).toBe(false);
      expect(minimizeBtn.textContent).toBe('−');
    });

    it('should hide popup', () => {
      const popupHolder = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
      popupHolder.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
      
      popupManager.hidePopup();
      
      expect(popupHolder.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });

    it('should reset minimized state when hiding', () => {
      const popupHolder = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
      const container = popupHolder.querySelector(`.${CONSTANTS.UI.CLASSES.POPUP_CONTAINER}`);
      
      container.classList.add(CONSTANTS.UI.CLASSES.MINIMIZED);
      
      popupManager.hidePopup();
      
      expect(container.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)).toBe(false);
    });
  });

  describe('Visibility management edge cases', () => {
    it('should handle missing elements in showPopup', () => {
      document.body.innerHTML = '';
      popupManager.showPopup(); // Should not throw
    });

    it('should handle missing minimizeBtn when container is minimized in showPopup', () => {
      document.body.innerHTML = `
        <div id="${CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER}">
          <div class="${CONSTANTS.UI.CLASSES.POPUP_CONTAINER} ${CONSTANTS.UI.CLASSES.MINIMIZED}"></div>
        </div>
      `;
      popupManager.showPopup();
      const container = document.querySelector(`.${CONSTANTS.UI.CLASSES.POPUP_CONTAINER}`);
      expect(container.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)).toBe(false);
    });

    it('should handle missing elements in hidePopup', () => {
      document.body.innerHTML = '';
      popupManager.hidePopup(); // Should not throw
    });

    it('should handle missing minimizeBtn when container is minimized in hidePopup', () => {
      document.body.innerHTML = `
        <div id="${CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER}">
          <div class="${CONSTANTS.UI.CLASSES.POPUP_CONTAINER} ${CONSTANTS.UI.CLASSES.MINIMIZED}"></div>
        </div>
      `;
      popupManager.hidePopup();
      const container = document.querySelector(`.${CONSTANTS.UI.CLASSES.POPUP_CONTAINER}`);
      expect(container.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)).toBe(false);
    });
  });
});
