/**
 * Bridge Script - Runs in page context to access YouTube Music APIs
 * Extracts authentication tokens and provides methods for playlist manipulation
 */

import { YTMusicAPI } from './yt-music-api.js';
import { UIHelper } from '../utils/ui-helper.js';
import { BridgeUI } from './bridge-ui.js';
import { TrackProcessor } from './track-processor.js';
import { PlayerHandler } from './player-handler.js';
import { CONSTANTS } from '../utils/constants.js';
import { MESSAGES } from '../utils/ui-messages.js';

(function () {
  /**
   * AuthInterceptor - Intercepts authorization tokens from XMLHttpRequest and Fetch API calls
   */
  class AuthInterceptor {
    constructor(onTokenFound, shouldIntercept) {
      this.onTokenFound = onTokenFound;
      this.shouldIntercept = shouldIntercept || (() => true);
      this.isIntercepting = true;
      this.originalSetRequestHeader = null;
      this.originalFetch = null;
    }

    start() {
      this.interceptXHR();
      this.interceptFetch();
    }

    stop() {
      this.isIntercepting = false;
      if (this.originalSetRequestHeader) {
        XMLHttpRequest.prototype.setRequestHeader = this.originalSetRequestHeader;
        this.originalSetRequestHeader = null;
      }
      if (this.originalFetch) {
        window.fetch = this.originalFetch;
        this.originalFetch = null;
      }
    }

    interceptXHR() {
      const self = this;
      this.originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

      XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
        if (!self.isIntercepting || !self.shouldIntercept()) {
          return self.originalSetRequestHeader.apply(this, arguments);
        }

        if (header.toLowerCase() === 'authorization') {
          self.onTokenFound(value);
        }

        return self.originalSetRequestHeader.apply(this, arguments);
      };
    }

    interceptFetch() {
      const self = this;
      this.originalFetch = window.fetch;

      window.fetch = async (...args) => {
        if (!self.isIntercepting || !self.shouldIntercept()) {
          return self.originalFetch.apply(window, args);
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
              self.onTokenFound(authToken);
            }
          }

          return self.originalFetch.apply(window, args);
        } catch (error) {
          return self.originalFetch.apply(window, args);
        }
      };
    }
  }

  /**
   * DisplayTrack - Represents a track formatted for the UI
   */
  class DisplayTrack {
    constructor(item, baseUrl, isReplacement = false) {
      this.name = item.name;
      this.artist = item.artist || item.artistsString || (Array.isArray(item.artists) ? item.artists.join(', ') : '');
      this.album = item.album || '';
      this.thumbnail = item.thumbnail;
      this.url = item.videoId ? baseUrl + item.videoId : null;
      this.videoId = item.videoId;
      this.localFile = item.localFile;
      this.playlistSetVideoId = item.playlistSetVideoId;
      this.isGoodMatch = item.isGoodMatch;
      this.isDuplicate = item.isDuplicate;
      this.isPending = false;
      this.isCancelled = false;
      this.isChecked = item.isChecked;
    }

    static createReplacement(item, baseUrl) {
      if (!item) return null;
      
      if (item.isGeneric) {
        return { name: 'Ignored (Generic Name)' };
      }
      if (item.isSkipped) {
        return { name: 'Ignored (Not Selected)' };
      }
      if (item.isSearching) {
        return { name: 'Waiting for search...', isPending: true, isChecked: true };
      }
      if (item.searchCancelled) {
        return { name: 'Search cancelled', isCancelled: true };
      }
      if (item.replacement) {
        const replacement = new DisplayTrack(item.replacement, baseUrl, true);
        replacement.isDuplicate = item.isDuplicate;
        return replacement;
      }
      return null;
    }
  }

  /**
   * SearchSession - Manages the state of a search or processing operation
   */
  class SearchSession {
    constructor() {
      this.isCancelled = false;
      this.isActive = false;
      this.totalItems = 0;
      this.processedItems = 0;
    }

    start(total) {
      this.isActive = true;
      this.isCancelled = false;
      this.totalItems = total;
      this.processedItems = 0;
    }

    cancel() {
      this.isCancelled = true;
    }

    stop() {
      this.isActive = false;
    }

    updateProgress() {
      this.processedItems++;
    }

    get progressText() {
      return `Processing track ${this.processedItems} of ${this.totalItems}`;
    }
  }

  /**
   * Bridge Class - Main controller for playlist operations
   * Orchestrates the API, UI, and Track Processor
   */
  class Bridge {
    // Constants are now in CONSTANTS.API

    constructor() {
      this.ytMusicAPI = new YTMusicAPI();
      this.ui = new BridgeUI(this);
      this.processor = new TrackProcessor(this);
      this.playerHandler = new PlayerHandler();
      this.session = new SearchSession();
      
      this.currentSelectedPlaylist = null;
      this.targetPlaylist = null;
      this.isSelectingTarget = false;
      this.playlistsCache = [];
      this.isReloadDisabled = false;
      this.isFetchingPlaylists = false;
      this.localTracks = [];
      this.extSettings = {
        showPlaylistButton: true,
        showNavButton: true
      };
      
      // Cache for popup elements
      this.popupElements = {
        holder: null,
        container: null,
        minimizeBtn: null,
        header: null
      };
      
      this.preventUnloadListener = (e) => {
        if (this.isReloadDisabled) {
          e.preventDefault();
          e.returnValue = '';
        }
      };
    }

    /**
     * Caches popup-related DOM elements
     */
    cachePopupElements() {
      if (this.popupElements.holder) return true;

      this.popupElements.holder = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
      if (this.popupElements.holder) {
        this.popupElements.container = this.popupElements.holder.querySelector(`.${CONSTANTS.UI.CLASSES.POPUP_CONTAINER}`);
        this.popupElements.minimizeBtn = this.popupElements.holder.querySelector(`#${CONSTANTS.UI.BUTTON_IDS.MINIMIZE_POPUP}`);
        this.popupElements.header = this.popupElements.holder.querySelector(`.${CONSTANTS.UI.CLASSES.POPUP_HEADER}`);
        return true;
      }
      return false;
    }

    get cancelSearch() {
      return this.session.isCancelled;
    }

    set cancelSearch(value) {
      if (value) this.session.cancel();
      else this.session.isCancelled = false;
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
      this.playerHandler.init();
    }

    /**
     * Shows popup and loads playlist data
     */
    async showPopup() {
      if (this.cachePopupElements()) {
        this.popupElements.holder.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
      }

      this.ui.setPlaylistScreenVisibility(true);
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
      if (this.cachePopupElements()) {
        this.popupElements.holder.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
        // Reset minimized state when closing
        if (this.popupElements.container?.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)) {
          this.toggleMinimize();
        }
      }
      this.ui.clearActiveButtons();
      this.enableReload();
    }

    /**
     * Toggles popup minimization
     */
    toggleMinimize() {
      if (!this.cachePopupElements()) return;

      const { holder, container, minimizeBtn } = this.popupElements;
      
      if (holder && container) {
        const isMinimized = container.classList.toggle(CONSTANTS.UI.CLASSES.MINIMIZED);
        holder.classList.toggle(CONSTANTS.UI.CLASSES.MINIMIZED, isMinimized);
        
        if (minimizeBtn) {
          minimizeBtn.textContent = isMinimized ? '⤢' : '−';
          minimizeBtn.setAttribute('aria-label', isMinimized ? 'Restore popup' : 'Minimize popup');
        }
      }
    }

    /**
     * Adds event listeners for popup buttons and navigation
     */
    addEventListeners() {
      // Navigation listener for playlist page detection
      navigation?.addEventListener('navigate', (event) => {
        if (event.navigationType !== 'push') return;

        const isPlaylistPage = event.destination?.url?.startsWith(CONSTANTS.API.PLAYLIST_PAGE_PATH);
        if (isPlaylistPage) {
          setTimeout(() => {
            if (!this.extSettings || this.extSettings.showPlaylistButton !== false) {
              this.ui.injectActionButtons(this.extSettings);
              this.ui.showTriggerButtons(this.extSettings);
            }
          }, CONSTANTS.API.PAGE_LOAD_TIMEOUT_MS);
        }
      });

      // Nav bar button listener
      const navBarBtn = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.NAV_BTN);
      if (navBarBtn) {
        navBarBtn.addEventListener('click', () => this.showPopup());
      }

      // Popup close and state listeners
      if (this.cachePopupElements()) {
        const { holder, container, header } = this.popupElements;

        // Use event delegation for header actions (close, minimize, restore)
        header?.addEventListener('click', (e) => {
          const target = e.target;
          
          // Handle close button
          if (target.id === CONSTANTS.UI.BUTTON_IDS.CLOSE_POPUP || target.closest(`#${CONSTANTS.UI.BUTTON_IDS.CLOSE_POPUP}`)) {
            this.hidePopup();
            return;
          }

          // Handle minimize button
          if (target.id === CONSTANTS.UI.BUTTON_IDS.MINIMIZE_POPUP || target.closest(`#${CONSTANTS.UI.BUTTON_IDS.MINIMIZE_POPUP}`)) {
            e.stopPropagation();
            this.toggleMinimize();
            return;
          }

          // Restore on header click if minimized
          if (container.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)) {
            // If it's a link, prevent default action
            if (target.closest('a')) {
              e.preventDefault();
            }
            this.toggleMinimize();
          }
        });

        // Backdrop click handler
        holder.addEventListener('click', (e) => {
          if (e.target === holder) {
            this.toggleMinimize();
          }
        });

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !holder.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)) {
            this.hidePopup();
          }
        });
      }

      // Action button listeners
      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.FIND_UNAVAILABLE, () => {
        this.processor.findUnavailableTracks();
        this.ui.setActiveButton(CONSTANTS.UI.BUTTON_IDS.FIND_UNAVAILABLE);
      });
      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.FIND_VIDEO_TRACKS, () => {
        this.processor.findVideoTracks();
        this.ui.setActiveButton(CONSTANTS.UI.BUTTON_IDS.FIND_VIDEO_TRACKS);
      });
      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.FIND_DUPLICATE_TRACKS, () => {
        this.processor.findDuplicateTracks();
        this.ui.setActiveButton(CONSTANTS.UI.BUTTON_IDS.FIND_DUPLICATE_TRACKS);
      });
      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.KEEP_ONLY_SELECTED, () => {
        this.processor.keepOnlySelected();
      });
      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.REPLACE_SELECTED, () => this.replaceSelectedItems());
      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.ADD_SELECTED, () => this.addSelectedItems());
      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.REMOVE_SELECTED, () => this.removeSelectedItems());
      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.IMPORT_FROM_FOLDER, () => {
        this.processor.importFromFolder();
        this.ui.setActiveButton(CONSTANTS.UI.BUTTON_IDS.IMPORT_FROM_FOLDER);
      });
      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.FIND_LOCAL_REPLACEMENTS, () => this.findReplacementsForLocalTracks());
      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.LIST_ALL_TRACKS, () => {
        this.processor.listAllTracks();
        this.ui.setActiveButton(CONSTANTS.UI.BUTTON_IDS.LIST_ALL_TRACKS);
      });
      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.IMPORT_FROM_FILE, () => {
        document.getElementById(CONSTANTS.UI.BUTTON_IDS.IMPORT_FILE_INPUT)?.click();
      });

      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.SELECT_TARGET_PLAYLIST, () => this.showPlaylistSelectionForTarget());
      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.CANCEL_TARGET_SELECTION, () => this.cancelTargetSelection());

      const fileInput = document.getElementById(CONSTANTS.UI.BUTTON_IDS.IMPORT_FILE_INPUT);
      if (fileInput) {
        fileInput.addEventListener('change', (e) => {
          this.processor.importFromFile(e);
          this.ui.setActiveButton(CONSTANTS.UI.BUTTON_IDS.IMPORT_FROM_FILE);
        });
      }

      this.attachButtonListener(CONSTANTS.UI.BUTTON_IDS.CANCEL_SEARCH, () => {
        this.cancelSearch = true;
        this.ui.setProgressText(MESSAGES.SEARCH.CANCELLING);
      });

      const cancelBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.CANCEL_SEARCH);
      if (cancelBtn) {
        cancelBtn.classList.remove(CONSTANTS.UI.CLASSES.BTN_SECONDARY, CONSTANTS.UI.CLASSES.BTN_DANGER);
        cancelBtn.classList.add(CONSTANTS.UI.CLASSES.BTN_PRIMARY);
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
    async initPlaylistFetching(forceRefresh = false, onlyEditable = null, isTargetSelection = false) {
      if (this.isFetchingPlaylists) return;

      // Determine default value for onlyEditable if not provided
      if (onlyEditable === null) {
        onlyEditable = !this.extSettings?.loadAllPlaylists;
      }

      if (!forceRefresh && this.playlistsCache && this.playlistsCache.length > 0) {
        const displayedPlaylists = onlyEditable ? this.playlistsCache.filter(p => p.isEditable) : this.playlistsCache;
        if (isTargetSelection) {
          this.ui.displayTargetPlaylists(displayedPlaylists, this.playlistsCache);
        } else {
          this.ui.displayPlaylistsForSelection(displayedPlaylists, this.playlistsCache);
        }
        this.ui.hidePlaylistLoadingIndicator();
        this.ui.initRefreshButton();
        return;
      }

      this.isFetchingPlaylists = true;

      if (isTargetSelection) {
        this.ui.toggleTargetSearchProgress(true);
      } else {
        const loadingIndicator = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLISTS_LOADING_INDICATOR);
        if (loadingIndicator) loadingIndicator.classList.remove(CONSTANTS.UI.CLASSES.HIDDEN);
      }
      
      const playlistsGridId = isTargetSelection ? CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLISTS_GRID : CONSTANTS.UI.ELEMENT_IDS.PLAYLISTS_GRID;
      const playlistsGrid = document.getElementById(playlistsGridId);
      if (playlistsGrid) playlistsGrid.replaceChildren();

      try {
        // Always fetch all to get correct counts for the footer
        let playlists = await this.ytMusicAPI.getPlaylists(false);
        
        if (playlists.length === 0) {
          await this.sleep(CONSTANTS.PLAYER.RETRY_INTERVAL_MS);
          playlists = await this.ytMusicAPI.getPlaylists(false);
        }
        
        this.playlistsCache = playlists;
      } catch (error) {
        console.error('YouTube Music +: Error fetching playlists', error);
        this.playlistsCache = [];
      } finally {
        const displayedPlaylists = onlyEditable ? this.playlistsCache.filter(p => p.isEditable) : this.playlistsCache;
        if (isTargetSelection) {
          this.ui.displayTargetPlaylists(displayedPlaylists, this.playlistsCache);
          this.ui.toggleTargetSearchProgress(false);
        } else {
          this.ui.displayPlaylistsForSelection(displayedPlaylists, this.playlistsCache);
          this.ui.hidePlaylistLoadingIndicator();
        }
        this.ui.initRefreshButton();
        this.isFetchingPlaylists = false;
      }
    }

    /**
     * Handles playlist selection
     */
    onPlaylistSelected(playlist) {
      const isNewPlaylist = !this.currentSelectedPlaylist || this.currentSelectedPlaylist.id !== playlist.id;
      
      UIHelper.setPlaylistDetails(playlist);
      
      if (isNewPlaylist) {
        // Only clear UI state if it's a different playlist
        this.ui.clearActiveButtons();
        this.ui.setListOnlyMode(false);
        this.ui.clearPlaylistItemsContainer();
        this.currentSelectedPlaylist = playlist;
        this.targetPlaylist = playlist; // Default target is the selected playlist
        this.processor.targetPlaylistItems.clear();
        this.ui.setProgressText('');
        this.localTracks = [];
        UIHelper.toggleGrid(false);
      }

      this.ui.setPlaylistScreenVisibility(false);
      this.ui.updatePopupTitle(`Playlist: ${playlist.title}`);
      
      if (isNewPlaylist) {
        this.ui.updateViewMode(CONSTANTS.UI.VIEW_MODES.DEFAULT, playlist);
        this.ui.updateTargetPlaylistDisplay(this.targetPlaylist);
        
        this.ui.initSearchBox();
        const searchInput = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SEARCH_INPUT);
        if (searchInput) {
          searchInput.value = '';
          document.getElementById(CONSTANTS.UI.ELEMENT_IDS.CLEAR_SEARCH_BTN)?.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
          this.ui.filterGridItems('');
        }

        // Auto-list tracks if enabled and no button is active
        if (this.extSettings?.autoListAllTracks !== false && !this.ui.hasActiveActionButton()) {
          this.processor.listAllTracks();
          this.ui.setActiveButton(CONSTANTS.UI.BUTTON_IDS.LIST_ALL_TRACKS);
        }
      }
    }

    /**
     * Shows playlist selection screen specifically for choosing a target playlist
     */
    async showPlaylistSelectionForTarget() {
      this.isSelectingTarget = true;
      this.ui.setTargetModalVisibility(true);
      
      await this.initPlaylistFetching(false, null, true);
    }

    /**
     * Handles target playlist selection
     */
    onTargetPlaylistSelected(playlist) {
      const oldTarget = this.targetPlaylist;
      this.targetPlaylist = playlist;
      this.finishTargetSelection();
      
      // If target changed, recheck for duplicates in search results
      if (!oldTarget || oldTarget.id !== playlist.id) {
        this.processor.recheckDuplicates();
      }
    }

    /**
     * Cancels target playlist selection
     */
    cancelTargetSelection() {
      this.finishTargetSelection();
    }

    /**
     * Finishes target selection mode and returns to details screen
     */
    finishTargetSelection() {
      this.isSelectingTarget = false;
      this.ui.setTargetModalVisibility(false);
      this.ui.updateTargetPlaylistDisplay(this.targetPlaylist);
      this.ui.updatePopupTitle(`Playlist: ${this.currentSelectedPlaylist.title}`);
    }

    /**
     * Creates original and replacement media objects appropriately formatted for UI
     */
    _createMediaObjects(item, baseUrl) {
      const originalMedia = new DisplayTrack(item, baseUrl);
      const replacementMedia = DisplayTrack.createReplacement(item, baseUrl);

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
    async afterActionsOnSelectedItems(force = false) {
      try {
        // Refetch all playlists to update the cache but don't update the main playlist UI
        if (force) {
          this.playlistsCache = await this.ytMusicAPI.getPlaylists(false);
        }
        
        const playlistId = this.currentSelectedPlaylist?.id;
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

      if (!confirm(MESSAGES.ACTIONS.REPLACE_CONFIRM(selectedItems.length))) {
        return;
      }

      try {
        this.beforeActionsOnSelectedItems();
        this.ui.setProgressText(MESSAGES.ACTIONS.REPLACING_SELECTED);

        const playlistId = this.currentSelectedPlaylist?.id || 
                          this.ytMusicAPI.getCurrentPlaylistIdFromURL();

        if (!playlistId) return;

        const itemsWithReplacement = selectedItems.filter(item => item.replacementMedia?.videoId);
        const videoIdsToAdd = itemsWithReplacement.map(item => item.replacementMedia.videoId);
        const itemsToRemove = itemsWithReplacement
          .filter(item => item.originalMedia.videoId && item.originalMedia.playlistSetVideoId)
          .map(item => ({
            videoId: item.originalMedia.videoId,
            setVideoId: item.originalMedia.playlistSetVideoId
          }));

        let success = true;
        if (videoIdsToAdd.length > 0) {
          try {
            // Bulk add replacements
            const addSuccess = await this.ytMusicAPI.addItemsToPlaylist(playlistId, videoIdsToAdd);
            
            if (addSuccess) {
              // Only remove originals if adding replacements succeeded
              if (itemsToRemove.length > 0) {
                const removeSuccess = await this.ytMusicAPI.removeItemsFromPlaylist(playlistId, itemsToRemove);
                if (!removeSuccess) {
                  success = false;
                }
              }

              // Update UI for items that were processed (even if removal failed, addition succeeded)
              itemsWithReplacement.forEach(item => {
                UIHelper.removeMediaGridRow(item.originalMedia);
              });
            } else {
              success = false;
            }
          } catch (error) {
            success = false;
          }
        }

        if (!success) {
          this.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('replacing'));
        } else {
          const countReplaced = videoIdsToAdd.length;
          this.ui.setProgressText(countReplaced > 0 ? MESSAGES.ACTIONS.REPLACE_COMPLETE(countReplaced) : MESSAGES.ACTIONS.NO_REPLACEMENTS_MADE);
        }
      } catch (error) {
        this.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('replacing'));
      } finally {
        await this.afterActionsOnSelectedItems(true);
      }
    }

    /**
     * Adds selected items to the playlist
     */
    async addSelectedItems() {
      const selectedItems = UIHelper.getSelectedMediaItems();
      if (selectedItems.length === 0) return;

      this.beforeActionsOnSelectedItems();
      this.ui.setProgressText(MESSAGES.ACTIONS.ADDING_SELECTED);

      try {
        const playlistId = this.targetPlaylist?.id || 
                          this.currentSelectedPlaylist?.id ||
                          this.ytMusicAPI.getCurrentPlaylistIdFromURL();

        if (!playlistId) return;

        const targetTitle = this.targetPlaylist?.title || this.currentSelectedPlaylist?.title || CONSTANTS.UI.STRINGS.PLAYLIST_FALLBACK;
        
        const videoIdsToAdd = selectedItems
          .filter(item => item.replacementMedia?.videoId)
          .map(item => item.replacementMedia.videoId);

        if (videoIdsToAdd.length > 0) {
          try {
            const addSuccess = await this.ytMusicAPI.addItemsToPlaylist(playlistId, videoIdsToAdd);
            
            if (addSuccess) {
              // Remove added items from the UI
              selectedItems.forEach(item => {
                if (item.replacementMedia?.videoId) {
                  UIHelper.removeMediaGridRow(item.originalMedia);
                }
              });
              this.ui.setProgressText(MESSAGES.ACTIONS.ADD_COMPLETE(videoIdsToAdd.length, targetTitle));
            } else {
              this.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('adding'));
            }
          } catch (error) {
            this.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('adding'));
          }
        } else {
          this.ui.setProgressText(MESSAGES.ACTIONS.NO_ADDITIONS_MADE);
        }
      } catch (error) {
        this.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('adding'));
      } finally {
        await this.afterActionsOnSelectedItems(true);
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
        this.ui.setProgressText(MESSAGES.ACTIONS.REMOVING_SELECTED);

        const playlistId = this.currentSelectedPlaylist?.id || 
                          this.ytMusicAPI.getCurrentPlaylistIdFromURL();

        if (!playlistId) return;

        const itemsToRemove = selectedItems
          .filter(item => item.originalMedia.videoId && item.originalMedia.playlistSetVideoId)
          .map(item => ({
            videoId: item.originalMedia.videoId,
            setVideoId: item.originalMedia.playlistSetVideoId
          }));

        if (itemsToRemove.length > 0) {
          try {
            const removeSuccess = await this.ytMusicAPI.removeItemsFromPlaylist(playlistId, itemsToRemove);
            
            if (removeSuccess) {
              // Update UI
              selectedItems.forEach(item => {
                UIHelper.removeMediaGridRow(item.originalMedia);
              });
              this.ui.setProgressText(MESSAGES.ACTIONS.REMOVAL_COMPLETE(itemsToRemove.length));
            } else {
              this.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('removing'));
            }
          } catch (error) {
            this.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('removing'));
          }
        } else {
          this.ui.setProgressText(MESSAGES.ACTIONS.NO_REMOVALS);
        }
      } catch (error) {
        this.ui.setProgressText(MESSAGES.ACTIONS.ERROR_OCCURRED('removing'));
      } finally {
        await this.afterActionsOnSelectedItems(true);
      }
    }

    async findReplacementsForLocalTracks() {
      if (!this.localTracks || this.localTracks.length === 0) return;
      this.session.isCancelled = false;
      
      const allCheckboxes = document.querySelectorAll(CONSTANTS.UI.SELECTORS.ITEMS_GRID_CHECKBOXES);
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
  const interceptor = new AuthInterceptor(
    (token) => {
      window.bridgeInstance?.setAuthToken(token);
    },
    () => !window.bridgeInstance?.ytMusicAPI.isAuthTokenSet()
  );
  interceptor.start();
})();
