import { UIHelper } from './ui-helper.js';
import { CONSTANTS } from './constants.js';

/**
 * PopupManager - Handles in-page popup injection, styling, and event management
 */
export class PopupManager {
  constructor(options = {}) {
    this.storageManager = options.storageManager;
    this.popupHtmlUrl = options.popupHtmlUrl;
    this.popupCssUrl = options.popupCssUrl;
    this.extSettings = options.extSettings || {};
  }

  /**
   * Injects popup HTML and CSS into the page
   * @async
   */
  async injectPopup() {
    try {
      // Inject popup styles
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = this.popupCssUrl;
      document.head.appendChild(cssLink);

      // Fetch and inject popup HTML
      const response = await fetch(this.popupHtmlUrl);
      const htmlText = await response.text();

      const popupContainer = document.createElement('div');
      popupContainer.className = `yt-music-extended-popup-container-holder ${CONSTANTS.UI.CLASSES.HIDDEN}`;
      popupContainer.id = CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER;
      popupContainer.innerHTML = htmlText;

      document.body.appendChild(popupContainer);

      const warningMessage = popupContainer.querySelector('#yt-music-plus-warningMessage');
      if (warningMessage && this.extSettings.hideWarningMessage) {
        warningMessage.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      }

      this.setupPopupListeners(popupContainer);
      return popupContainer;
    } catch (error) {
      console.error('YouTube Music +: Popup injection failed', error);
      return null;
    }
  }

  /**
   * Sets up all popup event listeners
   * @param {HTMLElement} popupElement 
   */
  setupPopupListeners(popupElement) {
    if (!popupElement) return;

    // Select all checkbox handler
    const selectAllCheckbox = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.SELECT_ALL_CHECKBOX_ID}`);
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = Array.from(popupElement.querySelectorAll(`.${CONSTANTS.UI.CLASSES.ITEM_CHECKBOX}:not([disabled])`)).filter(cb => {
          const row = cb.closest(`.${CONSTANTS.UI.CLASSES.GRID_ROW}`);
          return row && !row.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN);
        });
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          cb.dataset.userInteracted = 'true';
        });
        UIHelper.updateCheckAllCheckbox();
      });
    }

    // Individual checkbox change handler with delegation
    popupElement.addEventListener('change', (e) => {
      const isRelevantCheckbox = e.target.classList.contains(CONSTANTS.UI.CLASSES.ITEM_CHECKBOX) ||
                                  e.target.classList.contains('select-all-checkbox') ||
                                  e.target.id === CONSTANTS.UI.ELEMENT_IDS.SELECT_ALL_CHECKBOX_ID;
      if (isRelevantCheckbox) {
        UIHelper.updateCheckAllCheckbox();
      }
    });

    // Back button handler
    const backButton = popupElement.querySelector(`#${CONSTANTS.UI.BUTTON_IDS.BACK_BUTTON}`);
    if (backButton) {
      backButton.addEventListener('click', () => this.showPlaylistSelection());
    }

    // Close warning message handler
    const closeWarningBtn = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.CLOSE_WARNING_BTN}`);
    if (closeWarningBtn) {
      closeWarningBtn.addEventListener('click', async () => {
        const warningMessage = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.WARNING_MESSAGE}`);
        if (warningMessage) {
          warningMessage.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
          this.extSettings.hideWarningMessage = true;
          if (this.storageManager) {
            await this.storageManager.set({ hideWarningMessage: true });
          }
        }
      });
    }

    // Toggle grid button handler
    const toggleGridBtn = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.TOGGLE_GRID_BTN}`);
    if (toggleGridBtn) {
      toggleGridBtn.addEventListener('click', () => UIHelper.toggleGrid());
    }
  }

  /**
   * Shows playlist selection screen in popup
   */
  showPlaylistSelection() {
    const popupElement = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
    if (!popupElement) return;

    const selectionScreen = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_SCREEN}`);
    const detailsScreen = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_DETAILS_SCREEN}`);
    const footer = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.SELECTION_FOOTER}`);
    
    if (selectionScreen && detailsScreen) {
      selectionScreen.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
      detailsScreen.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
    }

    if (footer) {
      footer.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_ACTIONS}`)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
      footer.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_COUNTS}`)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
      footer.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.SELECTION_COUNT}`)?.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      footer.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.PROGRESS_TEXT}`)?.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      footer.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.SEARCH_PROGRESS}`)?.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      footer.querySelector(`#${CONSTANTS.UI.BUTTON_IDS.CANCEL_SEARCH}`)?.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
    }

    const titleElement = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.POPUP_TITLE}`);
    if (titleElement) {
      titleElement.textContent = '';
    }
  }

  /**
   * Shows playlist details screen in popup
   */
  showPlaylistDetails() {
    const popupElement = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
    if (!popupElement) return;

    const selectionScreen = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_SCREEN}`);
    const detailsScreen = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_DETAILS_SCREEN}`);
    const footer = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.SELECTION_FOOTER}`);
    
    if (selectionScreen && detailsScreen) {
      selectionScreen.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      detailsScreen.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    }

    if (footer) {
      footer.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_ACTIONS}`)?.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      footer.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_COUNTS}`)?.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      footer.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.SELECTION_COUNT}`)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    }
  }

  /**
   * Shows the popup element on the page
   */
  showPopup() {
    const popupContainer = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
    if (popupContainer) {
      popupContainer.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    }
  }

  /**
   * Hides the popup element on the page
   */
  hidePopup() {
    const popupContainer = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
    if (popupContainer) {
      popupContainer.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
    }
  }
}
