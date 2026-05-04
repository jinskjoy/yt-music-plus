import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackProcessor } from '../../scripts/track-processor.js';
import { Track } from '../../scripts/models/track.js';
import { CONSTANTS } from '../../utils/constants.js';
import { MESSAGES } from '../../utils/ui-messages.js';
import { UIHelper } from '../../utils/ui-helper.js';

describe('TrackProcessor Coverage', () => {
  let processor;
  let mockBridge;
  let mockYTMusicAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(UIHelper, 'updateCheckAllCheckbox').mockImplementation(() => {});
    vi.spyOn(UIHelper, 'removeMediaGridRow').mockImplementation(() => {});

    mockYTMusicAPI = {
      getPlaylistItems: vi.fn(),
      getCurrentPlaylistIdFromURL: vi.fn(() => 'PL123'),
      searchMusic: vi.fn(),
      getBestSearchResult: vi.fn(),
      removeItemsFromPlaylist: vi.fn(),
      addItemToPlaylist: vi.fn()
    };

    mockBridge = {
      ytMusicAPI: mockYTMusicAPI,
      session: {
        isCancelled: false,
        start: vi.fn(),
        stop: vi.fn(),
        updateProgress: vi.fn(),
        progressText: '50%'
      },
      ui: {
        clearPlaylistItemsContainer: vi.fn(),
        updateViewMode: vi.fn(),
        toggleSearchProgress: vi.fn(),
        setProgressText: vi.fn(),
        addItem: vi.fn().mockReturnValue(document.createElement('div')),
        addItems: vi.fn().mockResolvedValue(),
        updateItemRow: vi.fn()
      },
      currentSelectedPlaylist: { id: 'PL123' },
      sleep: vi.fn().mockResolvedValue(),
      beforeActionsOnSelectedItems: vi.fn(),
      afterActionsOnSelectedItems: vi.fn()
    };

    processor = new TrackProcessor(mockBridge);
    document.body.innerHTML = '';
  });

  describe('findUnavailableTracks', () => {
    it('should handle no tracks found', async () => {
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([]);
      await processor.findUnavailableTracks();
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.NO_TRACKS_FOUND);
    });

    it('should process unavailable tracks', async () => {
      const items = [
        new Track({ name: 'T1', isGreyedOut: true }),
        new Track({ name: 'T2', isGreyedOut: false })
      ];
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue(items);
      vi.spyOn(processor, 'processPlaylistItems').mockResolvedValue();

      await processor.findUnavailableTracks();

      expect(processor.processPlaylistItems).toHaveBeenCalledWith([items[0]]);
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.FOUND_TRACKS(1));
    });

    it('should handle no unavailable tracks', async () => {
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([new Track({ name: 'T1', isGreyedOut: false })]);
      await processor.findUnavailableTracks();
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.NO_UNAVAILABLE_FOUND);
    });
    
    it('should handle API errors', async () => {
       mockYTMusicAPI.getPlaylistItems.mockRejectedValue(new Error('Fail'));
       await processor.findUnavailableTracks();
       expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ERROR_OCCURRED('finding unavailable tracks'));
    });
  });

  describe('findVideoTracks', () => {
    it('should handle no video tracks found', async () => {
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([
        new Track({ name: 'Audio', isVideo: false })
      ]);
      await processor.findVideoTracks();
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.NO_VIDEO_TRACKS_FOUND);
    });

    it('should process video tracks and find replacements', async () => {
      const videoTrack = new Track({ name: 'Video', isVideo: true });
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([videoTrack]);
      mockYTMusicAPI.searchMusic.mockResolvedValue({ results: [] });
      mockYTMusicAPI.getBestSearchResult.mockReturnValue({ videoId: 'v1', isGoodMatch: true });

      await processor.findVideoTracks();

      expect(mockBridge.ui.addItems).toHaveBeenCalled();
      expect(mockYTMusicAPI.searchMusic).toHaveBeenCalledWith(videoTrack);
      expect(videoTrack.replacement.videoId).toBe('v1');
      expect(mockBridge.ui.updateItemRow).toHaveBeenCalled();
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('Found 1 video tracks'));
    });

    it('should handle search errors for video tracks', async () => {
      const videoTrack = new Track({ name: 'Video', isVideo: true });
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([videoTrack]);
      mockYTMusicAPI.searchMusic.mockRejectedValue(new Error('Search failed'));

      await processor.findVideoTracks();

      expect(videoTrack.replacement).toBeNull();
      expect(mockBridge.ui.updateItemRow).toHaveBeenCalled();
    });

    it('should handle cancellation during video track search', async () => {
      const videoTrack1 = new Track({ name: 'V1', isVideo: true });
      const videoTrack2 = new Track({ name: 'V2', isVideo: true });
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([videoTrack1, videoTrack2]);
      
      mockYTMusicAPI.searchMusic.mockImplementation(async () => {
        mockBridge.session.isCancelled = true;
        return {};
      });

      await processor.findVideoTracks();

      expect(videoTrack2.searchCancelled).toBe(true);
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.SEARCH.CANCELLING);
    });
    
    it('should handle API errors in findVideoTracks', async () => {
       mockYTMusicAPI.getPlaylistItems.mockRejectedValue(new Error('Fail'));
       await processor.findVideoTracks();
       expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ERROR_OCCURRED('finding video tracks'));
    });
  });

  describe('recheckDuplicates', () => {
    it('should return if no items grid found', async () => {
      await processor.recheckDuplicates();
      expect(mockBridge.ui.toggleSearchProgress).not.toHaveBeenCalled();
    });

    it('should recheck duplicates for items in the grid', async () => {
      const container = document.createElement('div');
      container.id = CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER;
      
      const row = document.createElement('div');
      row.className = CONSTANTS.UI.CLASSES.GRID_ROW;
      row.dataset.replacementMedia = JSON.stringify({ videoId: 'v1' });
      row.dataset.originalMedia = JSON.stringify({ videoId: 'orig1' });
      row.dataset.serialNumber = '1';
      container.appendChild(row);
      document.body.appendChild(container);

      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([{ videoId: 'v1' }]);
      
      await processor.recheckDuplicates();

      expect(mockBridge.ui.updateItemRow).toHaveBeenCalled();
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.TARGET_DUPLICATES_FOUND(1));
    });

    it('should handle no duplicates found message', async () => {
      const container = document.createElement('div');
      container.id = CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER;
      
      const row = document.createElement('div');
      row.className = CONSTANTS.UI.CLASSES.GRID_ROW;
      row.dataset.replacementMedia = JSON.stringify({ videoId: 'v1' });
      row.dataset.originalMedia = JSON.stringify({ videoId: 'orig1' });
      row.dataset.serialNumber = '1';
      container.appendChild(row);
      document.body.appendChild(container);

      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([]);
      
      await processor.recheckDuplicates();

      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.NO_TARGET_DUPLICATES_FOUND);
    });
  });

  describe('findDuplicateTracks', () => {
    it('should group and display duplicate tracks', async () => {
      const items = [
        new Track({ name: 'Same', videoId: 'v1' }),
        new Track({ name: 'Same', videoId: 'v1' }),
        new Track({ name: 'Unique', videoId: 'v2' })
      ];
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue(items);

      await processor.findDuplicateTracks();

      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.FOUND_DUPLICATE_GROUPS(1, 2));
      expect(mockBridge.ui.addItem).toHaveBeenCalledTimes(2);
    });

    it('should handle no duplicates found', async () => {
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([new Track({ name: 'Unique', videoId: 'v1' })]);
      await processor.findDuplicateTracks();
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.NO_DUPLICATES_FOUND);
    });
    
    it('should handle API errors in findDuplicateTracks', async () => {
       mockYTMusicAPI.getPlaylistItems.mockRejectedValue(new Error('Fail'));
       await processor.findDuplicateTracks();
       expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ERROR_OCCURRED('finding duplicate tracks'));
    });
  });

  describe('listAllTracks', () => {
    it('should list all tracks in the playlist', async () => {
      const items = [new Track({ name: 'T1' }), new Track({ name: 'T2' })];
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue(items);

      await processor.listAllTracks();

      expect(mockBridge.ui.addItems).toHaveBeenCalledWith(items, CONSTANTS.API.BASE_URL);
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.FOUND_TRACKS(2));
    });

    it('should handle empty playlist', async () => {
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([]);
      await processor.listAllTracks();
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.NO_TRACKS_FOUND);
    });

    it('should handle race condition where playlist changed', async () => {
        mockYTMusicAPI.getPlaylistItems.mockResolvedValue([new Track({ name: 'T1' })]);
        
        const listAllPromise = processor.listAllTracks();
        mockBridge.currentSelectedPlaylist = { id: 'PL-NEW' };
        
        await listAllPromise;
        expect(mockBridge.ui.addItems).not.toHaveBeenCalled();
    });
    
    it('should handle API errors in listAllTracks', async () => {
       mockYTMusicAPI.getPlaylistItems.mockRejectedValue(new Error('Fail'));
       await processor.listAllTracks();
       expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.ERROR_OCCURRED('fetching tracks'));
    });
  });

  describe('importFromFolder', () => {
    it('should show error if showDirectoryPicker is not supported', async () => {
      const original = window.showDirectoryPicker;
      delete window.showDirectoryPicker;
      
      await processor.importFromFolder();
      
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('not support'));
      
      window.showDirectoryPicker = original;
    });

    it('should process files from folder', async () => {
      const mockFile = { name: 'test.mp3' };
      const mockEntry = {
        kind: 'file',
        getFile: vi.fn().mockResolvedValue(mockFile)
      };
      const mockDirHandle = {
        values: async function* () { yield mockEntry; }
      };
      
      window.showDirectoryPicker = vi.fn().mockResolvedValue(mockDirHandle);
      
      await processor.importFromFolder();
      
      expect(mockBridge.ui.addItems).toHaveBeenCalled();
      expect(mockBridge.ui.updateViewMode).toHaveBeenCalledWith(CONSTANTS.UI.VIEW_MODES.IMPORT, expect.anything());
    });
    
    it('should handle cancellation', async () => {
       const abortError = new Error('Abort');
       abortError.name = 'AbortError';
       window.showDirectoryPicker = vi.fn().mockRejectedValue(abortError);
       
       await processor.importFromFolder();
       expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('cancelled'));
    });
    
    it('should handle other errors', async () => {
       window.showDirectoryPicker = vi.fn().mockRejectedValue(new Error('Other'));
       await processor.importFromFolder();
       expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('Error accessing folder'));
    });
  });

  describe('importFromFile', () => {
    it('should process lines from text file', async () => {
      const mockFile = new File(['Track 1\nTrack 2'], 'test.txt', { type: 'text/plain' });
      const mockEvent = {
        target: {
          files: [mockFile],
          value: 'some-path'
        }
      };

      await processor.importFromFile(mockEvent);

      expect(mockBridge.ui.addItems).toHaveBeenCalled();
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('Found 2 tracks'));
      expect(mockEvent.target.value).toBe('');
    });
    
    it('should handle empty file selection', async () => {
      const mockEvent = { target: { files: [] } };
      await processor.importFromFile(mockEvent);
      expect(mockBridge.ui.toggleSearchProgress).not.toHaveBeenCalled();
    });

    it('should handle read error', async () => {
      const mockFile = { text: vi.fn().mockRejectedValue(new Error('Read error')) };
      const mockEvent = { target: { files: [mockFile] } };
      await processor.importFromFile(mockEvent);
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('Error reading file'));
    });
  });

  describe('keepOnlySelected', () => {
    it('should handle confirm cancellation', async () => {
      const row = document.createElement('div');
      row.className = `${CONSTANTS.UI.CLASSES.GRID_ROW} ${CONSTANTS.UI.CLASSES.DUPLICATE_GROUP_ROW}`;
      row.dataset.originalMedia = JSON.stringify({ videoId: 'v1', playlistSetVideoId: 'ps1' });
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = CONSTANTS.UI.CLASSES.ITEM_CHECKBOX;
      cb.checked = false;
      row.appendChild(cb);
      document.body.appendChild(row);

      window.confirm = vi.fn().mockReturnValue(false);
      
      await processor.keepOnlySelected();
      
      expect(mockYTMusicAPI.removeItemsFromPlaylist).not.toHaveBeenCalled();
    });

    it('should handle itemsToRemove length 0', async () => {
       await processor.keepOnlySelected();
       expect(mockYTMusicAPI.removeItemsFromPlaylist).not.toHaveBeenCalled();
    });

    it('should handle API failure', async () => {
       const row = document.createElement('div');
       row.className = `${CONSTANTS.UI.CLASSES.GRID_ROW} ${CONSTANTS.UI.CLASSES.DUPLICATE_GROUP_ROW}`;
       row.dataset.originalMedia = JSON.stringify({ videoId: 'v1', playlistSetVideoId: 'ps1' });
       const cb = document.createElement('input');
       cb.type = 'checkbox';
       cb.className = CONSTANTS.UI.CLASSES.ITEM_CHECKBOX;
       cb.checked = false;
       row.appendChild(cb);
       document.body.appendChild(row);

       window.confirm = vi.fn().mockReturnValue(true);
       mockYTMusicAPI.removeItemsFromPlaylist.mockResolvedValue(false);
       
       await processor.keepOnlySelected();
       expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('Error occurred'));
    });
  });

  describe('processPlaylistItems', () => {
     it('should handle cancellation and update remaining rows', async () => {
        const items = [new Track({ name: 'T1' }), new Track({ name: 'T2' })];
        mockYTMusicAPI.getPlaylistItems.mockResolvedValue([]); 
        mockYTMusicAPI.searchMusic.mockImplementation(async () => {
           mockBridge.session.isCancelled = true;
           return {};
        });
        
        await processor.processPlaylistItems(items);
        
        expect(items[1].searchCancelled).toBe(true);
        expect(mockBridge.ui.updateItemRow).toHaveBeenCalledTimes(2);
     });
     
     it('should handle search error', async () => {
        const items = [new Track({ name: 'T1' })];
        mockYTMusicAPI.getPlaylistItems.mockResolvedValue([]);
        mockYTMusicAPI.searchMusic.mockRejectedValue(new Error('Fail'));
        
        await processor.processPlaylistItems(items);
        expect(items[0].replacement).toBeNull();
        expect(mockBridge.ui.updateItemRow).toHaveBeenCalled();
     });
  });

  describe('setFinalProgressText', () => {
    it('should handle empty processedItems', () => {
      processor.setFinalProgressText([]);
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('No items were processed'));
    });

    it('should show local import specific message', () => {
      const items = [new Track({ name: 'T1', isLocal: true, replacement: { isGoodMatch: true } })];
      processor.setFinalProgressText(items);
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('Found replacements for 1 of 1'));
    });
    
    it('should show cancellation message', () => {
       mockBridge.session.isCancelled = true;
       const items = [new Track({ name: 'T1', replacement: { isGoodMatch: true } })];
       processor.setFinalProgressText(items);
       expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('Search cancelled'));
    });
  });

  describe('fetchTargetPlaylistItems', () => {
    it('should handle API error gracefully', async () => {
      mockYTMusicAPI.getPlaylistItems.mockRejectedValue(new Error('Fail'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await processor.fetchTargetPlaylistItems();
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('setVideoTrackProgressMessage', () => {
    it('should show "No video tracks processed" when none searched', () => {
      processor.setVideoTrackProgressMessage([{ isSearching: true }]);
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('No video tracks were processed'));
    });

    it('should show "No replacements found" message', () => {
      processor.setVideoTrackProgressMessage([{ isSearching: false, replacement: null }]);
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('No replacements found'));
    });

    it('should show match quality warning if some matches are not good', () => {
      const tracks = [
        { isSearching: false, replacement: { isGoodMatch: true } },
        { isSearching: false, replacement: { isGoodMatch: false } }
      ];
      processor.setVideoTrackProgressMessage(tracks);
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('1/2 are good matches'));
    });
  });
});
