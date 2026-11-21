import { UIHelper } from './ui-helper.js';
import { CONSTANTS } from './constants.js';

/**
 * PopupManager - Handles in-page popup injection, styling, and event management
 */
export class PopupManager {
  constructor(options = {}) {
    this.storageManager = options.storageManager;
    this.popupHtmlUrl = options.popupHtmlUrl;
    this.extSettings = options.extSettings || {};
  }

  /**
   * Injects popup HTML into the page
   * @async
   */
  async injectPopup() {
    try {
      // Fetch and inject popup HTML
      const response = await fetch(this.popupHtmlUrl);
      const htmlText = await response.text();

      const popupContainer = document.createElement('div');
      popupContainer.className = `${CONSTANTS.UI.CLASSES.POPUP_CONTAINER_HOLDER} ${CONSTANTS.UI.CLASSES.HIDDEN} yt-music-plus-root`;
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

    // Clean up any existing global tab trap handler before attaching a new one
    if (PopupManager._tabTrapHandler) {
      document.removeEventListener('keydown', PopupManager._tabTrapHandler, true);
    }

    let lastFocusedElement = null;

    popupElement.addEventListener('focus', (e) => {
      if (e.target && e.target !== document.body && popupElement.contains(e.target)) {
        lastFocusedElement = e.target;
      }
    }, true);

    popupElement.addEventListener('focusin', (e) => {
      if (e.target && e.target !== document.body && popupElement.contains(e.target)) {
        lastFocusedElement = e.target;
      }
    }, true);

    popupElement.addEventListener('click', (e) => {
      const interactiveEl = e.target.closest('button, a, input, select, textarea, [tabindex="0"]');
      if (interactiveEl && popupElement.contains(interactiveEl)) {
        lastFocusedElement = interactiveEl;
      }
    }, true);

    // Global keyboard listener for Tab trap when popup is open
    const tabTrapHandler = (e) => {
      if (e.key !== 'Tab') return;

      const popupHolder = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
      if (!popupHolder || popupHolder.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)) {
        return;
      }

      const container = popupHolder.querySelector(`.${CONSTANTS.UI.CLASSES.POPUP_CONTAINER}`);
      if (container && container.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)) {
        return;
      }

      // Check for active modal overlay first
      const targetModal = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLIST_MODAL);
      const tokenModal = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TOKEN_EXPIRED_MODAL);
      const activeModal = (targetModal && !targetModal.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)) ? targetModal :
                          (tokenModal && !tokenModal.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)) ? tokenModal : null;

      const currentScope = activeModal || container || popupHolder;
      const focusable = Array.from(currentScope.querySelectorAll(
        'a[href]:not([disabled]), button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      )).filter(el => !el.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN) && !el.closest(`.${CONSTANTS.UI.CLASSES.HIDDEN}`));

      if (!focusable.length) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // If focus is currently outside this popup scope, continue from last focused element if valid
      if (!currentScope.contains(document.activeElement)) {
        e.preventDefault();
        if (lastFocusedElement && currentScope.contains(lastFocusedElement) && !lastFocusedElement.disabled && !lastFocusedElement.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)) {
          const lastIdx = focusable.indexOf(lastFocusedElement);
          if (lastIdx !== -1) {
            const targetIdx = e.shiftKey
              ? (lastIdx - 1 + focusable.length) % focusable.length
              : (lastIdx + 1) % focusable.length;
            focusable[targetIdx].focus();
            return;
          }
        }
        if (e.shiftKey) {
          last.focus();
        } else {
          first.focus();
        }
        return;
      }

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', tabTrapHandler, true);
    PopupManager._tabTrapHandler = tabTrapHandler;

    // Keyboard handler: Escape closes modals/popup; Space is captured to prevent
    // YouTube's own player from intercepting it when focus is inside the popup.
    popupElement.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const targetModal = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLIST_MODAL);
        const tokenModal = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TOKEN_EXPIRED_MODAL);

        if (targetModal && !targetModal.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)) {
          document.getElementById(CONSTANTS.UI.BUTTON_IDS.CANCEL_TARGET_MODAL)?.click();
          return;
        }
        if (tokenModal && !tokenModal.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)) {
          document.getElementById(CONSTANTS.UI.BUTTON_IDS.CANCEL_TOKEN_MODAL)?.click();
          return;
        }
        document.getElementById(CONSTANTS.UI.BUTTON_IDS.CLOSE_POPUP)?.click();
        return;
      }

      // Block Space from reaching YouTube's player when focused on a grid row
      // column or any non-input, non-button element inside the popup.
      if (e.key === ' ') {
        const tag = e.target.tagName;
        const isNativelyActivatable = tag === 'BUTTON' || tag === 'INPUT' ||
          tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'A';
        if (!isNativelyActivatable) {
          e.stopPropagation();
        }
      }
    }, true); // useCapture=true so we intercept before YouTube's handlers

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
                                  e.target.classList.contains(CONSTANTS.UI.CLASSES.SELECT_ALL_CHECKBOX) ||
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

    // Open settings handler
    const settingsLink = popupElement.querySelector(`#${CONSTANTS.UI.BUTTON_IDS.OPEN_SETTINGS}`);
    if (settingsLink) {
      settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ action: 'openOptions' });
      });
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
    
    // Clear the items grid when switching back to selection
    const gridContainer = popupElement.querySelector(`#${CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER}`);
    if (gridContainer) {
      gridContainer.replaceChildren();
    }
    
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
    const popupHolder = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
    if (popupHolder) {
      popupHolder.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
      
      const container = popupHolder.querySelector(`.${CONSTANTS.UI.CLASSES.POPUP_CONTAINER}`);
      if (container && container.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)) {
        container.classList.remove(CONSTANTS.UI.CLASSES.MINIMIZED);
        popupHolder.classList.remove(CONSTANTS.UI.CLASSES.MINIMIZED);
        
        const minimizeBtn = popupHolder.querySelector(`#${CONSTANTS.UI.BUTTON_IDS.MINIMIZE_POPUP}`);
        if (minimizeBtn) {
          minimizeBtn.textContent = '−';
          minimizeBtn.setAttribute('aria-label', 'Minimize popup');
        }
      }

      // Focus heading as starting point for keyboard navigation
      UIHelper.focusPopupHeading(popupHolder);
    }
  }

  /**
   * Hides the popup element on the page
   */
  hidePopup() {
    const popupHolder = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
    if (popupHolder) {
      popupHolder.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      
      // Reset minimized state when closing
      const container = popupHolder.querySelector(`.${CONSTANTS.UI.CLASSES.POPUP_CONTAINER}`);
      if (container && container.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)) {
        container.classList.remove(CONSTANTS.UI.CLASSES.MINIMIZED);
        popupHolder.classList.remove(CONSTANTS.UI.CLASSES.MINIMIZED);
        
        const minimizeBtn = popupHolder.querySelector(`#${CONSTANTS.UI.BUTTON_IDS.MINIMIZE_POPUP}`);
        if (minimizeBtn) {
          minimizeBtn.textContent = '−';
          minimizeBtn.setAttribute('aria-label', 'Minimize popup');
        }
      }
    }
  }
}
