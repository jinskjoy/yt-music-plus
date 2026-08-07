import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../../scripts/bridge.js';
import { CONSTANTS } from '../../utils/constants.js';
import { MESSAGES } from '../../utils/ui-messages.js';
import { UIHelper } from '../../utils/ui-helper.js';
import fs from 'fs';
import path from 'path';

const originalFetch = window.fetch;
const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

describe('Bridge Script Unit Tests', () => {
  let bridge;

  beforeEach(() => {
    // Load DOM HTML
    const htmlPath = path.resolve(__dirname, '../../html/in-site-popup.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = `<div id="yt-music-plus-popup" class="yt-music-plus-root">${htmlContent}</div>`;

    // The IIFE sets window.bridgeInstance
    bridge = window.bridgeInstance;

    // Reset the popup cache between runs since DOM is cleared/rebuilt
    bridge.popupElements = {
      holder: null,
      container: null,
      minimizeBtn: null,
      header: null
    };
    
    // Clear and mock nested methods/APIs as needed
    vi.spyOn(bridge.ytMusicAPI, 'addItemsToPlaylist').mockResolvedValue(true);
    vi.spyOn(bridge.ytMusicAPI, 'removeItemsFromPlaylist').mockResolvedValue(true);
    vi.spyOn(bridge.ytMusicAPI, 'getPlaylistItems').mockResolvedValue([{ name: 'Track 1', videoId: 'v1' }]);
    vi.spyOn(bridge.ytMusicAPI, 'getCurrentPlaylistIdFromURL').mockReturnValue('src123');
    vi.spyOn(bridge.ytMusicAPI, 'isAuthTokenSet').mockReturnValue(true);
    vi.spyOn(bridge.ytMusicAPI, 'setAuthToken').mockImplementation(() => {});
    vi.spyOn(bridge.ytMusicAPI, 'getPlaylists').mockResolvedValue([{ id: 'src123', title: 'Source Playlist', isEditable: true }]);
    
    vi.spyOn(bridge.ui, 'setTargetModalVisibility').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'updatePopupTitle').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'setProgressText').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'displayTargetPlaylists').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'displayPlaylistsForSelection').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'hidePlaylistLoadingIndicator').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'initRefreshButton').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'toggleTargetSearchProgress').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'toggleSearchProgress').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'updateTargetPlaylistDisplay').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'setPlaylistScreenVisibility').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'clearActiveButtons').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'setListOnlyMode').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'clearPlaylistItemsContainer').mockImplementation(() => {});
    
    vi.spyOn(bridge, 'initPlaylistFetching');
    vi.spyOn(bridge, 'beforeActionsOnSelectedItems');
    vi.spyOn(bridge, 'afterActionsOnSelectedItems');
    vi.spyOn(bridge, 'sleep').mockResolvedValue();
    
    // Mock UIHelper.getSelectedMediaItems
    vi.spyOn(UIHelper, 'getSelectedMediaItems').mockReturnValue([
      {
        originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
        replacementMedia: { videoId: 'rep123' }
      }
    ]);
    vi.spyOn(UIHelper, 'removeMediaGridRow').mockImplementation(() => {});
    
    // Reset state to avoid test state pollution (since bridgeInstance is a singleton)
    bridge.currentSelectedPlaylist = { id: 'src123', title: 'Source Playlist' };
    bridge.targetPlaylist = { id: 'src123', title: 'Source Playlist' };
    bridge.isMovingTracks = false;
    bridge.tracksToMove = null;
    bridge.isCopyingTracks = false;
    bridge.tracksToCopy = null;
    bridge.extSettings = null;

    // Stub confirm globally
    vi.stubGlobal('confirm', () => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
  });

  // DisplayTrack Class Tests
  describe('DisplayTrack Class', () => {
    it('should correctly construct a DisplayTrack instance', () => {
      const trackObj = {
        name: 'My Track',
        artist: 'Artist A',
        album: 'Album A',
        thumbnail: 'thumb.jpg',
        videoId: 'vid123',
        playlistSetVideoId: 'set456',
        isChecked: true
      };
      
      const instance = new bridge.DisplayTrack(trackObj, 'https://music.youtube.com/watch?v=');
      expect(instance.name).toBe('My Track');
      expect(instance.artist).toBe('Artist A');
      expect(instance.album).toBe('Album A');
      expect(instance.url).toBe('https://music.youtube.com/watch?v=vid123');
      expect(instance.isChecked).toBe(true);
    });

    it('should handle artists array and fallback matching', () => {
      const trackObj = {
        name: 'My Track',
        artists: ['Artist A', 'Artist B'],
        isGoodMatch: true,
        isDuplicate: true
      };
      
      const instance = new bridge.DisplayTrack(trackObj, 'https://music.youtube.com/watch?v=');
      expect(instance.artist).toBe('Artist A, Artist B');
      expect(instance.isGoodMatch).toBe(true);
      expect(instance.isDuplicate).toBe(true);
    });

    it('should create replacements correctly', () => {
      const replacementFn = bridge.DisplayTrack.createReplacement;
      
      expect(replacementFn(null)).toBeNull();
      expect(replacementFn({ isGeneric: true })).toEqual({ name: 'Ignored (Generic Name)' });
      expect(replacementFn({ isSkipped: true })).toEqual({ name: 'Ignored (Not Selected)' });
      expect(replacementFn({ isSearching: true })).toEqual({ name: 'Waiting for search...', isPending: true, isChecked: true });
      expect(replacementFn({ searchCancelled: true })).toEqual({ name: 'Search cancelled', isCancelled: true });
      
      const originalTrack = {
        replacement: { name: 'New Track', videoId: 'repId' }
      };
      const created = replacementFn(originalTrack, 'https://music.youtube.com/watch?v=');
      expect(created.name).toBe('New Track');
      expect(created.videoId).toBe('repId');
    });
  });

  // SearchSession Class Tests
  describe('SearchSession Class', () => {
    it('should manage search session lifecycle correctly', () => {
      const session = new bridge.SearchSession();
      expect(session.isCancelled).toBe(false);
      expect(session.isActive).toBe(false);
      
      session.start(10);
      expect(session.isActive).toBe(true);
      expect(session.totalItems).toBe(10);
      expect(session.processedItems).toBe(0);
      
      session.updateProgress();
      expect(session.processedItems).toBe(1);
      expect(session.progressText).toBe('Processing track 1 of 10');
      
      session.cancel();
      expect(session.isCancelled).toBe(true);
      
      session.stop();
      expect(session.isActive).toBe(false);
    });
  });

  // AuthInterceptor Class Tests
  describe('AuthInterceptor Class', () => {
    it('should start and stop interception', () => {
      const interceptor = new bridge.AuthInterceptor(vi.fn(), () => true);
      const originalXHR = XMLHttpRequest.prototype.setRequestHeader;
      const originalFetch = window.fetch;
      
      interceptor.start();
      expect(XMLHttpRequest.prototype.setRequestHeader).not.toBe(originalXHR);
      expect(window.fetch).not.toBe(originalFetch);
      
      interceptor.stop();
      expect(XMLHttpRequest.prototype.setRequestHeader).toBe(originalXHR);
      expect(window.fetch).toBe(originalFetch);
    });

    it('should intercept token in XHR setRequestHeader', () => {
      const tokenHandler = vi.fn();
      const interceptor = new bridge.AuthInterceptor(tokenHandler, () => true);
      interceptor.start();

      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://music.youtube.com/api');
      xhr.setRequestHeader('Authorization', 'Bearer token123');

      expect(tokenHandler).toHaveBeenCalledWith('Bearer token123');
      interceptor.stop();
    });

    it('should intercept token in fetch calls', async () => {
      const tokenHandler = vi.fn();
      const interceptor = new bridge.AuthInterceptor(tokenHandler, () => true);
      interceptor.start();

      const request = {
        url: 'https://music.youtube.com/api',
        headers: new Headers({ 'Authorization': 'Bearer token456' })
      };

      // Mock original fetch
      const originalFetch = vi.fn().mockResolvedValue({});
      interceptor.originalFetch = originalFetch;

      await window.fetch(request);

      expect(tokenHandler).toHaveBeenCalledWith('Bearer token456');
      interceptor.stop();
    });

    it('should intercept by default if shouldIntercept is not provided', () => {
      const interceptor = new bridge.AuthInterceptor(vi.fn());
      expect(interceptor.shouldIntercept()).toBe(true);
    });
  });

  // Bridge Lifecycle and Settings Tests
  describe('Bridge Lifecycle and Actions', () => {
    it('should set authorization token', () => {
      bridge.setAuthToken('my-token');
      expect(bridge.ytMusicAPI.setAuthToken).toHaveBeenCalledWith('my-token');
    });

    it('should disable and enable reload', () => {
      bridge.disableReload();
      expect(bridge.isReloadDisabled).toBe(true);

      bridge.enableReload();
      expect(bridge.isReloadDisabled).toBe(false);
    });

    it('should sleep for a given duration', async () => {
      bridge.sleep.mockRestore();
      const start = Date.now();
      await bridge.sleep(10);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(9);
    });

    it('should get and set cancelSearch correctly', () => {
      bridge.cancelSearch = true;
      expect(bridge.cancelSearch).toBe(true);

      bridge.cancelSearch = false;
      expect(bridge.cancelSearch).toBe(false);
    });

    it('should prevent reload when preventUnloadListener is triggered', () => {
      const e = { preventDefault: vi.fn(), returnValue: null };
      bridge.isReloadDisabled = true;
      bridge.preventUnloadListener(e);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(e.returnValue).toBe('');
      
      const e2 = { preventDefault: vi.fn(), returnValue: null };
      bridge.isReloadDisabled = false;
      bridge.preventUnloadListener(e2);
      expect(e2.preventDefault).not.toHaveBeenCalled();
    });

    it('should format original and replacement media correctly', () => {
      const item = {
        name: 'Song A',
        artist: 'Artist A',
        videoId: 'v123',
        replacement: { name: 'Song A (Audio)', videoId: 'v456' }
      };

      const result = bridge._createMediaObjects(item, 'https://music.youtube.com/');
      expect(result.originalMedia.name).toBe('Song A');
      expect(result.replacementMedia.name).toBe('Song A (Audio)');
    });

    it('should handle target selection lifecycle methods', () => {
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      bridge.targetPlaylist = mockTarget;
      bridge.currentSelectedPlaylist = { id: 'src123', title: 'Source Playlist' };

      bridge.finishTargetSelection();

      expect(bridge.isSelectingTarget).toBe(false);
      expect(bridge.ui.setTargetModalVisibility).toHaveBeenCalledWith(false);
      expect(bridge.ui.updateTargetPlaylistDisplay).toHaveBeenCalledWith(mockTarget);
      expect(bridge.ui.updatePopupTitle).toHaveBeenCalledWith('Playlist: Source Playlist');
    });

    it('should execute beforeActionsOnSelectedItems and afterActionsOnSelectedItems', async () => {
      bridge.beforeActionsOnSelectedItems.mockRestore();
      bridge.afterActionsOnSelectedItems.mockRestore();

      vi.spyOn(bridge, 'disableReload').mockImplementation(() => {});
      vi.spyOn(bridge, 'enableReload').mockImplementation(() => {});

      bridge.beforeActionsOnSelectedItems();
      expect(bridge.disableReload).toHaveBeenCalled();
      expect(bridge.ui.toggleSearchProgress).toHaveBeenCalledWith(true, false);

      await bridge.afterActionsOnSelectedItems(true);
      expect(bridge.enableReload).toHaveBeenCalled();
      expect(bridge.ui.toggleSearchProgress).toHaveBeenCalledWith(false);
    });

    it('should toggle popup visibility', () => {
      const holder = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
      holder.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);

      bridge.showPopup();
      expect(holder.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);

      bridge.hidePopup();
      expect(holder.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });

    it('should toggle popup minimized state', () => {
      const holder = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
      const container = holder.querySelector(`.${CONSTANTS.UI.CLASSES.POPUP_CONTAINER}`);
      const btn = holder.querySelector(`#${CONSTANTS.UI.BUTTON_IDS.MINIMIZE_POPUP}`);

      bridge.toggleMinimize();
      expect(container.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)).toBe(true);
      expect(holder.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)).toBe(true);
      expect(btn.textContent).toBe('⤢');

      bridge.toggleMinimize();
      expect(container.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)).toBe(false);
      expect(holder.classList.contains(CONSTANTS.UI.CLASSES.MINIMIZED)).toBe(false);
      expect(btn.textContent).toBe('−');
    });

    it('should initialize playlist fetching with cache', async () => {
      bridge.playlistsCache = [{ id: 'p1', isEditable: true }];
      
      await bridge.initPlaylistFetching(false, true, false);
      expect(bridge.ui.displayPlaylistsForSelection).toHaveBeenCalledWith(
        [{ id: 'p1', isEditable: true }],
        [{ id: 'p1', isEditable: true }]
      );
    });

    it('should fetch playlists when cache is empty', async () => {
      bridge.playlistsCache = [];
      vi.spyOn(bridge.ytMusicAPI, 'getPlaylists').mockResolvedValue([{ id: 'p1', isEditable: true }]);
      
      // Force restore implementation of spy to allow it to run
      bridge.initPlaylistFetching.mockRestore();
      
      await bridge.initPlaylistFetching(true, true, false);
      expect(bridge.ytMusicAPI.getPlaylists).toHaveBeenCalledWith(false);
      expect(bridge.playlistsCache).toEqual([{ id: 'p1', isEditable: true }]);
    });

    it('should initialize target playlist fetching with cache', async () => {
      bridge.playlistsCache = [{ id: 'p1', isEditable: true }];
      
      await bridge.initPlaylistFetching(false, true, true);
      expect(bridge.ui.displayTargetPlaylists).toHaveBeenCalledWith(
        [{ id: 'p1', isEditable: true }],
        [{ id: 'p1', isEditable: true }]
      );
    });

    it('should handle onPlaylistSelected correctly', () => {
      vi.spyOn(UIHelper, 'setPlaylistDetails').mockImplementation(() => {});
      vi.spyOn(UIHelper, 'toggleGrid').mockImplementation(() => {});
      
      const newPlaylist = { id: 'p999', title: 'Selected Playlist' };
      bridge.onPlaylistSelected(newPlaylist);
      
      expect(bridge.currentSelectedPlaylist).toBe(newPlaylist);
      expect(bridge.ui.setPlaylistScreenVisibility).toHaveBeenCalledWith(false);
      expect(bridge.ui.updatePopupTitle).toHaveBeenCalledWith('Playlist: Selected Playlist');
    });

    it('should handle settings messages via window message event', () => {
      const event = new MessageEvent('message', {
        data: {
          type: CONSTANTS.MESSAGE_TYPES.EXT_SETTINGS,
          settings: { showPlaylistButton: false },
          version: '1.9.0'
        },
        source: window
      });
      window.dispatchEvent(event);
      
      expect(bridge.extSettings).toEqual({ showPlaylistButton: false });
      expect(bridge.version).toBe('1.9.0');
    });
  });

  // Action Buttons Tests
  describe('Bridge Bulk Action Operations', () => {
    it('should execute replaceSelectedItems successfully', async () => {
      vi.spyOn(bridge.ytMusicAPI, 'removeItemsFromPlaylist').mockResolvedValue(true);
      vi.spyOn(bridge.ytMusicAPI, 'addItemsToPlaylist').mockResolvedValue(true);
      
      await bridge.replaceSelectedItems();
      
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.REPLACING_SELECTED);
      expect(bridge.ytMusicAPI.removeItemsFromPlaylist).toHaveBeenCalled();
      expect(bridge.ytMusicAPI.addItemsToPlaylist).toHaveBeenCalled();
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.REPLACE_COMPLETE(1));
    });

    it('should execute addSelectedItems successfully', async () => {
      vi.spyOn(bridge.ytMusicAPI, 'addItemsToPlaylist').mockResolvedValue(true);
      
      await bridge.addSelectedItems();
      
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ADDING_SELECTED);
      expect(bridge.ytMusicAPI.addItemsToPlaylist).toHaveBeenCalled();
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ADD_COMPLETE(1, 'Source Playlist'));
    });

    it('should handle addSelectedItems when no video IDs are present', async () => {
      UIHelper.getSelectedMediaItems.mockReturnValue([
        { originalMedia: {}, replacementMedia: {} }
      ]);
      await bridge.addSelectedItems();
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.NO_ADDITIONS_MADE);
    });

    it('should handle addSelectedItems API failure', async () => {
      bridge.ytMusicAPI.addItemsToPlaylist.mockResolvedValue(false);
      await bridge.addSelectedItems();
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ERROR_OCCURRED('adding'));
    });

    it('should execute removeSelectedItems successfully', async () => {
      vi.spyOn(bridge.ytMusicAPI, 'removeItemsFromPlaylist').mockResolvedValue(true);
      
      await bridge.removeSelectedItems();
      
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.REMOVING_SELECTED);
      expect(bridge.ytMusicAPI.removeItemsFromPlaylist).toHaveBeenCalled();
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.REMOVAL_COMPLETE(1));
    });

    it('should abort removeSelectedItems if confirmation is rejected', async () => {
      vi.stubGlobal('confirm', () => false);
      await bridge.removeSelectedItems();
      expect(bridge.ytMusicAPI.removeItemsFromPlaylist).not.toHaveBeenCalled();
    });

    it('should handle removeSelectedItems API failure', async () => {
      bridge.ytMusicAPI.removeItemsFromPlaylist.mockResolvedValue(false);
      await bridge.removeSelectedItems();
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ERROR_OCCURRED('removing'));
    });

    it('should return early in findReplacementsForLocalTracks if localTracks is empty', async () => {
      bridge.localTracks = [];
      vi.spyOn(bridge.processor, 'processPlaylistItems').mockResolvedValue();
      await bridge.findReplacementsForLocalTracks();
      expect(bridge.processor.processPlaylistItems).not.toHaveBeenCalled();
    });

    it('should execute findReplacementsForLocalTracks successfully', async () => {
      bridge.localTracks = [
        { name: 'Track A', isGeneric: false },
        { name: 'Track B', isGeneric: false }
      ];
      vi.spyOn(bridge.processor, 'processPlaylistItems').mockResolvedValue();
      
      const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);

      const row1 = document.createElement('div');
      row1.className = CONSTANTS.UI.CLASSES.GRID_ROW;
      const cb1 = document.createElement('input');
      cb1.type = 'checkbox';
      cb1.checked = true;
      cb1.className = CONSTANTS.UI.CLASSES.ITEM_CHECKBOX;
      row1.appendChild(cb1);

      const row2 = document.createElement('div');
      row2.className = CONSTANTS.UI.CLASSES.GRID_ROW;
      const cb2 = document.createElement('input');
      cb2.type = 'checkbox';
      cb2.checked = false;
      cb2.className = CONSTANTS.UI.CLASSES.ITEM_CHECKBOX;
      row2.appendChild(cb2);

      container.appendChild(row1);
      container.appendChild(row2);
      
      await bridge.findReplacementsForLocalTracks();
      
      expect(bridge.ui.toggleSearchProgress).toHaveBeenCalledWith(true, true);
      expect(bridge.processor.processPlaylistItems).toHaveBeenCalled();
      
      row1.remove();
      row2.remove();
    });
  });

  // Move Selected Tracks Tests
  describe('Bridge Move Operations', () => {
    it('should initialize moving state and open target modal when moveSelectedItems is called', async () => {
      await bridge.moveSelectedItems();

      expect(bridge.isMovingTracks).toBe(true);
      expect(bridge.tracksToMove).toEqual([
        {
          originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
          replacementMedia: { videoId: 'rep123' }
        }
      ]);
      expect(bridge.ui.setTargetModalVisibility).toHaveBeenCalledWith(true);
      expect(bridge.initPlaylistFetching).toHaveBeenCalledWith(false, null, true);
    });

    it('should clear moving states on cancelTargetSelection', () => {
      bridge.isMovingTracks = true;
      bridge.tracksToMove = [{ originalMedia: { videoId: 'vid123' } }];

      bridge.cancelTargetSelection();

      expect(bridge.isMovingTracks).toBe(false);
      expect(bridge.tracksToMove).toBeNull();
    });

    it('should execute move when onTargetPlaylistSelected is called in moving mode', () => {
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      bridge.isMovingTracks = true;
      bridge.tracksToMove = [
        {
          originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
          replacementMedia: null
        }
      ];

      const executeSpy = vi.spyOn(bridge, 'executeMoveSelectedItems').mockResolvedValue();

      bridge.onTargetPlaylistSelected(mockTarget);

      expect(bridge.isMovingTracks).toBe(false);
      expect(bridge.ui.setTargetModalVisibility).toHaveBeenCalledWith(false);
      expect(bridge.ui.updatePopupTitle).toHaveBeenCalledWith('Playlist: Source Playlist');
      expect(executeSpy).toHaveBeenCalledWith(mockTarget, [
        {
          originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
          replacementMedia: null
        }
      ]);
      expect(bridge.tracksToMove).toBeNull();
    });

    it('should successfully add and then remove tracks during executeMoveSelectedItems', async () => {
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      const selectedItems = [
        {
          originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
          replacementMedia: null
        }
      ];

      await bridge.executeMoveSelectedItems(mockTarget, selectedItems);

      expect(bridge.beforeActionsOnSelectedItems).toHaveBeenCalled();
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.MOVING_SELECTED);
      expect(bridge.ytMusicAPI.addItemsToPlaylist).toHaveBeenCalledWith('target999', ['vid123']);
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.REMOVING_SELECTED);
      expect(bridge.ytMusicAPI.removeItemsFromPlaylist).toHaveBeenCalledWith('src123', [
        { videoId: 'vid123', setVideoId: 'set456' }
      ]);
      expect(UIHelper.removeMediaGridRow).toHaveBeenCalledWith({ videoId: 'vid123', playlistSetVideoId: 'set456' });
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.MOVE_COMPLETE(1, 'Target Playlist'));
      expect(bridge.afterActionsOnSelectedItems).toHaveBeenCalledWith(true);
    });

    it('should set error message if addItemsToPlaylist fails', async () => {
      bridge.ytMusicAPI.addItemsToPlaylist.mockResolvedValue(false);
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      const selectedItems = [
        {
          originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
          replacementMedia: null
        }
      ];

      await bridge.executeMoveSelectedItems(mockTarget, selectedItems);

      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ERROR_OCCURRED('moving'));
      expect(bridge.ytMusicAPI.removeItemsFromPlaylist).not.toHaveBeenCalled();
      expect(bridge.afterActionsOnSelectedItems).toHaveBeenCalledWith(true);
    });

    it('should set error message if removeItemsFromPlaylist fails during move', async () => {
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      const selectedItems = [
        {
          originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
          replacementMedia: null
        }
      ];
      bridge.ytMusicAPI.addItemsToPlaylist.mockResolvedValue(true);
      bridge.ytMusicAPI.removeItemsFromPlaylist.mockResolvedValue(false);

      await bridge.executeMoveSelectedItems(mockTarget, selectedItems);

      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ERROR_OCCURRED('removing moved tracks'));
    });

    it('should set error message if removeItemsFromPlaylist throws during move', async () => {
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      const selectedItems = [
        {
          originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
          replacementMedia: null
        }
      ];
      bridge.ytMusicAPI.addItemsToPlaylist.mockResolvedValue(true);
      bridge.ytMusicAPI.removeItemsFromPlaylist.mockRejectedValue(new Error('Network error'));

      await bridge.executeMoveSelectedItems(mockTarget, selectedItems);

      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ERROR_OCCURRED('removing moved tracks'));
    });

    it('should set error message if addItemsToPlaylist throws an error during move', async () => {
      bridge.ytMusicAPI.addItemsToPlaylist.mockRejectedValue(new Error('API failed'));
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      const selectedItems = [
        {
          originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
          replacementMedia: null
        }
      ];

      await bridge.executeMoveSelectedItems(mockTarget, selectedItems);

      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ERROR_OCCURRED('moving'));
    });
  });

  // Copy Selected Tracks Tests
  describe('Bridge Copy Operations', () => {
    it('should initialize copying state and open target modal when copySelectedItems is called', async () => {
      await bridge.copySelectedItems();

      expect(bridge.isCopyingTracks).toBe(true);
      expect(bridge.tracksToCopy).toEqual([
        {
          originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
          replacementMedia: { videoId: 'rep123' }
        }
      ]);
      expect(bridge.ui.setTargetModalVisibility).toHaveBeenCalledWith(true);
      expect(bridge.initPlaylistFetching).toHaveBeenCalledWith(false, null, true);
    });

    it('should do nothing when copySelectedItems is called with no selected items', async () => {
      vi.spyOn(UIHelper, 'getSelectedMediaItems').mockReturnValue([]);
      await bridge.copySelectedItems();

      expect(bridge.isCopyingTracks).toBe(false);
      expect(bridge.tracksToCopy).toBeNull();
      expect(bridge.ui.setTargetModalVisibility).not.toHaveBeenCalled();
    });

    it('should clear copying states on cancelTargetSelection', () => {
      bridge.isCopyingTracks = true;
      bridge.tracksToCopy = [{ originalMedia: { videoId: 'vid123' } }];

      bridge.cancelTargetSelection();

      expect(bridge.isCopyingTracks).toBe(false);
      expect(bridge.tracksToCopy).toBeNull();
    });

    it('should execute copy when onTargetPlaylistSelected is called in copying mode', () => {
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      bridge.isCopyingTracks = true;
      bridge.tracksToCopy = [
        {
          originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
          replacementMedia: null
        }
      ];

      const executeSpy = vi.spyOn(bridge, 'executeCopySelectedItems').mockResolvedValue();

      bridge.onTargetPlaylistSelected(mockTarget);

      expect(bridge.isCopyingTracks).toBe(false);
      expect(bridge.ui.setTargetModalVisibility).toHaveBeenCalledWith(false);
      expect(bridge.ui.updatePopupTitle).toHaveBeenCalledWith('Playlist: Source Playlist');
      expect(executeSpy).toHaveBeenCalledWith(mockTarget, [
        {
          originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
          replacementMedia: null
        }
      ]);
      expect(bridge.tracksToCopy).toBeNull();
    });

    it('should successfully add tracks and not remove items from source during executeCopySelectedItems', async () => {
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      const selectedItems = [
        {
          originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
          replacementMedia: null
        }
      ];
      bridge.ytMusicAPI.addItemsToPlaylist.mockResolvedValue(true);

      await bridge.executeCopySelectedItems(mockTarget, selectedItems);

      expect(bridge.beforeActionsOnSelectedItems).toHaveBeenCalled();
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.COPYING_SELECTED);
      expect(bridge.ytMusicAPI.addItemsToPlaylist).toHaveBeenCalledWith('target999', ['vid123']);
      expect(bridge.ytMusicAPI.removeItemsFromPlaylist).not.toHaveBeenCalled();
      expect(UIHelper.removeMediaGridRow).not.toHaveBeenCalled();
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.COPY_COMPLETE(1, 'Target Playlist'));
      expect(bridge.afterActionsOnSelectedItems).toHaveBeenCalledWith(true);
    });

    it('should set NO_ADDITIONS_MADE if no valid videoIds present during executeCopySelectedItems', async () => {
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      const selectedItems = [{ originalMedia: {} }];

      await bridge.executeCopySelectedItems(mockTarget, selectedItems);

      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.NO_ADDITIONS_MADE);
      expect(bridge.ytMusicAPI.addItemsToPlaylist).not.toHaveBeenCalled();
    });

    it('should set error message if addItemsToPlaylist fails during executeCopySelectedItems', async () => {
      bridge.ytMusicAPI.addItemsToPlaylist.mockResolvedValue(false);
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      const selectedItems = [
        {
          originalMedia: { videoId: 'vid123' },
          replacementMedia: null
        }
      ];

      await bridge.executeCopySelectedItems(mockTarget, selectedItems);

      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ERROR_OCCURRED('copying tracks'));
      expect(bridge.afterActionsOnSelectedItems).toHaveBeenCalledWith(true);
    });

    it('should set error message if addItemsToPlaylist throws an error during executeCopySelectedItems', async () => {
      bridge.ytMusicAPI.addItemsToPlaylist.mockRejectedValue(new Error('API failed'));
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      const selectedItems = [
        {
          originalMedia: { videoId: 'vid123' },
          replacementMedia: null
        }
      ];

      await bridge.executeCopySelectedItems(mockTarget, selectedItems);

      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ERROR_OCCURRED('copying tracks'));
    });

    it('should set NO_ADDITIONS_MADE when no videoIds present in executeMoveSelectedItems', async () => {
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      const selectedItems = [{ originalMedia: {} }];

      await bridge.executeMoveSelectedItems(mockTarget, selectedItems);
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.NO_ADDITIONS_MADE);
    });

    it('should complete move when itemsToRemove is empty in executeMoveSelectedItems', async () => {
      bridge.ytMusicAPI.addItemsToPlaylist.mockResolvedValue(true);
      const mockTarget = { id: 'target999', title: 'Target Playlist' };
      // item has videoId and playlistSetVideoId for videoIdsToAdd, but empty itemsToRemove filter
      const selectedItems = [{ originalMedia: { videoId: 'v1', playlistSetVideoId: 's1' } }];
      // Mock filter inside itemsToRemove to return empty
      vi.spyOn(selectedItems, 'filter').mockImplementationOnce(() => [{ originalMedia: { videoId: 'v1', playlistSetVideoId: 's1' } }])
                                      .mockImplementationOnce(() => []);

      await bridge.executeMoveSelectedItems(mockTarget, selectedItems);
      expect(bridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.MOVE_COMPLETE(1, 'Target Playlist'));
    });

    it('should return early if executeCopySelectedItems is called with empty items or invalid target', async () => {
      await bridge.executeCopySelectedItems({ id: 't1' }, []);
      expect(bridge.beforeActionsOnSelectedItems).not.toHaveBeenCalled();

    });
  });

  describe('Global Interceptors and DOM Events', () => {
    it('should ignore setAuthToken if token is invalid or matches failedToken', () => {
      bridge.ytMusicAPI.setAuthToken = vi.fn(function(t) { this.authToken = t; });
      bridge.setAuthToken(null);
      expect(bridge.ytMusicAPI.authToken).toBeNull();

      bridge.failedToken = 'Bearer old-failed-token';
      bridge.setAuthToken('Bearer old-failed-token');
      expect(bridge.failedToken).toBe('Bearer old-failed-token');

      bridge.setAuthToken('Bearer brand-new-token');
      expect(bridge.failedToken).toBeNull();
      expect(bridge.ytMusicAPI.authToken).toBe('Bearer brand-new-token');
    });

    it('should intercept token and call setAuthToken using the global interceptor', async () => {
      bridge.ytMusicAPI.isAuthTokenSet.mockReturnValue(false);
      const setAuthTokenSpy = vi.spyOn(bridge, 'setAuthToken');
      
      const request = {
        url: 'https://music.youtube.com/api',
        headers: new Headers({ 'Authorization': 'Bearer test-token-123' })
      };
      await window.fetch(request).catch(() => {});
      
      expect(setAuthTokenSpy).toHaveBeenCalledWith('Bearer test-token-123');
    });

    it('should handle navigation event listener', () => {
      const mockNav = {
        addEventListener: vi.fn()
      };
      vi.stubGlobal('navigation', mockNav);
      
      const testBridge = new window.bridgeInstance.constructor();
      testBridge.setAuthToken('token');
      
      expect(mockNav.addEventListener).toHaveBeenCalledWith('navigate', expect.any(Function));
    });

    it('should trigger hidePopup when close button is clicked', () => {
      bridge.setAuthToken('token');
      const hideSpy = vi.spyOn(bridge, 'hidePopup').mockImplementation(() => {});
      
      const closeBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.CLOSE_POPUP);
      closeBtn.click();
      
      expect(hideSpy).toHaveBeenCalled();
    });

    it('should trigger toggleMinimize when minimize button is clicked', () => {
      bridge.setAuthToken('token');
      const minimizeSpy = vi.spyOn(bridge, 'toggleMinimize').mockImplementation(() => {});
      
      const minBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.MINIMIZE_POPUP);
      minBtn.click();
      
      expect(minimizeSpy).toHaveBeenCalled();
    });

    it('should trigger toggleMinimize when backdrop (holder) is clicked', () => {
      bridge.setAuthToken('token');
      const minimizeSpy = vi.spyOn(bridge, 'toggleMinimize').mockImplementation(() => {});
      
      const holder = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_HOLDER);
      holder.click();
      
      expect(minimizeSpy).toHaveBeenCalled();
    });

    it('should trigger hidePopup when Escape key is pressed', () => {
      bridge.setAuthToken('token');
      const hideSpy = vi.spyOn(bridge, 'hidePopup').mockImplementation(() => {});
      
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);
      
      expect(hideSpy).toHaveBeenCalled();
    });

    it('should trigger processor.findUnavailableTracks when find unavailable button is clicked', () => {
      bridge.setAuthToken('token');
      const findSpy = vi.spyOn(bridge.processor, 'findUnavailableTracks').mockImplementation(() => {});
      
      const btn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_UNAVAILABLE);
      btn.click();
      
      expect(findSpy).toHaveBeenCalled();
    });

    it('should trigger importFromFile when file input changes', () => {
      bridge.setAuthToken('token');
      const importSpy = vi.spyOn(bridge.processor, 'importFromFile').mockImplementation(() => {});
      
      const input = document.getElementById(CONSTANTS.UI.BUTTON_IDS.IMPORT_FILE_INPUT);
      const changeEvent = new Event('change');
      input.dispatchEvent(changeEvent);
      
      expect(importSpy).toHaveBeenCalled();
    });

    it('should select playlist from cache when showPopup is called and current playlist is in cache', async () => {
      bridge.playlistsCache = [{ id: 'src123', title: 'Source Playlist' }];
      bridge.ytMusicAPI.getCurrentPlaylistIdFromURL.mockReturnValue('src123');
      const selectSpy = vi.spyOn(bridge, 'onPlaylistSelected').mockImplementation(() => {});
      
      await bridge.showPopup();
      
      expect(selectSpy).toHaveBeenCalledWith({ id: 'src123', title: 'Source Playlist' });
    });

    it('should trigger navigation callback', () => {
      let navigateCallback;
      const mockNav = {
        addEventListener: vi.fn((event, cb) => {
          if (event === 'navigate') {
            navigateCallback = cb;
          }
        })
      };
      vi.stubGlobal('navigation', mockNav);
      
      const testBridge = new window.bridgeInstance.constructor();
      testBridge.setAuthToken('token');
      
      expect(mockNav.addEventListener).toHaveBeenCalledWith('navigate', expect.any(Function));
      
      const mockEvent = {
        navigationType: 'push',
        destination: {
          url: 'https://music.youtube.com/playlist?list=123'
        }
      };
      
      vi.useFakeTimers();
      const injectSpy = vi.spyOn(testBridge.ui, 'injectActionButtons');
      const showSpy = vi.spyOn(testBridge.ui, 'showTriggerButtons');
      
      navigateCallback(mockEvent);
      
      vi.runAllTimers();
      
      expect(injectSpy).toHaveBeenCalled();
      expect(showSpy).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should trigger showPopup when navBarBtn is clicked', () => {
      const navBtn = document.createElement('button');
      navBtn.id = CONSTANTS.UI.ELEMENT_IDS.NAV_BTN;
      document.body.appendChild(navBtn);
      
      bridge.setAuthToken('token');
      const showPopupSpy = vi.spyOn(bridge, 'showPopup').mockResolvedValue();
      
      navBtn.click();
      
      expect(showPopupSpy).toHaveBeenCalled();
      navBtn.remove();
    });

    it('should trigger click handlers for all buttons and call appropriate methods', () => {
      bridge.setAuthToken('token');

      // Enable all buttons to ensure click events fire correctly in the DOM environment
      const buttons = document.querySelectorAll('button');
      buttons.forEach(btn => btn.removeAttribute('disabled'));
      
      const spyFindVideo = vi.spyOn(bridge.processor, 'findVideoTracks').mockImplementation(() => {});
      const spyFindDuplicate = vi.spyOn(bridge.processor, 'findDuplicateTracks').mockImplementation(() => {});
      const spyKeepOnly = vi.spyOn(bridge.processor, 'keepOnlySelected').mockImplementation(() => {});
      const spyReplace = vi.spyOn(bridge, 'replaceSelectedItems').mockResolvedValue();
      const spyAdd = vi.spyOn(bridge, 'addSelectedItems').mockResolvedValue();
      const spyRemove = vi.spyOn(bridge, 'removeSelectedItems').mockResolvedValue();
      const spyMove = vi.spyOn(bridge, 'moveSelectedItems').mockResolvedValue();
      const spyImportFolder = vi.spyOn(bridge.processor, 'importFromFolder').mockImplementation(() => {});
      const spyFindLocal = vi.spyOn(bridge, 'findReplacementsForLocalTracks').mockResolvedValue();
      const spyListAll = vi.spyOn(bridge.processor, 'listAllTracks').mockImplementation(() => {});
      const spyShowTarget = vi.spyOn(bridge, 'showPlaylistSelectionForTarget').mockResolvedValue();
      const spyCancelTarget = vi.spyOn(bridge, 'cancelTargetSelection').mockImplementation(() => {});

      // Click each button
      document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_VIDEO_TRACKS).click();
      expect(spyFindVideo).toHaveBeenCalled();

      document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_DUPLICATE_TRACKS).click();
      expect(spyFindDuplicate).toHaveBeenCalled();

      document.getElementById(CONSTANTS.UI.BUTTON_IDS.KEEP_ONLY_SELECTED).click();
      expect(spyKeepOnly).toHaveBeenCalled();

      document.getElementById(CONSTANTS.UI.BUTTON_IDS.REPLACE_SELECTED).click();
      expect(spyReplace).toHaveBeenCalled();

      document.getElementById(CONSTANTS.UI.BUTTON_IDS.ADD_SELECTED).click();
      expect(spyAdd).toHaveBeenCalled();

      document.getElementById(CONSTANTS.UI.BUTTON_IDS.REMOVE_SELECTED).click();
      expect(spyRemove).toHaveBeenCalled();

      document.getElementById(CONSTANTS.UI.BUTTON_IDS.MOVE_SELECTED).click();
      expect(spyMove).toHaveBeenCalled();

      document.getElementById(CONSTANTS.UI.BUTTON_IDS.IMPORT_FROM_FOLDER).click();
      expect(spyImportFolder).toHaveBeenCalled();

      document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_LOCAL_REPLACEMENTS).click();
      expect(spyFindLocal).toHaveBeenCalled();

      document.getElementById(CONSTANTS.UI.BUTTON_IDS.LIST_ALL_TRACKS).click();
      expect(spyListAll).toHaveBeenCalled();

      document.getElementById(CONSTANTS.UI.BUTTON_IDS.SELECT_TARGET_PLAYLIST).click();
      expect(spyShowTarget).toHaveBeenCalled();

      document.getElementById(CONSTANTS.UI.BUTTON_IDS.CANCEL_TARGET_SELECTION).click();
      expect(spyCancelTarget).toHaveBeenCalled();
      
      const cancelBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.CANCEL_SEARCH);
      if (cancelBtn) {
        cancelBtn.click();
        expect(bridge.cancelSearch).toBe(true);
      }
    });

    describe('token expiration handling in Bridge', () => {
      it('should detect token expired errors correctly', () => {
        expect(bridge.isTokenExpiredError({ status: 401 })).toBe(true);
        expect(bridge.isTokenExpiredError({ status: 403 })).toBe(true);
        expect(bridge.isTokenExpiredError(new Error('Permission error 403'))).toBe(true);
        expect(bridge.isTokenExpiredError(new Error('Normal error'))).toBe(false);
      });

      it('should set isWaitingForToken and show modal on handleTokenExpired', () => {
        const spyModal = vi.spyOn(bridge.ui, 'setTokenExpiredModalVisibility').mockImplementation(() => {});
        const spyText = vi.spyOn(bridge.ui, 'setProgressText').mockImplementation(() => {});
        const actionFn = vi.fn();

        bridge.handleTokenExpired(actionFn);

        expect(bridge.isWaitingForToken).toBe(true);
        expect(spyModal).toHaveBeenCalledWith(true);
        expect(spyText).toHaveBeenCalledWith(MESSAGES.ERRORS.TOKEN_EXPIRED_MSG);
      });

      it('should clear pendingAction and hide modal on cancelTokenRefresh', () => {
        const spyModal = vi.spyOn(bridge.ui, 'setTokenExpiredModalVisibility').mockImplementation(() => {});
        const spyText = vi.spyOn(bridge.ui, 'setProgressText').mockImplementation(() => {});
        bridge.pendingAction = () => {};

        bridge.cancelTokenRefresh();

        expect(bridge.pendingAction).toBeNull();
        expect(spyModal).toHaveBeenCalledWith(false);
        expect(spyText).toHaveBeenCalledWith('Operation cancelled.');
      });

      it('should notify user to retry action and hide modal when setAuthToken is called with new token', () => {
        const spyModal = vi.spyOn(bridge.ui, 'setTokenExpiredModalVisibility').mockImplementation(() => {});
        const spyText = vi.spyOn(bridge.ui, 'setProgressText').mockImplementation(() => {});
        bridge.isWaitingForToken = true;

        bridge.setAuthToken('new-token-abc');

        expect(bridge.ytMusicAPI.setAuthToken).toHaveBeenCalledWith('new-token-abc');
        expect(spyModal).toHaveBeenCalledWith(false);
        expect(spyText).toHaveBeenCalledWith(MESSAGES.ERRORS.TOKEN_FETCHED_RESUMING);
      });

      it('should attempt token refresh by dispatching click event on available selectors', () => {
        const logo = document.createElement('div');
        logo.id = 'logo';
        const clickSpy = vi.fn();
        logo.addEventListener('click', clickSpy);
        document.body.appendChild(logo);

        bridge.attemptTokenRefresh();

        expect(clickSpy).toHaveBeenCalled();
        logo.remove();
      });

      it('should handle token expiration during replaceSelectedItems', async () => {
        const selectedItems = [{
          originalMedia: { videoId: 'v1', playlistSetVideoId: 's1' },
          replacementMedia: { videoId: 'v2' }
        }];
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(UIHelper, 'getSelectedMediaItems').mockReturnValue(selectedItems);
        const err = new Error('401 Unauthorized');
        err.status = 401;
        vi.spyOn(bridge.ytMusicAPI, 'addItemsToPlaylist').mockRejectedValue(err);
        const handleSpy = vi.spyOn(bridge, 'handleTokenExpired').mockImplementation(() => {});

        await bridge.replaceSelectedItems();

        expect(handleSpy).toHaveBeenCalled();
      });

      it('should handle token expiration during addSelectedItems', async () => {
        const selectedItems = [{ replacementMedia: { videoId: 'v2' } }];
        vi.spyOn(UIHelper, 'getSelectedMediaItems').mockReturnValue(selectedItems);
        const err = new Error('403 Forbidden');
        err.status = 403;
        vi.spyOn(bridge.ytMusicAPI, 'addItemsToPlaylist').mockRejectedValue(err);
        const handleSpy = vi.spyOn(bridge, 'handleTokenExpired').mockImplementation(() => {});

        await bridge.addSelectedItems();

        expect(handleSpy).toHaveBeenCalled();
      });

      it('should handle token expiration during removeSelectedItems', async () => {
        const selectedItems = [{ originalMedia: { videoId: 'v1', playlistSetVideoId: 's1' } }];
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(UIHelper, 'getSelectedMediaItems').mockReturnValue(selectedItems);
        const err = new Error('401 Token expired');
        err.status = 401;
        vi.spyOn(bridge.ytMusicAPI, 'removeItemsFromPlaylist').mockRejectedValue(err);
        const handleSpy = vi.spyOn(bridge, 'handleTokenExpired').mockImplementation(() => {});

        await bridge.removeSelectedItems();

        expect(handleSpy).toHaveBeenCalled();
      });

      it('should handle token expiration during executeMoveSelectedItems', async () => {
        const selectedItems = [{ originalMedia: { videoId: 'v1', playlistSetVideoId: 's1' } }];
        const err = new Error('401 Token expired');
        err.status = 401;
        vi.spyOn(bridge.ytMusicAPI, 'addItemsToPlaylist').mockRejectedValue(err);
        const handleSpy = vi.spyOn(bridge, 'handleTokenExpired').mockImplementation(() => {});

        await bridge.executeMoveSelectedItems({ id: 'target1' }, selectedItems);

        expect(handleSpy).toHaveBeenCalled();
      });

      it('should handle token expiration during executeCopySelectedItems', async () => {
        const selectedItems = [{ originalMedia: { videoId: 'v1' } }];
        const err = new Error('403 Forbidden');
        err.status = 403;
        vi.spyOn(bridge.ytMusicAPI, 'addItemsToPlaylist').mockRejectedValue(err);
        const handleSpy = vi.spyOn(bridge, 'handleTokenExpired').mockImplementation(() => {});

        await bridge.executeCopySelectedItems({ id: 'target1' }, selectedItems);

        expect(handleSpy).toHaveBeenCalled();
      });
    });
  });
});
