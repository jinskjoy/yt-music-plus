import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TrackProcessor } from '../../scripts/track-processor.js';
import { Track } from '../../scripts/models/track.js';
import { CONSTANTS } from '../../utils/constants.js';
import { MESSAGES } from '../../utils/ui-messages.js';

// Mock UIHelper
vi.mock('../../utils/ui-helper.js', () => ({
  UIHelper: {
    updateCheckAllCheckbox: vi.fn(),
    removeMediaGridRow: vi.fn()
  }
}));

describe('TrackProcessor Coverage', () => {
  let processor;
  let mockBridge;
  let mockYTMusicAPI;

  beforeEach(() => {
    mockYTMusicAPI = {
      getPlaylistItems: vi.fn(),
      getCurrentPlaylistIdFromURL: vi.fn(() => 'PL123'),
      searchMusic: vi.fn(),
      getBestSearchResult: vi.fn(),
      removeItemsFromPlaylist: vi.fn()
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
        addItem: vi.fn(),
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

  describe('findVideoTracks', () => {
    it('should handle no tracks found', async () => {
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([]);
      await processor.findVideoTracks();
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.NO_TRACKS_FOUND);
    });

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

      expect(mockBridge.ui.addItem).toHaveBeenCalled();
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
      mockYTMusicAPI.getPlaylistItems.mockRejectedValue(new Error('API Error'));
      await processor.findVideoTracks();
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('Error occurred'));
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

      // Mock fetchTargetPlaylistItems to populate targetPlaylistItems
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([{ videoId: 'v1' }]);
      
      await processor.recheckDuplicates();

      expect(mockBridge.ui.updateItemRow).toHaveBeenCalledWith(
        expect.objectContaining({ isDuplicate: true }),
        CONSTANTS.API.BASE_URL,
        1
      );
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.TARGET_DUPLICATES_FOUND(1));
    });

    it('should show no duplicates found message', async () => {
      const container = document.createElement('div');
      container.id = CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER;
      
      const row = document.createElement('div');
      row.className = CONSTANTS.UI.CLASSES.GRID_ROW;
      row.dataset.replacementMedia = JSON.stringify({ videoId: 'v1' });
      row.dataset.serialNumber = '1';
      container.appendChild(row);
      document.body.appendChild(container);

      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([]);
      
      await processor.recheckDuplicates();

      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.NO_TARGET_DUPLICATES_FOUND);
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

  describe('importFromFolder', () => {
    it('should show error if showDirectoryPicker is not supported', async () => {
      // Temporarily remove showDirectoryPicker
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
      
      expect(mockBridge.ui.addItem).toHaveBeenCalled();
      expect(mockBridge.ui.updateViewMode).toHaveBeenCalledWith(CONSTANTS.UI.VIEW_MODES.IMPORT, expect.anything());
    });

    it('should handle cancellation', async () => {
      const abortError = new Error('Abort');
      abortError.name = 'AbortError';
      window.showDirectoryPicker = vi.fn().mockRejectedValue(abortError);
      
      await processor.importFromFolder();
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('cancelled'));
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

      expect(mockBridge.ui.addItem).toHaveBeenCalledTimes(2);
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
    it('should return if no items to remove', async () => {
      await processor.keepOnlySelected();
      expect(mockBridge.ui.setProgressText).not.toHaveBeenCalled();
    });

    it('should handle confirm cancellation', async () => {
      const row = document.createElement('div');
      row.className = `${CONSTANTS.UI.CLASSES.GRID_ROW} ${CONSTANTS.UI.CLASSES.DUPLICATE_GROUP_ROW}`;
      row.dataset.originalMedia = JSON.stringify({ videoId: 'v1', playlistSetVideoId: 'ps1' });
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = CONSTANTS.UI.CLASSES.ITEM_CHECKBOX;
      cb.checked = false; // Mark for removal
      row.appendChild(cb);
      document.body.appendChild(row);

      window.confirm = vi.fn().mockReturnValue(false);
      
      await processor.keepOnlySelected();
      
      expect(mockYTMusicAPI.removeItemsFromPlaylist).not.toHaveBeenCalled();
    });

    it('should handle API failure in keepOnlySelected', async () => {
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

  describe('findDuplicateTracks errors', () => {
    it('should handle API errors in findDuplicateTracks', async () => {
      mockYTMusicAPI.getPlaylistItems.mockRejectedValue(new Error('API Error'));
      await processor.findDuplicateTracks();
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('Error occurred'));
    });
  });
});
