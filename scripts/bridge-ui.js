import { UIHelper, MediaGridRow, PlaylistCard } from '../utils/ui-helper.js';
import { BrowserUtils } from '../utils/utils.js';
import { CONSTANTS } from '../utils/constants.js';

/**
 * BridgeUI - Handles all DOM interactions for the Bridge script within the page context
 */
export class BridgeUI {
  constructor(bridge) {
    this.bridge = bridge;
    this.rowMap = new Map();
    this.initTargetModalButtons();
  }

  /**
   * Initializes buttons for the target selection modal
   */
  initTargetModalButtons() {
    const attach = (id, handler) => {
      const btn = document.getElementById(id);
      if (btn && !btn.dataset.initialized) {
        btn.dataset.initialized = 'true';
        btn.addEventListener('click', handler);
      }
    };

    attach(CONSTANTS.UI.BUTTON_IDS.CLOSE_TARGET_MODAL, () => this.bridge.cancelTargetSelection());
    attach(CONSTANTS.UI.BUTTON_IDS.CANCEL_TARGET_MODAL, () => this.bridge.cancelTargetSelection());
    attach(CONSTANTS.UI.BUTTON_IDS.REFRESH_TARGET_PLAYLISTS, () => this.bridge.initPlaylistFetching(true, true, true));
    attach(CONSTANTS.UI.BUTTON_IDS.LOAD_ALL_TARGET_PLAYLISTS, () => this.bridge.initPlaylistFetching(true, false, true));
  }

  /**
   * Sets progress text in the UI
   * @param {string} text - Progress text
   */
  setProgressText(text) {
    const el = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PROGRESS_TEXT);
    if (el) {
      el.textContent = text;
      el.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !text);
      
