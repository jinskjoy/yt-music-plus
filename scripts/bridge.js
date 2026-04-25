/**
 * Bridge Script - Runs in page context to access YouTube Music APIs
 * Extracts authentication tokens and provides methods for playlist manipulation
 */

import { YTMusicAPI } from './yt-music-api.js';
import { UIHelper } from '../utils/ui-helper.js';
import { BridgeUI } from './bridge-ui.js';
import { TrackProcessor } from './track-processor.js';

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
   * Orchestrates the API, UI, and Track Processor
   */
  class Bridge {
    // Constants
    static TIMEOUT_DURATION = 100;
    static PAGE_LOAD_TIMEOUT = 3000;
    static BASE_URL = 'https://music.youtube.com/watch?v=';
    static PLAYLIST_PAGE_PATH = 'https://music.youtube.com/playlist';

    constructor() {
      this.ytMusicAPI = new YTMusicAPI();
      this.ui = new BridgeUI(this);
      this.processor = new TrackProcessor(this);
      
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
     */
    setAuthToken(token) {
      this.ytMusicAPI.setAuthToken(token);
      this.addEventListeners();
      this.ui.injectActionButtons(this.extSettings);
      this.ui.showTriggerButtons(this.extSettings);
    }

    /**
     * Shows popup and loads playlist data
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
              this.ui.injectActionButtons(this.extSettings);
              this.ui.showTriggerButtons(this.extSettings);
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

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !popupElement?.classList.contains('hidden')) {
            this.hidePopup();
          }
        });
      }

      // Action button listeners
      this.attachButtonListener('findUnavailableBtn', () => this.processor.findUnavailableTracks());
      this.attachButtonListener('findVideoTracksBtn', () => this.processor.findVideoTracks());
      this.attachButtonListener('replaceSelectedBtn', () => this.replaceSelectedItems());
      this.attachButtonListener('addSelectedBtn', () => this.addSelectedItems());
      this.attachButtonListener('removeSelectedBtn', () => this.removeSelectedItems());
      this.attachButtonListener('importFromFolderBtn', () => this.processor.importFromFolder());
      this.attachButtonListener('findLocalReplacementsBtn', () => this.findReplacementsForLocalTracks());
      this.attachButtonListener('listAllTracksBtn', () => this.processor.listAllTracks());
      this.attachButtonListener('importFromFileBtn', () => {
        document.getElementById('importFileInput')?.click();
      });

      const fileInput = document.getElementById('importFileInput');
      if (fileInput) {
        fileInput.addEventListener('change', (e) => this.processor.importFromFile(e));
      }

      this.attachButtonListener('cancelSearchBtn', () => {
        this.cancelSearch = true;
        this.ui.setProgressText('Cancelling search... Please wait.');
      });

      const cancelBtn = document.getElementById('cancelSearchBtn');
      if (cancelBtn) {
        cancelBtn.classList.remove('btn-secondary', 'btn-danger');
        cancelBtn.classList.add('btn-primary');
      }
    }

    /**
     * Helper to attach click listeners to buttons
     */
    attachButtonListener(buttonId, handler) {
      const button = document.getElementById(buttonId);
      if (button) {
        button.addEventListener('click', handler);
      }
    }

    /**
     * Initializes playlist fetching and display
     */
    async initPlaylistFetching(forceRefresh = false) {
      if (this.isFetchingPlaylists) return;

      if (!forceRefresh && this.playlistsCache && this.playlistsCache.length > 0) {
        this.ui.displayPlaylistsForSelection(this.playlistsCache);
        this.ui.hidePlaylistLoadingIndicator();
        this.ui.initRefreshButton();
        return;
      }

      this.isFetchingPlaylists = true;

      const loadingIndicator = document.getElementById('playlistsLoadingIndicator');
      if (loadingIndicator) loadingIndicator.classList.remove('hidden');
      
      const playlistsGrid = document.getElementById('playlistsGrid');
      if (playlistsGrid) playlistsGrid.replaceChildren();

      try {
        let playlists = await this.ytMusicAPI.getEditablePlaylists();
        
        if (playlists.length === 0) {
          await this.sleep(1000);
          playlists = await this.ytMusicAPI.getEditablePlaylists();
        }
        
        this.playlistsCache = playlists;
      } catch (error) {
        console.error('YouTube Music +: Error fetching playlists', error);
        this.playlistsCache = [];
      } finally {
        this.ui.displayPlaylistsForSelection(this.playlistsCache);
        this.ui.hidePlaylistLoadingIndicator();
        this.ui.initRefreshButton();
        this.isFetchingPlaylists = false;
      }
    }

    /**
     * Handles playlist selection
     */
    onPlaylistSelected(playlist) {
      UIHelper.setPlaylistDetails(playlist);

      if (!this.currentSelectedPlaylist || this.currentSelectedPlaylist.id !== playlist.id) {
        this.ui.clearPlaylistItemsContainer();
        this.currentSelectedPlaylist = playlist;
        this.ui.setProgressText('');
      }

      const detailsScreen = document.getElementById('playlistDetailsScreen');
      if (detailsScreen) detailsScreen.classList.remove('hidden');

      const selectionScreen = document.getElementById('playlistSelectionScreen');
      if (selectionScreen) selectionScreen.classList.add('hidden');

      this.resetActionButtonsForPlaylist();

      UIHelper.toggleGrid(false);
      this.localTracks = [];
      this.ui.updatePopupTitle(`Playlist: ${playlist.title}`);
      
      this.ui.initSearchBox();
      const searchInput = document.getElementById('ytMusicPlusSearchInput');
      if (searchInput) {
        searchInput.value = '';
        document.getElementById('ytMusicPlusClearSearchBtn')?.classList.add('hidden');
        this.ui.filterGridItems('');
      }
    }

    /**
     * Resets action buttons visibility for a newly selected playlist
     */
    resetActionButtonsForPlaylist() {
      document.getElementById('findLocalReplacementsBtn')?.classList.add('hidden');
      document.getElementById('findUnavailableBtn')?.classList.remove('hidden');
      document.getElementById('findVideoTracksBtn')?.classList.remove('hidden');
      document.getElementById('importFromFolderBtn')?.classList.remove('hidden');
      document.getElementById('importFromFileBtn')?.classList.remove('hidden');
      document.getElementById('listAllTracksBtn')?.classList.remove('hidden');
      
      document.getElementById('replaceSelectedBtn')?.classList.remove('hidden');
      document.getElementById('removeSelectedBtn')?.classList.remove('hidden');
      document.getElementById('addSelectedBtn')?.classList.remove('hidden');
    }

    /**
     * Updates visibility of buttons for local import feature
     */
    updateImportButtonVisibility() {
      document.getElementById('findLocalReplacementsBtn')?.classList.remove('hidden');
      document.getElementById('findUnavailableBtn')?.classList.remove('hidden');
      document.getElementById('findVideoTracksBtn')?.classList.remove('hidden');
      document.getElementById('importFromFolderBtn')?.classList.remove('hidden');
      document.getElementById('importFromFileBtn')?.classList.remove('hidden');
      document.getElementById('listAllTracksBtn')?.classList.remove('hidden');
      
      document.getElementById('replaceSelectedBtn')?.classList.add('hidden');
      document.getElementById('removeSelectedBtn')?.classList.add('hidden');
      document.getElementById('addSelectedBtn')?.classList.remove('hidden');
    }

    /**
     * Creates original and replacement media objects appropriately formatted for UI
     */
    _createMediaObjects(item, baseUrl) {
      const originalMedia = {
        name: item.name,
        artist: item.artists?.join(', ') || '',
        album: item.album || '',
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
          album: item.replacement.album || '',
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
     * Performs setup before modifying selected items
     */
    beforeActionsOnSelectedItems() {
      this.disableReload();
      this.ui.toggleSearchProgress(true, false);
    }

    /**
     * Performs cleanup after modifying selected items
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
        this.ui.toggleSearchProgress(false);
      }
    }

    /**
     * Replaces selected items in the playlist
     */
    async replaceSelectedItems() {
      const selectedItems = UIHelper.getSelectedMediaItems();
      if (selectedItems.length === 0) return;

      if (!confirm(`Are you sure you want to replace ${selectedItems.length} selected item${selectedItems.length !== 1 ? 's' : ''}?`)) {
        return;
      }

      try {
        this.beforeActionsOnSelectedItems();
        this.ui.setProgressText('Replacing selected items...');

        const playlistId = this.currentSelectedPlaylist?.id || 
                          this.ytMusicAPI.getCurrentPlaylistIdFromURL();

        if (!playlistId) return;

        let i = 1;
        for (const item of selectedItems) {
          this.ui.setProgressText(`Replacing track ${i} of ${selectedItems.length}...`);

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
        this.ui.setProgressText(countReplaced > 0 ? `All replacements completed. Replaced ${countReplaced} items.` : 'No valid replacements were made.');
      } catch (error) {
        this.ui.setProgressText('Error occurred while replacing items.');
      } finally {
        await this.afterActionsOnSelectedItems();
      }
    }

    /**
     * Adds selected items to the playlist
     */
    async addSelectedItems() {
      this.beforeActionsOnSelectedItems();
      this.ui.setProgressText('Adding selected items...');

      try {
        const playlistId = this.currentSelectedPlaylist?.id || 
                          this.ytMusicAPI.getCurrentPlaylistIdFromURL();

        if (!playlistId) return;

        const selectedItems = UIHelper.getSelectedMediaItems();
        let i = 1;

        for (const item of selectedItems) {
          this.ui.setProgressText(`Adding track ${i} of ${selectedItems.length}...`);

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
        this.ui.setProgressText(countAdded > 0 ? `All additions completed. Added ${countAdded} items.` : 'No valid items were added.');
      } catch (error) {
        this.ui.setProgressText('Error occurred while adding items.');
      } finally {
        await this.afterActionsOnSelectedItems();
      }
    }

    /**
     * Removes selected items from the playlist
     */
    async removeSelectedItems() {
      const selectedItems = UIHelper.getSelectedMediaItems();
      if (selectedItems.length === 0) return;

      if (!confirm(`Are you sure you want to remove ${selectedItems.length} selected item${selectedItems.length !== 1 ? 's' : ''}?`)) {
        return;
      }

      try {
        this.beforeActionsOnSelectedItems();
        this.ui.setProgressText('Removing selected items...');

        const playlistId = this.currentSelectedPlaylist?.id || 
                          this.ytMusicAPI.getCurrentPlaylistIdFromURL();

        if (!playlistId) return;

        let i = 1;
        for (const item of selectedItems) {
          this.ui.setProgressText(`Removing track ${i} of ${selectedItems.length}...`);

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

        this.ui.setProgressText(selectedItems.length > 0 ? `All removals completed. Removed ${selectedItems.length} items.` : 'No items were removed.');
      } catch (error) {
        this.ui.setProgressText('Error occurred while removing items.');
      } finally {
        await this.afterActionsOnSelectedItems();
      }
    }

    async findReplacementsForLocalTracks() {
      if (!this.localTracks || this.localTracks.length === 0) return;
      this.cancelSearch = false;
      
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

      this.ui.toggleSearchProgress(true, true);
      try {
        await this.processor.processPlaylistItems(this.localTracks);
      } finally {
        this.ui.toggleSearchProgress(false);
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
