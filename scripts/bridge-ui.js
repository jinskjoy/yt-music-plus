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
  }

  /**
   * Sets progress text in the UI
   * @param {string} text - Progress text
   */
  setProgressText(text) {
    const el = document.getElementById('progressText');
    if (el) {
      el.textContent = text;
      el.classList.toggle('hidden', !text);
      
      const footer = document.getElementById('ytMusicPlusSelectionFooter');
      if (footer && text) {
        footer.classList.remove('hidden');
      }
    }
  }

  /**
   * Clears the playlist items container
   */
  clearPlaylistItemsContainer() {
    this.rowMap.clear();
    const container = document.getElementById('yt-music-plus-itemsGridContainer');
    if (container) {
      container.replaceChildren();
    }
    document.querySelector('.items-grid-wrapper')?.classList.remove('list-only-mode');

    document.getElementById('replaceSelectedBtn')?.classList.remove('hidden');
    document.getElementById('addSelectedBtn')?.classList.remove('hidden');
    document.getElementById('removeSelectedBtn')?.classList.remove('hidden');
  }

  /**
   * Adds an item row to the display
   */
  addItem(item, baseUrl, index) {
    const { originalMedia, replacementMedia } = this.bridge._createMediaObjects(item, baseUrl);

    const gridRow = MediaGridRow.render(originalMedia, replacementMedia, index, this.bridge.playerHandler);
    document.getElementById('yt-music-plus-itemsGridContainer')?.appendChild(gridRow);
    this.rowMap.set(index, gridRow);
  }

  /**
   * Updates an existing item row
   */
  updateItemRow(item, baseUrl, index) {
    const oldRow = this.rowMap.get(index);
    if (oldRow) {
      const oldCheckbox = oldRow.querySelector('.item-checkbox');
      const userInteracted = oldCheckbox?.dataset.userInteracted === 'true';
      const wasChecked = oldCheckbox ? oldCheckbox.checked : false;

      const { originalMedia, replacementMedia } = this.bridge._createMediaObjects(item, baseUrl);
      const newRow = MediaGridRow.render(originalMedia, replacementMedia, index, this.bridge.playerHandler);
      
      const newCheckbox = newRow.querySelector('.item-checkbox');
      if (newCheckbox && oldCheckbox && userInteracted) {
        newCheckbox.checked = wasChecked;
        newCheckbox.dataset.userInteracted = 'true';
      }

      const searchInput = document.getElementById('ytMusicPlusSearchInput');
      if (searchInput && searchInput.value) {
        const normalizedQuery = searchInput.value.toLowerCase().trim();
        const searchString = newRow.dataset.searchString || '';
        newRow.classList.toggle('hidden', !searchString.includes(normalizedQuery));
      }
      oldRow.parentNode?.replaceChild(newRow, oldRow);
      this.rowMap.set(index, newRow);
    }
  }

  /**
   * Toggles search progress indicators
   */
  toggleSearchProgress(show, isSearch = false) {
    const el = document.getElementById('searchProgress');
    if (el) {
      el.classList.toggle('hidden', !show);
    }

    const cancelBtn = document.getElementById('cancelSearchBtn');
    if (cancelBtn) {
      cancelBtn.classList.toggle('hidden', !(show && isSearch));
    }

    // Disable/enable buttons during search
    const buttonIds = [
      'findUnavailableBtn',
      'findVideoTracksBtn',
      'replaceSelectedBtn',
      'addSelectedBtn',
      'removeSelectedBtn',
      'backButton',
      'importFromFolderBtn',
      'importFromFileBtn',
      'findLocalReplacementsBtn',
      'listAllTracksBtn'
    ];

    buttonIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = show;
    });

    UIHelper.updateCheckAllCheckbox();
  }

  /**
   * Initializes search box event listeners
   */
  initSearchBox() {
    const searchInput = document.getElementById('ytMusicPlusSearchInput');
    const clearBtn = document.getElementById('ytMusicPlusClearSearchBtn');

    if (!searchInput || !clearBtn) return;
    if (searchInput.dataset.initialized) return;
    searchInput.dataset.initialized = 'true';

    const debouncedSearch = BrowserUtils.debounce((e) => this.filterGridItems(e.target.value), CONSTANTS.UI.DEBOUNCE_DELAY_MS);
    
    searchInput.addEventListener('input', (e) => {
      debouncedSearch(e);
      clearBtn.classList.toggle('hidden', !e.target.value);
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.classList.add('hidden');
      this.filterGridItems('');
      searchInput.focus();
    });
  }

  /**
   * Filters grid items based on search query
   */
  filterGridItems(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const container = document.getElementById('yt-music-plus-itemsGridContainer');
    if (!container) return;

    const rows = container.querySelectorAll('.grid-row');
    
    if (!normalizedQuery) {
      rows.forEach(row => row.classList.remove('hidden'));
    } else {
      rows.forEach(row => {
        const searchString = row.dataset.searchString || '';
        row.classList.toggle('hidden', !searchString.includes(normalizedQuery));
      });
    }

    UIHelper.updateCheckAllCheckbox();
  }

  /**
   * Hides playlist loading indicator
   */
  hidePlaylistLoadingIndicator() {
    const loadingIndicator = document.getElementById('playlistsLoadingIndicator');
    if (loadingIndicator) {
      loadingIndicator.classList.add('hidden');
    }
  }

  /**
   * Displays playlists in the selection grid
   */
  displayPlaylistsForSelection(playlistsCache) {
    const playlistsGrid = document.getElementById('playlistsGrid');
    if (!playlistsGrid) return;

    playlistsGrid.replaceChildren();

    if (playlistsCache.length === 0) {
      const noPlaylistsMessage = UIHelper.createNoPlaylistsMessage();
      playlistsGrid.appendChild(noPlaylistsMessage);
      return;
    }

    playlistsCache.forEach((playlist) => {
      const card = PlaylistCard.render(playlist);
      card.addEventListener('click', () => this.bridge.onPlaylistSelected(playlist));
      playlistsGrid.appendChild(card);
    });
  }

  /**
   * Updates the popup title
   */
  updatePopupTitle(title) {
    const titleElement = document.getElementById('popupTitle');
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  /**
   * Shows or hides trigger buttons
   */
  showTriggerButtons(extSettings) {
    const navBarBtn = document.getElementById('yt-music-plus-nav-btn');
    if (navBarBtn) {
      const shouldShow = !extSettings || extSettings.showNavButton !== false;
      navBarBtn.classList.toggle('hidden', !shouldShow);
    }

    const actionBtn = document.getElementById('yt-music-plus-action-buttons');
    if (actionBtn) {
      const shouldShow = !extSettings || extSettings.showPlaylistButton !== false;
      actionBtn.classList.toggle('hidden', !shouldShow);
    }
  }

  /**
   * Injects action buttons into the YouTube Music page header
   */
  injectActionButtons(extSettings) {
    if (extSettings?.showPlaylistButton === false) return;

    const existingButtons = document.getElementById('yt-music-plus-action-buttons');
    if (existingButtons) return;

    const header = document.querySelector('ytmusic-responsive-header-renderer');
    if (!header) return;

    const actionButtons = UIHelper.createActionButtons();
    actionButtons.addEventListener('click', () => this.bridge.showPopup());

    header.appendChild(actionButtons);
  }

  /**
   * Initializes the playlist refresh buttons
   */
  initRefreshButton() {
    const refreshBtn = document.getElementById('refreshPlaylistsBtn');
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

    const loadAllBtn = document.getElementById('loadAllPlaylistsBtn');
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
