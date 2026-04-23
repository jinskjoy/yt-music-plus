/**
 * Bridge Script - Runs in page context to access YouTube Music APIs
 * Extracts authentication tokens and provides methods for playlist manipulation
 * Communicates with content script via window.postMessage
 */

import { YTMusicAPI } from './yt-music-api.js';
import { UIHelper } from '../utils/ui-helper.js';

(function () {
  /**
   * Intercepts authorization tokens from XMLHttpRequest and Fetch API calls
   */
  function fetchAuthToken() {
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    // Intercept XMLHttpRequest headers
    XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
      if (window.bridgeInstance?.ytMusicAPI.isAuthTokenSet()) {
        XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
        return originalSetRequestHeader.apply(this, arguments);
      }

      if (header.toLowerCase() === 'authorization') {
        window.bridgeInstance?.setAuthToken(value);
        XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
      }

      return originalSetRequestHeader.apply(this, arguments);
    };

    // Intercept Fetch API headers
    const { fetch: originalFetch } = window;

    window.fetch = async (...args) => {
      if (window.bridgeInstance?.ytMusicAPI.isAuthTokenSet()) {
        window.fetch = originalFetch;
        return originalFetch(...args);
      }

      try {
        const request = args[0];
        const headers = request?.headers;

        if (headers && request?.url?.includes('music.youtube.com')) {
          let authToken = null;

          // Handle both Headers instance and plain object
          if (headers instanceof Headers) {
            authToken = headers.get('Authorization');
          } else {
            authToken = headers['Authorization'] || headers['authorization'];
          }

          if (authToken) {
            window.bridgeInstance?.setAuthToken(authToken);
            window.fetch = originalFetch;
          }
        }

        return originalFetch(...args);
      } catch (error) {
        return originalFetch(...args);
      }
    };
  }

  /**
   * Bridge Class - Main controller for playlist operations
   */
  class Bridge {
    // Constants
    static TIMEOUT_DURATION = 100;
    static PAGE_LOAD_TIMEOUT = 3000;
    static BASE_URL = 'https://music.youtube.com/watch?v=';
    static PLAYLIST_PAGE_PATH = 'https://music.youtube.com/playlist';

    constructor() {
      this.ytMusicAPI = new YTMusicAPI();
      this.currentSelectedPlaylist = null;
      this.playlistsCache = [];
      this.isReloadDisabled = false;
      this.isFetchingPlaylists = false;
      this.localTracks = [];
      this.extSettings = {
        showPlaylistButton: true,
        showNavButton: true
      };
      this.cancelSearch = false;
      this.preventUnloadListener = (e) => {
        if (this.isReloadDisabled) {
          e.preventDefault();
          e.returnValue = '';
        }
      };
    }

    /**
     * Sleep utility for delays
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * Disables page reload during API operations
     */
    disableReload() {
      if (this.isReloadDisabled) return;
      this.isReloadDisabled = true;
      window.addEventListener('beforeunload', this.preventUnloadListener);
    }

    /**
     * Enables page reload after API operations
     * @param {boolean} shouldReload - Whether to reload the page
     */
    enableReload(shouldReload = false) {
      if (!this.isReloadDisabled) return;
      this.isReloadDisabled = false;
      window.removeEventListener('beforeunload', this.preventUnloadListener);

      if (shouldReload) {
        window.location.reload();
      }
    }

    /**
     * Sets authentication token and initializes UI elements
     * @param {string} token - Authorization token
     */
    setAuthToken(token) {
      this.ytMusicAPI.setAuthToken(token);
      this.addEventListeners();
      this.injectActionButtons();
      this.showTriggerButtons();
    }

    /**
     * Injects action buttons into the YouTube Music page header
     */
    injectActionButtons() {
      if (this.extSettings?.showPlaylistButton === false) {
        return;
      }

      const existingButtons = document.getElementById('yt-music-plus-action-buttons');
      if (existingButtons) {
        return;
      }

      const header = document.querySelector('ytmusic-responsive-header-renderer');
      if (!header) {
        return;
      }

      const actionButtons = UIHelper.createActionButtons();
      actionButtons.addEventListener('click', () => this.showPopup());

      header.appendChild(actionButtons);
    }

    /**
     * Shows or hides trigger buttons based on settings
     */
    showTriggerButtons() {
      const navBarBtn = document.getElementById('yt-music-plus-nav-btn');
      if (navBarBtn) {
        const shouldShow = !this.extSettings || this.extSettings.showNavButton !== false;
        navBarBtn.classList.toggle('hidden', !shouldShow);
      }

      const actionBtn = document.getElementById('yt-music-plus-action-buttons');
      if (actionBtn) {
        const shouldShow = !this.extSettings || this.extSettings.showPlaylistButton !== false;
        actionBtn.classList.toggle('hidden', !shouldShow);
      }
    }

    /**
     * Shows popup and loads playlist data
     * @async
     */
    async showPopup() {
      const popupElement = document.getElementById('yt-music-plus-popup');
      if (popupElement) {
        popupElement.classList.remove('hidden');
      }

      await this.initPlaylistFetching();

      const currentPlaylistId = this.ytMusicAPI.getCurrentPlaylistIdFromURL();
      if (currentPlaylistId) {
        const playlistFromCache = this.playlistsCache.find(pl => pl.id === currentPlaylistId);
        if (playlistFromCache) {
          this.onPlaylistSelected(playlistFromCache);
        }
      }
    }

    /**
     * Hides popup and re-enables page reload
     */
    hidePopup() {
      const popupElement = document.getElementById('yt-music-plus-popup');
      if (popupElement) {
        popupElement.classList.add('hidden');
      }
      this.enableReload();
    }

    /**
     * Adds event listeners for popup buttons and navigation
     */
    addEventListeners() {
      // Navigation listener for playlist page detection
      navigation?.addEventListener('navigate', (event) => {
        if (event.navigationType !== 'push') return;

        const isPlaylistPage = event.destination?.url?.startsWith(Bridge.PLAYLIST_PAGE_PATH);
        if (isPlaylistPage) {
          setTimeout(() => {
            if (!this.extSettings || this.extSettings.showPlaylistButton !== false) {
              this.injectActionButtons();
              this.showTriggerButtons();
            }
          }, Bridge.PAGE_LOAD_TIMEOUT);
        }
      });

      // Nav bar button listener
      const navBarBtn = document.getElementById('yt-music-plus-nav-btn');
      if (navBarBtn) {
        navBarBtn.addEventListener('click', () => this.showPopup());
      }

      // Popup close listeners
      const popupElement = document.getElementById('yt-music-plus-popup');
      const closeBtn = popupElement?.querySelector('#closePopupBtn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.hidePopup());

        popupElement?.addEventListener('click', (event) => {
          if (event.target === popupElement) {
            this.hidePopup();
          }
        });

        // Escape key handler
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !popupElement?.classList.contains('hidden')) {
            this.hidePopup();
          }
        });
      }

      // Action button listeners
      this.attachButtonListener('findUnavailableBtn', () => this.findUnavailableTracks());
      this.attachButtonListener('findVideoTracksBtn', () => this.findVideoTracks());
      this.attachButtonListener('replaceSelectedBtn', () => this.replaceSelectedItems());
      this.attachButtonListener('addSelectedBtn', () => this.addSelectedItems());
      this.attachButtonListener('removeSelectedBtn', () => this.removeSelectedItems());
      this.attachButtonListener('importFromFolderBtn', () => this.importFromFolder());
      this.attachButtonListener('findLocalReplacementsBtn', () => this.findReplacementsForLocalTracks());
      this.attachButtonListener('listAllTracksBtn', () => this.listAllTracks());
      this.attachButtonListener('importFromFileBtn', () => {
        document.getElementById('importFileInput')?.click();
      });

      const fileInput = document.getElementById('importFileInput');
      if (fileInput) {
        fileInput.addEventListener('change', (e) => this.importFromFile(e));
      }

      this.attachButtonListener('cancelSearchBtn', () => {
        this.cancelSearch = true;
        this.setProgressText('Cancelling search... Please wait.');
      });

      const cancelBtn = document.getElementById('cancelSearchBtn');
      if (cancelBtn) {
        cancelBtn.classList.remove('btn-secondary', 'btn-danger');
        cancelBtn.classList.add('btn-primary');
      }
    }

    /**
     * Helper to attach click listeners to buttons
     * @param {string} buttonId - Button element ID
     * @param {Function} handler - Click handler
     */
    attachButtonListener(buttonId, handler) {
      const button = document.getElementById(buttonId);
      if (button) {
        button.addEventListener('click', handler);
      }
    }

    /**
     * Toggles search progress indicator visibility
     * @param {boolean} show - Whether to show the indicator
     * @param {boolean} isSearch - Whether the operation is an active search
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

      this.updateCheckAllCheckbox();
    }

    /**
     * Updates select-all checkbox state
     */
    updateCheckAllCheckbox() {
      const popupElement = document.querySelector('.yt-music-extended-popup-container');
      if (!popupElement) return;

      const selectAllCheckbox = popupElement.querySelector('#yt-music-plus-selectAllCheckbox');
      const checkboxes = popupElement.querySelectorAll('.item-checkbox:not([disabled])');
      const allCheckboxes = popupElement.querySelectorAll('.item-checkbox');

      if (selectAllCheckbox) {
        selectAllCheckbox.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
      }

      const anyChecked = Array.from(allCheckboxes).some(cb => cb.checked);
      const anyCheckedWithReplacement = Array.from(allCheckboxes).some(cb => {
        if (!cb.checked) return false;
        const row = cb.closest('.grid-row');
        if (!row) return false;
        const replacement = JSON.parse(row.dataset.replacementMedia || '{}');
        return !!replacement.videoId;
      });

      const isListOnlyMode = popupElement.querySelector('.items-grid-wrapper')?.classList.contains('list-only-mode');

      const removeBtn = popupElement.querySelector('#removeSelectedBtn');
      if (removeBtn) removeBtn.disabled = !anyChecked;

      const addBtn = popupElement.querySelector('#addSelectedBtn');
      if (addBtn) addBtn.disabled = isListOnlyMode ? true : !anyCheckedWithReplacement;

      const replaceBtn = popupElement.querySelector('#replaceSelectedBtn');
      if (replaceBtn) replaceBtn.disabled = isListOnlyMode ? true : !anyCheckedWithReplacement;
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
     * Initializes playlist fetching and display
     * @async
     */
    async initPlaylistFetching(forceRefresh = false) {
      if (this.isFetchingPlaylists) return;

      // Use cached playlists if available and not forcing a refresh
      if (!forceRefresh && this.playlistsCache && this.playlistsCache.length > 0) {
        this.displayPlaylistsForSelection();
        this.hidePlaylistLoadingIndicator();
        this.injectRefreshButton();
        return;
      }

      this.isFetchingPlaylists = true;

      const loadingIndicator = document.getElementById('playlistsLoadingIndicator');
      if (loadingIndicator) loadingIndicator.classList.remove('hidden');
      
      const playlistsGrid = document.getElementById('playlistsGrid');
      if (playlistsGrid) playlistsGrid.replaceChildren();

      try {
        let playlists = await this.ytMusicAPI.getEditablePlaylists();
        
        // Retry once if no playlists found (handles ytcfg initialization race condition)
        if (playlists.length === 0) {
          await this.sleep(1000);
          playlists = await this.ytMusicAPI.getEditablePlaylists();
        }
        
        this.playlistsCache = playlists;
      } catch (error) {
        console.error('YouTube Music +: Error fetching playlists', error);
        this.playlistsCache = [];
      } finally {
        this.displayPlaylistsForSelection();
        this.hidePlaylistLoadingIndicator();
        this.injectRefreshButton();
        this.isFetchingPlaylists = false;
      }
    }

    /**
     * Injects a refresh button into the playlist selection screen
     */
    injectRefreshButton() {
      const selectionScreen = document.getElementById('playlistSelectionScreen');
      if (selectionScreen && !document.getElementById('refreshPlaylistsBtn')) {
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'flex-end';
        btnContainer.style.marginBottom = '12px';

        const btn = document.createElement('button');
        btn.id = 'refreshPlaylistsBtn';
        btn.className = 'btn btn-primary';
        btn.textContent = 'Refresh Playlists';
        
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.textContent = 'Refreshing...';
          await this.initPlaylistFetching(true);
          
          btn.disabled = false;
          btn.textContent = 'Refresh Playlists';
        });

        btnContainer.appendChild(btn);
        selectionScreen.insertBefore(btnContainer, selectionScreen.firstChild);
      }
    }

    /**
     * Displays playlists in the selection grid
     */
    displayPlaylistsForSelection() {
      const playlistsGrid = document.getElementById('playlistsGrid');
      if (!playlistsGrid) {
        return;
      }

      playlistsGrid.replaceChildren();

      if (this.playlistsCache.length === 0) {
        const noPlaylistsMessage = UIHelper.createNoPlaylistsMessage();
        playlistsGrid.appendChild(noPlaylistsMessage);
        return;
      }

      this.playlistsCache.forEach((playlist) => {
        const card = UIHelper.createPlaylistCard(playlist);
        card.addEventListener('click', () => this.onPlaylistSelected(playlist));
        playlistsGrid.appendChild(card);
      });
    }

    /**
     * Handles playlist selection
     * @param {Object} playlist - Selected playlist object
     */
    onPlaylistSelected(playlist) {
      UIHelper.setPlaylistDetails(playlist);

      if (!this.currentSelectedPlaylist || this.currentSelectedPlaylist.id !== playlist.id) {
        this.clearPlaylistItemsContainer();
        this.currentSelectedPlaylist = playlist;
        this.setProgressText('');
      }

      const detailsScreen = document.getElementById('playlistDetailsScreen');
      if (detailsScreen) {
        detailsScreen.classList.remove('hidden');
      }

      const selectionScreen = document.getElementById('playlistSelectionScreen');
      if (selectionScreen) {
        selectionScreen.classList.add('hidden');
      }

      // Reset button visibility for local import feature
      document.getElementById('findLocalReplacementsBtn')?.classList.add('hidden');
      document.getElementById('findUnavailableBtn')?.classList.remove('hidden');
      document.getElementById('findVideoTracksBtn')?.classList.remove('hidden');
      document.getElementById('importFromFolderBtn')?.classList.remove('hidden');
      document.getElementById('importFromFileBtn')?.classList.remove('hidden');
      document.getElementById('listAllTracksBtn')?.classList.remove('hidden');
      
      // Ensure action buttons are visible for normal playlists
      document.getElementById('replaceSelectedBtn')?.classList.remove('hidden');
      document.getElementById('removeSelectedBtn')?.classList.remove('hidden');
      document.getElementById('addSelectedBtn')?.classList.remove('hidden');

      // Reset expanded grid state
      UIHelper.toggleGrid(false);

      this.localTracks = [];

      this.updatePopupTitle(`Playlist: ${playlist.title}`);
    }

    /**
     * Updates the popup title
     * @param {string} title - New title text
     */
    updatePopupTitle(title) {
      const titleElement = document.getElementById('popupTitle');
      if (titleElement) {
        titleElement.textContent = title;
      }
    }

    /**
     * Processes playlist items and finds replacements for unavailable tracks
     * @async
     * @param {Array} items - Playlist items to process
     */
    async processPlaylistItems(items) {
      this.cancelSearch = false;
      const itemsToProcess = items;
      this.clearPlaylistItemsContainer();

      let i = 1;
      for (const item of itemsToProcess) {
        if (!item.isLocal) {
          item.isSearching = !item.isGeneric;
        }
        item.searchCancelled = false;
        item.replacement = null;
        this.addItem(item, Bridge.BASE_URL, i++);
      }

      i = 1;
      for (const item of itemsToProcess) {
        if (item.isGeneric || item.isSkipped) {
          i++;
          continue;
        }

        if (this.cancelSearch) {
          this.setProgressText('Search cancelled.');
          break;
        }

        this.setProgressText(`Processing track ${i} of ${itemsToProcess.length}`);

        try {
          const searchResult = await this.ytMusicAPI.searchMusic(item);
          const bestSearchResult = this.ytMusicAPI.getBestSearchResult(searchResult, item);
          item.replacement = bestSearchResult;
        } catch (error) {
          // Skip items that fail to process
          item.replacement = null;
        }
        
        item.isSearching = false;
        this.updateItemRow(item, Bridge.BASE_URL, i++);

        await this.sleep(Bridge.TIMEOUT_DURATION);
      }
      
      if (this.cancelSearch) {
        for (let j = i; j <= itemsToProcess.length; j++) {
          if (!itemsToProcess[j - 1].isGeneric && !itemsToProcess[j - 1].isSkipped) {
            itemsToProcess[j - 1].isSearching = false;
            itemsToProcess[j - 1].searchCancelled = true;
            this.updateItemRow(itemsToProcess[j - 1], Bridge.BASE_URL, j);
          }
        }
      }

      this.setFinalProgressText(itemsToProcess);
      this.updateCheckAllCheckbox();
    }

    /**
     * Sets final progress message after processing
     * @param {Array} processedItems - Processed items
     */
    setFinalProgressText(processedItems) {
      if (processedItems.length === 0) {
        this.setProgressText('Processing complete. No items were processed.');
        return;
      }

      const searchedItems = processedItems.filter(item => !item.isSearching && !item.searchCancelled && !item.isGeneric && !item.isSkipped);
      const isLocalImport = processedItems.some(item => item.isLocal);
      let foundCountText;

      if (isLocalImport) {
        const replacedCount = searchedItems.filter(item => item.replacement).length;
        foundCountText = `Found replacements for ${replacedCount} of ${searchedItems.length} searched tracks.`;
      } else {
        foundCountText = `Found ${searchedItems.length} unavailable tracks and their replacements.`;
      }

      let progressText = this.cancelSearch ? `Search cancelled. ${foundCountText}` : `Processing complete. ${foundCountText}`;
      const hasBadMatches = searchedItems.some(item => item.replacement && !item.replacement.isGoodMatch);

      if (hasBadMatches) {
        progressText += ' Some replacements may not be good matches, please review carefully.';
      }

      this.setProgressText(progressText);
      if (!(isLocalImport && this.cancelSearch)) {
        document.getElementById('findLocalReplacementsBtn')?.classList.add('hidden');
      } else {
        document.getElementById('findLocalReplacementsBtn')?.classList.remove('hidden');
      }
    }

    /**
     * Clears the playlist items container
     */
    clearPlaylistItemsContainer() {
      const container = document.getElementById('yt-music-plus-itemsGridContainer');
      if (container) {
        container.replaceChildren();
      }
      document.querySelector('.items-grid-wrapper')?.classList.remove('list-only-mode');
    }

    /**
     * Creates original and replacement media objects appropriately formatted for UI
     * @param {Object} item - Item
     * @param {string} baseUrl - Base URL for video links
     * @returns {Object} { originalMedia, replacementMedia }
     */
    _createMediaObjects(item, baseUrl) {
      const originalMedia = {
        name: item.name,
        artist: item.artists?.join(', ') || '',
        thumbnail: item.thumbnail,
        url: item.videoId ? baseUrl + item.videoId : null,
        videoId: item.videoId,
        playlistSetVideoId: item.playlistSetVideoId
      };

      let replacementMedia = null;
      if (item.isGeneric) {
        replacementMedia = { name: 'Ignored (Generic Name)' };
      } else if (item.isSkipped) {
        replacementMedia = { name: 'Ignored (Not Selected)' };
      } else if (item.isSearching) {
        replacementMedia = { name: 'Waiting for search...', isPending: true, isChecked: true };
      } else if (item.searchCancelled) {
        replacementMedia = { name: 'Search cancelled', isCancelled: true };
      } else if (item.replacement) {
        replacementMedia = {
          name: item.replacement.name,
          artist: item.replacement.artists?.join(', ') || '',
          thumbnail: item.replacement.thumbnail,
          url: baseUrl + item.replacement.videoId,
          isGoodMatch: item.replacement.isGoodMatch,
          videoId: item.replacement.videoId,
          playlistSetVideoId: item.replacement.playlistSetVideoId
        };
      }

      return { originalMedia, replacementMedia };
    }

    /**
     * Adds an item row to the display
     * @param {Object} item - Item to add
     * @param {string} baseUrl - Base URL for video links
     * @param {number} index - Item index
     * @returns {number} Next index
     */
    addItem(item, baseUrl, index) {
      const { originalMedia, replacementMedia } = this._createMediaObjects(item, baseUrl);

      const gridRow = UIHelper.createMediaGridRow(originalMedia, replacementMedia, index);
      document.getElementById('yt-music-plus-itemsGridContainer')?.appendChild(gridRow);

      return index + 1;
    }

    /**
     * Replaces an existing item row with an updated search state
     * @param {Object} item - Updated item
     * @param {string} baseUrl - Base URL
     * @param {number} index - Row index corresponding to item
     */
    updateItemRow(item, baseUrl, index) {
      const container = document.getElementById('yt-music-plus-itemsGridContainer');
      const oldRow = container?.querySelector(`.grid-row[data-serial-number="${index}"]`);
      if (oldRow) {
        const { originalMedia, replacementMedia } = this._createMediaObjects(item, baseUrl);
        const newRow = UIHelper.createMediaGridRow(originalMedia, replacementMedia, index);
        container.replaceChild(newRow, oldRow);
      }
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
      }
    }

    /**
     * Finds and processes unavailable tracks in the playlist
     * @async
     */
    async findUnavailableTracks() {
      this.cancelSearch = false;
      this.clearPlaylistItemsContainer();
      this.toggleSearchProgress(true, true);
      this.setProgressText('Finding unavailable tracks...');

      try {
        const currentPlaylistId = this.currentSelectedPlaylist?.id || 
                                  this.ytMusicAPI.getCurrentPlaylistIdFromURL();

        if (!currentPlaylistId) {
          return;
        }

        const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
        const unavailableItems = items.filter(item => item.isGreyedOut);

        this.setProgressText(`Found ${unavailableItems.length} unavailable tracks. Fetching replacements...`);

        if (unavailableItems.length === 0) {
          return;
        }

        await this.processPlaylistItems(unavailableItems);
      } catch (error) {
        this.setProgressText('Error occurred while finding unavailable tracks.');
      } finally {
        this.toggleSearchProgress(false);
      }
    }

    /**
     * Finds and processes video tracks in the playlist
     * @async
     */
    async findVideoTracks() {
      this.cancelSearch = false;
      this.clearPlaylistItemsContainer();
      this.toggleSearchProgress(true, true);
      this.setProgressText('Finding video tracks...');

      try {
        const currentPlaylistId = this.currentSelectedPlaylist?.id || 
                                  this.ytMusicAPI.getCurrentPlaylistIdFromURL();

        if (!currentPlaylistId) {
          return;
        }

        const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
        const videoTracks = items.filter(item => item.isVideo);

        this.setProgressText(`Found ${videoTracks.length} video tracks. Fetching replacements...`);

        if (videoTracks.length === 0) {
          return;
        }

        let i = 1;
        for (const track of videoTracks) {
          // Clean track name by removing video-specific keywords
          track.name = track.name.replaceAll(/(official\s*)?(music\s*)?video/gi, '').trim();
          track.isSearching = true;
          track.searchCancelled = false;
          track.replacement = null;
          this.addItem(track, Bridge.BASE_URL, i++);
        }

        i = 1;
        for (const track of videoTracks) {
          if (this.cancelSearch) {
            this.setProgressText('Search cancelled.');
            break;
          }

          try {
            const searchResult = await this.ytMusicAPI.searchMusic(track);
            const replacement = this.ytMusicAPI.getBestSearchResult(searchResult, track);
            track.replacement = replacement;
          } catch (error) {
            // Skip tracks that fail to process
            track.replacement = null;
          }
          
          track.isSearching = false;
          this.updateItemRow(track, Bridge.BASE_URL, i++);

          await this.sleep(Bridge.TIMEOUT_DURATION);
        }
        
        if (this.cancelSearch) {
          for (let j = i; j <= videoTracks.length; j++) {
            videoTracks[j - 1].isSearching = false;
            videoTracks[j - 1].searchCancelled = true;
            this.updateItemRow(videoTracks[j - 1], Bridge.BASE_URL, j);
          }
        }

        this.setVideoTrackProgressMessage(videoTracks);
        this.updateCheckAllCheckbox();
      } catch (error) {
        this.setProgressText('Error occurred while finding video tracks.');
      } finally {
        this.toggleSearchProgress(false);
      }
    }

    /**
     * Sets progress message for video track results
     * @param {Array} videoTracks - Processed video tracks
     */
    setVideoTrackProgressMessage(videoTracks) {
      const searchedTracks = videoTracks.filter(t => !t.isSearching && !t.searchCancelled);
      const prefix = this.cancelSearch ? 'Search cancelled.' : 'Processing complete.';
      
      const progressText = searchedTracks.length > 0 
        ? `${prefix} Found ${searchedTracks.length} video tracks and their replacements.`
        : `${prefix} No video tracks were processed.`;

      const countOfReplacements = searchedTracks.filter(t => t.replacement).length;
      const countOfGoodMatches = searchedTracks.filter(t => t.replacement?.isGoodMatch).length;

      if (searchedTracks.length > 0) {
        if (countOfReplacements === 0) {
          this.setProgressText(progressText + ' No replacements found.');
        } else if (countOfGoodMatches === 0) {
          this.setProgressText(progressText + ` ${countOfReplacements} replacements found but no good matches.`);
        } else if (countOfGoodMatches < countOfReplacements) {
          this.setProgressText(progressText + ` ${countOfGoodMatches}/${countOfReplacements} are good matches.`);
        } else {
          this.setProgressText(progressText);
        }
      } else {
        this.setProgressText(progressText);
      }
    }

    /**
     * Lists all tracks in the playlist and enables only removal
     * @async
     */
    async listAllTracks() {
      this.cancelSearch = false;
      this.clearPlaylistItemsContainer();
      document.querySelector('.items-grid-wrapper')?.classList.add('list-only-mode');
      this.toggleSearchProgress(true, true);
      this.setProgressText('Fetching all tracks...');

      try {
        const currentPlaylistId = this.currentSelectedPlaylist?.id || 
                                  this.ytMusicAPI.getCurrentPlaylistIdFromURL();

        if (!currentPlaylistId) {
          return;
        }

        const items = await this.ytMusicAPI.getPlaylistItems(currentPlaylistId);
        this.setProgressText(`Found ${items.length} tracks. Select tracks to remove.`);

        if (items.length === 0) {
          return;
        }

        let i = 1;
        for (const track of items) {
          track.isSearching = false;
          track.searchCancelled = false;
          track.replacement = null;
          this.addItem(track, Bridge.BASE_URL, i++);
        }

        document.getElementById('replaceSelectedBtn')?.classList.add('hidden');
        document.getElementById('addSelectedBtn')?.classList.add('hidden');
        document.getElementById('removeSelectedBtn')?.classList.remove('hidden');

        document.getElementById('findLocalReplacementsBtn')?.classList.add('hidden');
        document.getElementById('findUnavailableBtn')?.classList.remove('hidden');
        document.getElementById('findVideoTracksBtn')?.classList.remove('hidden');
        document.getElementById('importFromFolderBtn')?.classList.remove('hidden');
        document.getElementById('importFromFileBtn')?.classList.remove('hidden');
        document.getElementById('listAllTracksBtn')?.classList.remove('hidden');

        this.updateCheckAllCheckbox();
      } catch (error) {
        this.setProgressText('Error occurred while fetching tracks.');
      } finally {
        this.toggleSearchProgress(false);
      }
    }

    /**
     * Performs setup before modifying selected items
     */
    beforeActionsOnSelectedItems() {
      this.disableReload();
      this.toggleSearchProgress(true, false);
    }

    /**
     * Performs cleanup after modifying selected items
     * @async
     */
    async afterActionsOnSelectedItems() {
      try {
        await this.initPlaylistFetching(true);
        const playlistId = this.currentSelectedPlaylist?.id || 
                          this.ytMusicAPI.getCurrentPlaylistIdFromURL();
        if (playlistId) {
          const updatedPlaylist = this.playlistsCache.find(p => p.id === playlistId);
          if (updatedPlaylist) {
            UIHelper.setPlaylistDetails(updatedPlaylist);
            this.currentSelectedPlaylist = updatedPlaylist;
          }
        }
      } catch (error) {
        // Ignore errors during playlist info refresh
      } finally {
        this.enableReload();
        this.toggleSearchProgress(false);
      }
    }

    /**
     * Replaces selected items in the playlist
     * @async
     */
    async replaceSelectedItems() {
      try {
        this.beforeActionsOnSelectedItems();
        this.setProgressText('Replacing selected items...');

        const playlistId = this.currentSelectedPlaylist?.id || 
                          this.ytMusicAPI.getCurrentPlaylistIdFromURL();

        if (!playlistId) {
          return;
        }

        const selectedItems = UIHelper.getSelectedMediaItems();
        let i = 1;

        for (const item of selectedItems) {
          this.setProgressText(`Replacing track ${i} of ${selectedItems.length}...`);

          if (item.replacementMedia?.videoId) {
            try {
              const originalItemDetails = item.originalMedia;
              const replacementItemDetails = item.replacementMedia;

              await this.ytMusicAPI.addItemToPlaylist(playlistId, replacementItemDetails.videoId);
              if (originalItemDetails.videoId && originalItemDetails.playlistSetVideoId) {
                await this.ytMusicAPI.removeItemFromPlaylist(
                  playlistId,
                  originalItemDetails.videoId,
                  originalItemDetails.playlistSetVideoId
                );
              }

              UIHelper.removeMediaGridRow(originalItemDetails);
            } catch (error) {
              UIHelper.showErrorInGridRow(item.originalMedia, error.message || 'Failed to replace');
            }
          }
          i++;
        }

        const countReplaced = selectedItems.filter(item => item.replacementMedia?.videoId).length;
        const progressText = countReplaced > 0 
          ? `All replacements completed. Replaced ${countReplaced} items.`
          : 'No valid replacements were made.';
        this.setProgressText(progressText);
      } catch (error) {
        this.setProgressText('Error occurred while replacing items.');
      } finally {
        await this.afterActionsOnSelectedItems();
      }
    }

    /**
     * Adds selected items to the playlist
     * @async
     */
    async addSelectedItems() {
      this.beforeActionsOnSelectedItems();
      this.setProgressText('Adding selected items...');

      try {
        const playlistId = this.currentSelectedPlaylist?.id || 
                          this.ytMusicAPI.getCurrentPlaylistIdFromURL();

        if (!playlistId) {
          return;
        }

        const selectedItems = UIHelper.getSelectedMediaItems();
        let i = 1;

        for (const item of selectedItems) {
          this.setProgressText(`Adding track ${i} of ${selectedItems.length}...`);

          if (item.replacementMedia?.videoId) {
            try {
              await this.ytMusicAPI.addItemToPlaylist(playlistId, item.replacementMedia.videoId);
              UIHelper.removeMediaGridRow(item.originalMedia);
            } catch (error) {
              UIHelper.showErrorInGridRow(item.originalMedia, error.message || 'Failed to add');
            }
          }
          i++;
        }

        const countAdded = selectedItems.filter(item => item.replacementMedia?.videoId).length;
        const progressText = countAdded > 0 
          ? `All additions completed. Added ${countAdded} items.`
          : 'No valid items were added.';
        this.setProgressText(progressText);
      } catch (error) {
        this.setProgressText('Error occurred while adding items.');
      } finally {
        await this.afterActionsOnSelectedItems();
      }
    }

    /**
     * Removes selected items from the playlist
     * @async
     */
    async removeSelectedItems() {
      try {
        this.beforeActionsOnSelectedItems();
        this.setProgressText('Removing selected items...');

        const playlistId = this.currentSelectedPlaylist?.id || 
                          this.ytMusicAPI.getCurrentPlaylistIdFromURL();

        if (!playlistId) {
          return;
        }

        const selectedItems = UIHelper.getSelectedMediaItems();
        let i = 1;

        for (const item of selectedItems) {
          this.setProgressText(`Removing track ${i} of ${selectedItems.length}...`);

          try {
            const originalItemDetails = item.originalMedia;
            if (originalItemDetails.videoId && originalItemDetails.playlistSetVideoId) {
              await this.ytMusicAPI.removeItemFromPlaylist(
                playlistId,
                originalItemDetails.videoId,
                originalItemDetails.playlistSetVideoId
              );
            }
            UIHelper.removeMediaGridRow(originalItemDetails);
          } catch (error) {
            UIHelper.showErrorInGridRow(item.originalMedia, error.message || 'Failed to remove');
          }
          i++;
        }

        const progressText = selectedItems.length > 0 
          ? `All removals completed. Removed ${selectedItems.length} items.`
          : 'No items were removed.';
        this.setProgressText(progressText);
      } catch (error) {
        this.setProgressText('Error occurred while removing items.');
      } finally {
        await this.afterActionsOnSelectedItems();
      }
    }

    /**
     * Scans a local folder for media files and displays them.
     * @async
     */
    async importFromFolder() {
      if (!('showDirectoryPicker' in window)) {
        this.setProgressText('Error: Your browser does not support the File System Access API.');
        return;
      }

      try {
        const dirHandle = await window.showDirectoryPicker();
        this.toggleSearchProgress(true, false);
        this.setProgressText('Scanning folder for media files...');

        const mediaExtensions = ['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aac', '.wma', '.opus'];
        const files = [];

        async function getFilesRecursively(directoryHandle) {
          for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              if (mediaExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
                files.push(file);
              }
            } else if (entry.kind === 'directory') {
              await getFilesRecursively(entry);
            }
          }
        }

        await getFilesRecursively(dirHandle);

        this.setProgressText(`Found ${files.length} media files. Displaying list...`);
        this.clearPlaylistItemsContainer();

        const localTracks = files.map(file => {
          const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const name = rawName.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
          const isGeneric = name.length < 3 || /^\d*\s*(?:-|_)?\s*(?:(?:unknown|untitled|misc)(?:\s*artist)?\s*(?:-|_)?\s*)?(?:track|audio\s*track|unknown|untitled|misc)\s*\d*$/i.test(name);
          return {
            name: name,
            artists: [],
            album: '',
            isLocal: true,
            isSearching: !isGeneric,
            isGeneric: isGeneric
          };
        }).sort((a, b) => (a.isGeneric === b.isGeneric ? 0 : a.isGeneric ? -1 : 1));

        this.localTracks = localTracks;

        let i = 1;
        localTracks.forEach(track => this.addItem(track, Bridge.BASE_URL, i++));

        if (localTracks.length > 0) {
          let progressMsg = `Displayed ${localTracks.length} tracks.`;
          const genericCount = localTracks.filter(t => t.isGeneric).length;
          if (genericCount > 0) {
            progressMsg += ` (${genericCount} generic names ignored).`;
          }
        progressMsg += ` Click "Start Search" to search for the checked tracks on YouTube Music.`;
          this.setProgressText(progressMsg);
          document.getElementById('findLocalReplacementsBtn')?.classList.remove('hidden');
          document.getElementById('findUnavailableBtn')?.classList.remove('hidden');
          document.getElementById('findVideoTracksBtn')?.classList.remove('hidden');
          document.getElementById('importFromFolderBtn')?.classList.remove('hidden');
          document.getElementById('importFromFileBtn')?.classList.remove('hidden');
          document.getElementById('listAllTracksBtn')?.classList.remove('hidden');
          
          document.getElementById('replaceSelectedBtn')?.classList.add('hidden');
          document.getElementById('removeSelectedBtn')?.classList.add('hidden');
          document.getElementById('addSelectedBtn')?.classList.remove('hidden');
          this.updateCheckAllCheckbox();
        } else {
          this.setProgressText('No media files found in the selected folder.');
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          this.setProgressText('Error accessing folder.');
        } else {
          this.setProgressText('Folder selection cancelled.');
        }
      } finally {
        this.toggleSearchProgress(false);
      }
    }

    /**
     * Reads a track list from a text file and displays it for search.
     * @async
     * @param {Event} event - File input change event
     */
    async importFromFile(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.toggleSearchProgress(true, false);
      this.setProgressText('Reading file...');

      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

        this.setProgressText(`Found ${lines.length} tracks in file. Displaying list...`);
        this.clearPlaylistItemsContainer();

        const localTracks = lines.map(line => {
          const name = line.trim();
          const isGeneric = name.length < 3 || /^\d*\s*(?:-|_)?\s*(?:(?:unknown|untitled|misc)(?:\s*artist)?\s*(?:-|_)?\s*)?(?:track|audio\s*track|unknown|untitled|misc)\s*\d*$/i.test(name);
          return {
            name: line,
            artists: [],
            album: '',
            isLocal: true,
            isSearching: !isGeneric,
            isGeneric: isGeneric
          };
        }).sort((a, b) => (a.isGeneric === b.isGeneric ? 0 : a.isGeneric ? -1 : 1));

        this.localTracks = localTracks;

        let i = 1;
        localTracks.forEach(track => this.addItem(track, Bridge.BASE_URL, i++));

        if (localTracks.length > 0) {
          let progressMsg = `Displayed ${localTracks.length} tracks.`;
          const genericCount = localTracks.filter(t => t.isGeneric).length;
          if (genericCount > 0) {
            progressMsg += ` (${genericCount} generic names ignored).`;
          }
        progressMsg += ` Click "Start Search" to search for the checked tracks on YouTube Music.`;
          this.setProgressText(progressMsg);
          document.getElementById('findLocalReplacementsBtn')?.classList.remove('hidden');
          document.getElementById('findUnavailableBtn')?.classList.remove('hidden');
          document.getElementById('findVideoTracksBtn')?.classList.remove('hidden');
          document.getElementById('importFromFolderBtn')?.classList.remove('hidden');
          document.getElementById('importFromFileBtn')?.classList.remove('hidden');
          document.getElementById('listAllTracksBtn')?.classList.remove('hidden');
          
          document.getElementById('replaceSelectedBtn')?.classList.add('hidden');
          document.getElementById('removeSelectedBtn')?.classList.add('hidden');
          document.getElementById('addSelectedBtn')?.classList.remove('hidden');
          this.updateCheckAllCheckbox();
        } else {
          this.setProgressText('No valid tracks found in the file.');
        }
      } catch (error) {
        this.setProgressText('Error reading file.');
      } finally {
        this.toggleSearchProgress(false);
        event.target.value = ''; // Reset input
      }
    }

    async findReplacementsForLocalTracks() {
      if (!this.localTracks || this.localTracks.length === 0) return;
      this.cancelSearch = false;
      
      // Update isSkipped or isSearching based on UI selection
      const allCheckboxes = document.querySelectorAll('#yt-music-plus-itemsGridContainer .item-checkbox');
      allCheckboxes.forEach((cb, index) => {
        if (this.localTracks[index]) {
          if (!cb.checked) {
            this.localTracks[index].isSkipped = true;
            this.localTracks[index].isSearching = false;
          } else {
            this.localTracks[index].isSkipped = false;
            this.localTracks[index].isSearching = !this.localTracks[index].isGeneric;
          }
        }
      });

      this.toggleSearchProgress(true, true);
      try {
        await this.processPlaylistItems(this.localTracks);
      } finally {
        this.toggleSearchProgress(false);
      }
    }
  }

  // Initialize bridge and expose to global scope
  window.bridgeInstance = new Bridge();

  // Listen for settings messages from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    try {
      if (event.data?.type === 'EXT_SETTINGS') {
        window.bridgeInstance.extSettings = event.data.settings;
      }
    } catch (error) {
      // Handle message errors silently
    }
  });

  // Signal that bridge is ready
  window.postMessage({ type: 'BRIDGE_LOADED' }, '*');

  // Start auth token interception
  fetchAuthToken();
})();
