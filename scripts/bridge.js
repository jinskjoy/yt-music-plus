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
      this.extSettings = {
        showPlaylistButton: true,
        showNavButton: true
      };
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
     */
    toggleSearchProgress(show) {
      const el = document.getElementById('searchProgress');
      if (el) {
        el.classList.toggle('hidden', !show);
      }

      // Disable/enable buttons during search
      const buttonIds = [
        'findUnavailableBtn',
        'findVideoTracksBtn',
        'replaceSelectedBtn',
        'addSelectedBtn',
        'removeSelectedBtn',
        'backButton'
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
      const checkboxes = popupElement.querySelectorAll('.item-checkbox');

      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      if (selectAllCheckbox) selectAllCheckbox.checked = allChecked;

      const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
      const actionButtons = popupElement.querySelectorAll('.action-buttons-container button');
      actionButtons.forEach(btn => btn.disabled = !anyChecked);
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
    async initPlaylistFetching() {
      this.playlistsCache = await this.ytMusicAPI.getEditablePlaylists();
      this.displayPlaylistsForSelection();
      this.hidePlaylistLoadingIndicator();
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
      const itemsToProcess = items;
      this.clearPlaylistItemsContainer();

      let i = 1;
      for (const item of itemsToProcess) {
        this.setProgressText(`Processing track ${i} of ${itemsToProcess.length}`);

        try {
          const searchResult = await this.ytMusicAPI.searchMusic(item);
          const bestSearchResult = this.ytMusicAPI.getBestSearchResult(searchResult, item);
          item.replacement = bestSearchResult;
          this.addItem(item, Bridge.BASE_URL, i++);
        } catch (error) {
          // Skip items that fail to process
        }

        await this.sleep(Bridge.TIMEOUT_DURATION);
      }

      this.setFinalProgressText(itemsToProcess);
    }

    /**
     * Sets final progress message after processing
     * @param {Array} greyedOutItems - Processed items
     */
    setFinalProgressText(greyedOutItems) {
      if (greyedOutItems.length === 0) {
        this.setProgressText('Processing complete. No unavailable tracks found.');
        return;
      }

      let progressText = `Processing complete. Found ${greyedOutItems.length} unavailable tracks and their replacements.`;
      const hasBadMatches = greyedOutItems.some(item => item.replacement && !item.replacement.isGoodMatch);

      if (hasBadMatches) {
        progressText += ' Some replacements may not be good matches, please review carefully.';
      }

      this.setProgressText(progressText);
    }

    /**
     * Clears the playlist items container
     */
    clearPlaylistItemsContainer() {
      const container = document.getElementById('yt-music-plus-itemsGridContainer');
      if (container) {
        container.replaceChildren();
      }
    }

    /**
     * Adds an item row to the display
     * @param {Object} item - Item to add
     * @param {string} baseUrl - Base URL for video links
     * @param {number} index - Item index
     * @returns {number} Next index
     */
    addItem(item, baseUrl, index) {
      const originalMedia = {
        name: item.name,
        artist: item.artists?.join(', ') || '',
        thumbnail: item.thumbnail,
        url: baseUrl + item.videoId,
        videoId: item.videoId,
        playlistSetVideoId: item.playlistSetVideoId
      };

      const replacementMedia = item.replacement ? {
        name: item.replacement.name,
        artist: item.replacement.artists?.join(', ') || '',
        thumbnail: item.replacement.thumbnail,
        url: baseUrl + item.replacement.videoId,
        isGoodMatch: item.replacement.isGoodMatch,
        videoId: item.replacement.videoId,
        playlistSetVideoId: item.replacement.playlistSetVideoId
      } : null;

      const gridRow = UIHelper.createMediaGridRow(originalMedia, replacementMedia, index);
      document.getElementById('yt-music-plus-itemsGridContainer')?.appendChild(gridRow);

      return index + 1;
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
      this.clearPlaylistItemsContainer();
      this.toggleSearchProgress(true);
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
      this.clearPlaylistItemsContainer();
      this.toggleSearchProgress(true);
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

        this.clearPlaylistItemsContainer();
        let i = 1;

        for (const track of videoTracks) {
          // Clean track name by removing video-specific keywords
          track.name = track.name.replaceAll(/(official\s*)?(music\s*)?video/gi, '').trim();

          try {
            const searchResult = await this.ytMusicAPI.searchMusic(track);
            const replacement = this.ytMusicAPI.getBestSearchResult(searchResult, track);
            track.replacement = replacement;
            this.addItem(track, Bridge.BASE_URL, i++);
          } catch (error) {
            // Skip tracks that fail to process
          }

          await this.sleep(Bridge.TIMEOUT_DURATION);
        }

        this.setVideoTrackProgressMessage(videoTracks);
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
      const progressText = videoTracks.length > 0 
        ? `Processing complete. Found ${videoTracks.length} video tracks and their replacements.`
        : 'Processing complete. No video tracks found.';

      const countOfReplacements = videoTracks.filter(t => t.replacement).length;
      const countOfGoodMatches = videoTracks.filter(t => t.replacement?.isGoodMatch).length;

      if (countOfReplacements === 0) {
        this.setProgressText(progressText + ' No replacements found.');
      } else if (countOfGoodMatches === 0) {
        this.setProgressText(progressText + ` ${countOfReplacements} replacements found but no good matches.`);
      } else if (countOfGoodMatches < countOfReplacements) {
        this.setProgressText(progressText + ` ${countOfGoodMatches}/${countOfReplacements} are good matches.`);
      } else {
        this.setProgressText(progressText);
      }
    }

    /**
     * Performs setup before modifying selected items
     */
    beforeActionsOnSelectedItems() {
      this.disableReload();
      this.toggleSearchProgress(true);
    }

    /**
     * Performs cleanup after modifying selected items
     */
    afterActionsOnSelectedItems() {
      this.enableReload();
      this.toggleSearchProgress(false);
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
              await this.ytMusicAPI.removeItemFromPlaylist(
                playlistId,
                originalItemDetails.videoId,
                originalItemDetails.playlistSetVideoId
              );

              UIHelper.removeMediaGridRow(originalItemDetails);
            } catch (error) {
              // Continue processing remaining items
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
        this.afterActionsOnSelectedItems();
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
            } catch (error) {
              // Continue processing remaining items
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
        this.afterActionsOnSelectedItems();
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
            await this.ytMusicAPI.removeItemFromPlaylist(
              playlistId,
              originalItemDetails.videoId,
              originalItemDetails.playlistSetVideoId
            );
            UIHelper.removeMediaGridRow(originalItemDetails);
          } catch (error) {
            // Continue processing remaining items
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
        this.afterActionsOnSelectedItems();
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
