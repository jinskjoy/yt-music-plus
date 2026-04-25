import { UIHelper } from './ui-helper.js';

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
      popupContainer.className = 'yt-music-extended-popup-container-holder hidden';
      popupContainer.id = 'yt-music-plus-popup';
      popupContainer.innerHTML = htmlText;

      this.enrichPopupContent(popupContainer);

      document.body.appendChild(popupContainer);

      const warningMessage = popupContainer.querySelector('#yt-music-plus-warningMessage');
      if (warningMessage && this.extSettings.hideWarningMessage) {
        warningMessage.classList.add('hidden');
      }

      this.setupPopupListeners(popupContainer);
      return popupContainer;
    } catch (error) {
      console.error('YouTube Music +: Popup injection failed', error);
      return null;
    }
  }

  /**
   * Enriches popup content with external links and structured wrappers
   * @param {HTMLElement} container 
   */
  enrichPopupContent(container) {
    // Inject 'Report a problem' link before the close button
    const closeBtn = container.querySelector('#closePopupBtn') || container.querySelector('.close-btn');
    if (closeBtn && closeBtn.parentNode) {
      const actionsWrapper = document.createElement('div');
      actionsWrapper.className = 'header-actions-wrapper';
      actionsWrapper.style.display = 'flex';
      actionsWrapper.style.alignItems = 'center';
      actionsWrapper.style.gap = '16px';

      closeBtn.parentNode.insertBefore(actionsWrapper, closeBtn);

      const reportLink = document.createElement('a');
      reportLink.href = 'https://chromewebstore.google.com/detail/lkieghnbgfnidfhdeclkjkmnjokmkmdc/support';
      reportLink.target = '_blank';
      reportLink.rel = 'noopener noreferrer';
      reportLink.textContent = 'Report a problem';
      reportLink.className = 'report-issue-link';
      actionsWrapper.appendChild(reportLink);
      actionsWrapper.appendChild(closeBtn);
    }

    // Convert main popup title to a link to the Chrome Web Store
    const popupMainTitle = container.querySelector('.popup-header h2') || 
                           Array.from(container.querySelectorAll('h2')).find(el => el.id !== 'popupTitle');
    
    if (popupMainTitle) {
      const originalHTML = popupMainTitle.innerHTML;
      popupMainTitle.innerHTML = '';
      const titleLink = document.createElement('a');
      titleLink.href = 'https://chromewebstore.google.com/detail/lkieghnbgfnidfhdeclkjkmnjokmkmdc';
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      titleLink.innerHTML = originalHTML;
      titleLink.style.textDecoration = 'none';
      titleLink.style.color = 'inherit';
      popupMainTitle.appendChild(titleLink);
    }
  }

  /**
   * Sets up all popup event listeners
   * @param {HTMLElement} popupElement 
   */
  setupPopupListeners(popupElement) {
    if (!popupElement) return;

    // Select all checkbox handler
    const selectAllCheckbox = popupElement.querySelector('#yt-music-plus-selectAllCheckbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = Array.from(popupElement.querySelectorAll('.item-checkbox:not([disabled])')).filter(cb => {
          const row = cb.closest('.grid-row');
          return row && !row.classList.contains('hidden');
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
      const isRelevantCheckbox = e.target.classList.contains('item-checkbox') ||
                                  e.target.classList.contains('select-all-checkbox') ||
                                  e.target.id === 'yt-music-plus-selectAllCheckbox';
      if (isRelevantCheckbox) {
        UIHelper.updateCheckAllCheckbox();
      }
    });

    // Back button handler
    const backButton = popupElement.querySelector('#backButton');
    if (backButton) {
      backButton.addEventListener('click', () => this.showPlaylistSelection());
    }

    // Close warning message handler
    const closeWarningBtn = popupElement.querySelector('#closeWarningBtn');
    if (closeWarningBtn) {
      closeWarningBtn.addEventListener('click', async () => {
        const warningMessage = popupElement.querySelector('#yt-music-plus-warningMessage');
        if (warningMessage) {
          warningMessage.classList.add('hidden');
          this.extSettings.hideWarningMessage = true;
          if (this.storageManager) {
            await this.storageManager.set({ hideWarningMessage: true });
          }
        }
      });
    }

    // Toggle grid button handler
    const toggleGridBtn = popupElement.querySelector('#toggleGridBtn');
    if (toggleGridBtn) {
      toggleGridBtn.addEventListener('click', () => UIHelper.toggleGrid());
    }
  }

  /**
   * Shows playlist selection screen in popup
   */
  showPlaylistSelection() {
    const popupElement = document.getElementById('yt-music-plus-popup');
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
    const popupElement = document.getElementById('yt-music-plus-popup');
    if (!popupElement) return;

    const selectionScreen = popupElement.querySelector('#playlistSelectionScreen');
    const detailsScreen = popupElement.querySelector('#playlistDetailsScreen');
    
    if (selectionScreen && detailsScreen) {
      selectionScreen.classList.add('hidden');
      detailsScreen.classList.remove('hidden');
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
}