      const footer = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SELECTION_FOOTER);
      if (footer && text) {
        footer.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
      }
    }
  }

  /**
   * Clears the playlist items container
   */
  clearPlaylistItemsContainer() {
    this.rowMap.clear();
    const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
    if (container) {
      container.replaceChildren();
    }
    const wrapper = document.querySelector(`.${CONSTANTS.UI.CLASSES.ITEMS_GRID_WRAPPER}`);
    if (wrapper) {
      wrapper.classList.remove(CONSTANTS.UI.CLASSES.LIST_ONLY_MODE);
      wrapper.classList.remove(CONSTANTS.UI.CLASSES.DUPLICATE_TRACK_MODE);
    }
  }

  /**
   * Clears the active state from all playlist action buttons
   */
  clearActiveButtons() {
    document.querySelectorAll(CONSTANTS.UI.SELECTORS.ACTIVE_ACTION_BUTTON).forEach(btn => {
      btn.classList.remove(CONSTANTS.UI.CLASSES.ACTIVE);
    });
  }

  /**
   * Checks if any playlist action button is currently active
   * @returns {boolean} True if a button is active
   */
  hasActiveActionButton() {
    return !!document.querySelector(CONSTANTS.UI.SELECTORS.ACTIVE_ACTION_BUTTON);
  }

  /**
   * Sets the active button in the playlist action buttons section
   * @param {string} buttonId - ID of the button to set as active
   */
  setActiveButton(buttonId) {
    // First clear any existing active buttons in this section
    this.clearActiveButtons();

    // Set the new button as active
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.add(CONSTANTS.UI.CLASSES.ACTIVE);
    }
  }

  /**
   * Adds an item row to the display
   */
  addItem(item, baseUrl, index, groupInfo = null) {
    const { originalMedia, replacementMedia } = this.bridge._createMediaObjects(item, baseUrl);

    // Use group-scoped index if available
    const displayIndex = groupInfo ? groupInfo.indexInGroup + 1 : index;
    const gridRow = MediaGridRow.render(originalMedia, replacementMedia, displayIndex, this.bridge.playerHandler);
    
    if (groupInfo) {
      if (groupInfo.isStart) {
        gridRow.classList.add(CONSTANTS.UI.CLASSES.DUPLICATE_GROUP_START);
        
        // Add "Ignore Group" button to the first row of a duplicate group
        const replacementCol = gridRow.querySelector(`.${CONSTANTS.UI.CLASSES.GRID_COL_REPLACEMENT}`);
        if (replacementCol) {
          const ignoreBtn = document.createElement('button');
          ignoreBtn.className = `${CONSTANTS.UI.CLASSES.BTN} ${CONSTANTS.UI.CLASSES.BTN_PRIMARY} ${CONSTANTS.UI.CLASSES.IGNORE_GROUP_BTN} btn-icon`;
          ignoreBtn.innerHTML = '✕';
          ignoreBtn.title = 'Ignore this group';
          ignoreBtn.type = 'button';
          ignoreBtn.addEventListener('click', () => {
            const allGroupRows = document.querySelectorAll(`.${CONSTANTS.UI.CLASSES.GRID_ROW}[data-group-index="${groupInfo.groupIndex}"]`);
            allGroupRows.forEach(row => row.remove());
            UIHelper.updateCheckAllCheckbox();
          });
          replacementCol.appendChild(ignoreBtn);
        }
      }
      gridRow.classList.add(CONSTANTS.UI.CLASSES.DUPLICATE_GROUP_ROW);
      gridRow.dataset.groupIndex = groupInfo.groupIndex;
    }

    document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER)?.appendChild(gridRow);
    this.rowMap.set(index, gridRow);
    return gridRow;
  }

  /**
   * Updates an existing item row
   */
  updateItemRow(item, baseUrl, index, groupInfo = null) {
    const oldRow = this.rowMap.get(index);
    if (oldRow) {
      const oldCheckbox = oldRow.querySelector(`.${CONSTANTS.UI.CLASSES.ITEM_CHECKBOX}`);
      const userInteracted = oldCheckbox?.dataset.userInteracted === 'true';
      const wasChecked = oldCheckbox ? oldCheckbox.checked : false;

      const { originalMedia, replacementMedia } = this.bridge._createMediaObjects(item, baseUrl);
      const newRow = MediaGridRow.render(originalMedia, replacementMedia, index, this.bridge.playerHandler);
      
      if (groupInfo) {
        if (groupInfo.isStart) newRow.classList.add(CONSTANTS.UI.CLASSES.DUPLICATE_GROUP_START);
        newRow.classList.add(CONSTANTS.UI.CLASSES.DUPLICATE_GROUP_ROW);
      }

      const newCheckbox = newRow.querySelector(`.${CONSTANTS.UI.CLASSES.ITEM_CHECKBOX}`);
      if (newCheckbox && oldCheckbox && userInteracted) {
        newCheckbox.checked = wasChecked;
        newCheckbox.dataset.userInteracted = 'true';
      }

      const searchInput = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SEARCH_INPUT);
      if (searchInput && searchInput.value) {
        const normalizedQuery = searchInput.value.toLowerCase().trim();
        const searchString = newRow.dataset.searchString || '';
        newRow.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !searchString.includes(normalizedQuery));
      }
      oldRow.parentNode?.replaceChild(newRow, oldRow);
      this.rowMap.set(index, newRow);
    }
  }

  /**
   * Toggles search progress indicators
   */
  toggleSearchProgress(show, isSearch = false) {
    const loadingOverlay = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SEARCH_PROGRESS);
    if (loadingOverlay) {
      loadingOverlay.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !show);
    }

    const cancelBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.CANCEL_SEARCH);
    if (cancelBtn) {
      cancelBtn.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !(show && isSearch));
    }

    // Disable/enable buttons during search
    const buttonIds = [
      CONSTANTS.UI.BUTTON_IDS.FIND_UNAVAILABLE,
      CONSTANTS.UI.BUTTON_IDS.FIND_VIDEO_TRACKS,
      CONSTANTS.UI.BUTTON_IDS.FIND_DUPLICATE_TRACKS,
      CONSTANTS.UI.BUTTON_IDS.REPLACE_SELECTED,
      CONSTANTS.UI.BUTTON_IDS.ADD_SELECTED,
      CONSTANTS.UI.BUTTON_IDS.REMOVE_SELECTED,
      CONSTANTS.UI.BUTTON_IDS.KEEP_ONLY_SELECTED,
      CONSTANTS.UI.BUTTON_IDS.BACK_BUTTON,
      CONSTANTS.UI.BUTTON_IDS.IMPORT_FROM_FOLDER,
      CONSTANTS.UI.BUTTON_IDS.IMPORT_FROM_FILE,
      CONSTANTS.UI.BUTTON_IDS.FIND_LOCAL_REPLACEMENTS,
      CONSTANTS.UI.BUTTON_IDS.LIST_ALL_TRACKS
    ];

    buttonIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = show;
    });

    UIHelper.updateCheckAllCheckbox();
  }

  /**
   * Toggles the visibility of the target selection modal
   * @param {boolean} isVisible - Whether the target modal is visible
   */
  setTargetModalVisibility(isVisible) {
    const modal = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLIST_MODAL);
    if (modal) {
      modal.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !isVisible);
    }
  }

  /**
   * Displays playlists in the target selection modal grid
   * @param {Array} playlistsCache - Array of playlists to display
   * @param {Array} [fullCache] - Full array of all playlists for counts
   */
  displayTargetPlaylists(playlistsCache, fullCache) {
    const grid = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLISTS_GRID);
    if (!grid) return;

    grid.replaceChildren();
    this.updatePlaylistCounts(fullCache || playlistsCache);

    playlistsCache.forEach((playlist) => {
      const card = PlaylistCard.render(playlist);
      card.addEventListener('click', () => {
        this.bridge.onTargetPlaylistSelected(playlist);
      });
      grid.appendChild(card);
    });
  }

  /**
   * Toggles the visibility of the playlist selection screen vs details screen
   * @param {boolean} isInitialSelection - Whether the initial selection screen should be visible
   */
  setPlaylistScreenVisibility(isInitialSelection) {
    const detailsScreen = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_DETAILS_SCREEN);
    if (detailsScreen) detailsScreen.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, isInitialSelection);

    const selectionScreen = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_SCREEN);
    if (selectionScreen) selectionScreen.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !isInitialSelection);

    this.updateFooterVisibility(isInitialSelection);
  }

  /**
   * Updates footer elements visibility based on current view
   * @param {boolean} isSelectionView - Whether we are in playlist selection view
   */
  updateFooterVisibility(isSelectionView) {
    const selectionActions = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_ACTIONS);
    const playlistCounts = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_COUNTS);
    const selectionCount = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SELECTION_COUNT);
    const progressText = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PROGRESS_TEXT);
    const searchProgress = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SEARCH_PROGRESS);
    const cancelSearchBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.CANCEL_SEARCH);

    if (selectionActions) selectionActions.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !isSelectionView);
    if (playlistCounts) playlistCounts.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !isSelectionView);
    if (selectionCount) selectionCount.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, isSelectionView);
    
    if (isSelectionView) {
      if (progressText) progressText.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      if (searchProgress) searchProgress.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      if (cancelSearchBtn) cancelSearchBtn.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
    }
  }

  /**
   * Toggles search progress for target selection modal
   */
  toggleTargetSearchProgress(show) {
    const indicator = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLISTS_LOADING);
    if (indicator) {
      indicator.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !show);
    }
  }

  /**
   * Updates playlist counts in the footer
   * @param {Array} playlists - Loaded playlists
   */
  updatePlaylistCounts(playlists = []) {
    const totalCountEl = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TOTAL_PLAYLIST_COUNT);
    const editableCountEl = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.EDITABLE_PLAYLIST_COUNT);
    const countsContainer = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_COUNTS);

    if (totalCountEl && editableCountEl) {
      const total = playlists.length;
      const editable = playlists.filter(p => p.isEditable).length;

      totalCountEl.textContent = `${total} total`;
      editableCountEl.textContent = `${editable} editable`;
      
      if (countsContainer) {
        countsContainer.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
      }
    }
  }

  /**
   * Sets the list-only mode for the grid
   * @param {boolean} isListOnly - Whether to enable list-only mode
   */
  setListOnlyMode(isListOnly) {
    document.querySelector(`.${CONSTANTS.UI.CLASSES.ITEMS_GRID_WRAPPER}`)?.classList.toggle(CONSTANTS.UI.CLASSES.LIST_ONLY_MODE, isListOnly);
    
    if (isListOnly) {
      this.updateActionButtonsVisibility({
        replace: false,
        add: false,
        remove: true
      });
    }
  }

  /**
   * Sets the duplicate track mode for the grid
   * @param {boolean} isDuplicateMode - Whether to enable duplicate mode
   */
  setDuplicateTrackMode(isDuplicateMode) {
    document.querySelector(`.${CONSTANTS.UI.CLASSES.ITEMS_GRID_WRAPPER}`)?.classList.toggle(CONSTANTS.UI.CLASSES.DUPLICATE_TRACK_MODE, isDuplicateMode);
  }

  /**
   * Updates the visibility of the target playlist container
   * @param {boolean} isVisible 
   */
  setTargetContainerVisibility(isVisible) {
    document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLIST_CONTAINER)?.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !isVisible);
  }

  /**
   * Updates visibility of bulk action buttons
   * @param {Object} options - { replace, add, remove, keep } visibility flags
   */
  updateActionButtonsVisibility(options = {}) {
    const replaceBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.REPLACE_SELECTED);
    const removeBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.REMOVE_SELECTED);
    const addBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.ADD_SELECTED);
    const keepBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.KEEP_ONLY_SELECTED);

    if (replaceBtn && options.replace !== undefined) replaceBtn.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !options.replace);
    if (removeBtn && options.remove !== undefined) removeBtn.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !options.remove);
    if (addBtn && options.add !== undefined) addBtn.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !options.add);
    if (keepBtn && options.keep !== undefined) keepBtn.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !options.keep);
  }

  /**
   * Resets action buttons visibility for a newly selected playlist
   * @param {Object} playlist - The selected playlist object
   */
  resetActionButtonsForPlaylist(playlist) {
    const isEditable = playlist?.isEditable !== false;

    this.setTargetContainerVisibility(false);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_LOCAL_REPLACEMENTS)?.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_UNAVAILABLE)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_VIDEO_TRACKS)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_DUPLICATE_TRACKS)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.IMPORT_FROM_FOLDER)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.IMPORT_FROM_FILE)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.LIST_ALL_TRACKS)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    
    this.updateActionButtonsVisibility({
      replace: isEditable,
      remove: isEditable,
      add: isEditable,
      keep: false
    });
  }

  /**
   * Updates visibility of buttons for local import feature
   * @param {Object} playlist - The selected playlist object
   */
  updateImportButtonVisibility(playlist) {
    const isEditable = playlist?.isEditable !== false;

    this.setTargetContainerVisibility(true);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_LOCAL_REPLACEMENTS)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_UNAVAILABLE)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_VIDEO_TRACKS)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.IMPORT_FROM_FOLDER)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.IMPORT_FROM_FILE)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    document.getElementById(CONSTANTS.UI.BUTTON_IDS.LIST_ALL_TRACKS)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    
    this.updateActionButtonsVisibility({
      replace: false,
      remove: false,
      add: isEditable
    });
  }

  /**
   * Initializes search box event listeners
   */
  initSearchBox() {
    const searchInput = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SEARCH_INPUT);
    const clearBtn = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.CLEAR_SEARCH_BTN);

    if (!searchInput || !clearBtn) return;
    if (searchInput.dataset.initialized) return;
    searchInput.dataset.initialized = 'true';

    const debouncedSearch = BrowserUtils.debounce((e) => this.filterGridItems(e.target.value), CONSTANTS.UI.DEBOUNCE_DELAY_MS);
    
    searchInput.addEventListener('input', (e) => {
      debouncedSearch(e);
      clearBtn.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !e.target.value);
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      this.filterGridItems('');
      searchInput.focus();
    });
  }

  /**
   * Filters grid items based on search query
   */
  filterGridItems(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
    if (!container) return;

    const rows = container.querySelectorAll(`.${CONSTANTS.UI.CLASSES.GRID_ROW}`);
    
    if (!normalizedQuery) {
      rows.forEach(row => row.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN));
    } else {
      rows.forEach(row => {
        const searchString = row.dataset.searchString || '';
        row.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !searchString.includes(normalizedQuery));
      });
    }

    UIHelper.updateCheckAllCheckbox();
  }

  /**
   * Hides playlist loading indicator
   */
  hidePlaylistLoadingIndicator() {
    const loadingIndicator = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLISTS_LOADING_INDICATOR);
    if (loadingIndicator) {
      loadingIndicator.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
    }
  }

  /**
   * Displays playlists in the selection grid
   * @param {Array} playlistsCache - Array of playlists to display
   * @param {Array} [fullCache] - Full array of all playlists for counts
   */
  displayPlaylistsForSelection(playlistsCache, fullCache) {
    const playlistsGrid = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLISTS_GRID);
    if (!playlistsGrid) return;

    playlistsGrid.replaceChildren();
    this.updatePlaylistCounts(fullCache || playlistsCache);

    if (playlistsCache.length === 0) {
      const noPlaylistsMessage = UIHelper.createNoPlaylistsMessage();
      playlistsGrid.appendChild(noPlaylistsMessage);
      return;
    }

    playlistsCache.forEach((playlist) => {
      const card = PlaylistCard.render(playlist);
      card.addEventListener('click', () => {
        if (this.bridge.isSelectingTarget) {
          this.bridge.onTargetPlaylistSelected(playlist);
        } else {
          this.bridge.onPlaylistSelected(playlist);
        }
      });
      playlistsGrid.appendChild(card);
    });

    // Ensure footer actions and counts are visible when selection screen is active
    const selectionScreen = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_SCREEN);
    const isVisible = selectionScreen && !selectionScreen.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN);
    if (isVisible) {
      document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_ACTIONS)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
      document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_COUNTS)?.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
    }
  }

  /**
   * Updates the target playlist display
   * @param {Object} playlist - The target playlist
   */
  updateTargetPlaylistDisplay(playlist) {
    const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLIST_CONTAINER);
    const nameElement = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLIST_NAME);
    
    if (container && nameElement) {
      if (playlist) {
        nameElement.textContent = playlist.title;
        container.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
      } else {
        container.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
      }
    }
  }

  /**
   * Updates the popup title
   */
  updatePopupTitle(title) {
    const titleElement = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_TITLE);
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  /**
   * Shows or hides trigger buttons
   */
  showTriggerButtons(extSettings) {
    const navBarBtn = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.NAV_BTN);
    if (navBarBtn) {
      const shouldShow = !extSettings || extSettings.showNavButton !== false;
      navBarBtn.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !shouldShow);
    }

    const actionBtn = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ACTION_BUTTONS);
    if (actionBtn) {
      const shouldShow = !extSettings || extSettings.showPlaylistButton !== false;
      actionBtn.classList.toggle(CONSTANTS.UI.CLASSES.HIDDEN, !shouldShow);
    }
  }

  /**
   * Injects action buttons into the YouTube Music page header
   */
  injectActionButtons(extSettings) {
    if (extSettings?.showPlaylistButton === false) return;

    const existingButtons = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ACTION_BUTTONS);
    if (existingButtons) return;

    const header = document.querySelector(CONSTANTS.UI.SELECTORS.YT_MUSIC_HEADER);
    if (!header) return;

    const actionButtons = UIHelper.createActionButtons();
    actionButtons.addEventListener('click', () => this.bridge.showPopup());

    header.appendChild(actionButtons);
  }

  /**
   * Initializes the playlist refresh buttons
   */
  initRefreshButton() {
    const refreshBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.REFRESH_PLAYLISTS);
    if (refreshBtn && !refreshBtn.dataset.initialized) {
      refreshBtn.dataset.initialized = 'true';
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        const originalText = refreshBtn.textContent;
        refreshBtn.textContent = 'Loading...';
        await this.bridge.initPlaylistFetching(true, true);
        refreshBtn.disabled = false;
        refreshBtn.textContent = originalText;
      });
    }

    const loadAllBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.LOAD_ALL_PLAYLISTS);
    if (loadAllBtn && !loadAllBtn.dataset.initialized) {
      loadAllBtn.dataset.initialized = 'true';
      loadAllBtn.addEventListener('click', async () => {
        loadAllBtn.disabled = true;
        const originalText = loadAllBtn.textContent;
        loadAllBtn.textContent = 'Loading...';
        await this.bridge.initPlaylistFetching(true, false);
        loadAllBtn.disabled = false;
        loadAllBtn.textContent = originalText;
      });
    }
  }
}
