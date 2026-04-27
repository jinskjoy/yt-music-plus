import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Mock TextSimilarity for title matching tests
vi.mock('../../utils/utils.js', () => ({
  TextSimilarity: {
    isGoodMatch: vi.fn((t1, t2, threshold) => {
      // Use the threshold passed to the mock
      const effectiveThreshold = threshold || CONSTANTS.API.SIMILARITY_THRESHOLD;
      if (t1 === t2) return true;
      if (t1.includes('Shake It Off') && t2.includes('Shake It Off')) return true;
      return false;
    })
  }
}));

describe('TrackProcessor - Duplicate Track Check', () => {
  let processor;
  let mockBridge;
  let mockYTMusicAPI;

  beforeEach(() => {
    mockYTMusicAPI = {
      getPlaylistItems: vi.fn(),
      removeItemsFromPlaylist: vi.fn(),
      getCurrentPlaylistIdFromURL: vi.fn(() => 'PL123')
    };

    mockBridge = {
      ytMusicAPI: mockYTMusicAPI,
      session: {
        isCancelled: false,
        start: vi.fn(),
        stop: vi.fn(),
        updateProgress: vi.fn()
      },
      ui: {
        clearPlaylistItemsContainer: vi.fn(),
        resetActionButtonsForPlaylist: vi.fn(),
        setTargetContainerVisibility: vi.fn(),
        toggleSearchProgress: vi.fn(),
        setProgressText: vi.fn(),
        addItem: vi.fn(),
        updateActionButtonsVisibility: vi.fn()
      },
      currentSelectedPlaylist: { id: 'PL123', title: 'Test Playlist', isEditable: true },
      beforeActionsOnSelectedItems: vi.fn(),
      afterActionsOnSelectedItems: vi.fn(),
      sleep: vi.fn()
    };

    processor = new TrackProcessor(mockBridge);
    vi.clearAllMocks();
  });

  describe('findDuplicateTracks', () => {
    it('should identify and group tracks with same videoId', async () => {
      const items = [
        new Track({ name: 'Track 1', videoId: 'v1', playlistSetVideoId: 'ps1' }),
        new Track({ name: 'Track 1 Duplicate', videoId: 'v1', playlistSetVideoId: 'ps2' }),
        new Track({ name: 'Track 2', videoId: 'v2', playlistSetVideoId: 'ps3' })
      ];
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue(items);

      await processor.findDuplicateTracks();

      expect(mockBridge.ui.addItem).toHaveBeenCalledTimes(2); // Only duplicates should be shown
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(
        MESSAGES.RESULTS.FOUND_DUPLICATE_GROUPS(1, 2)
      );
    });

    it('should identify and group tracks with similar titles using strict threshold', async () => {
      const items = [
        new Track({ name: 'Shake It Off', videoId: 'v1', playlistSetVideoId: 'ps1' }),
        new Track({ name: 'Shake It Off (Official Video)', videoId: 'v2', playlistSetVideoId: 'ps2' }),
        new Track({ name: 'Blank Space', videoId: 'v3', playlistSetVideoId: 'ps3' })
      ];
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue(items);

      await processor.findDuplicateTracks();

      expect(mockBridge.ui.addItem).toHaveBeenCalledTimes(2);
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(
        MESSAGES.RESULTS.FOUND_DUPLICATE_GROUPS(1, 2)
      );
    });

    it('should select first audio track to keep by default', async () => {
      const items = [
        new Track({ name: 'T1', videoId: 'v1', isVideo: true, playlistSetVideoId: 'ps1' }),
        new Track({ name: 'T1', videoId: 'v1', isVideo: false, playlistSetVideoId: 'ps2' })
      ];
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue(items);

      await processor.findDuplicateTracks();

      // Check that the second track (audio) was marked to keep (isChecked = true)
      const calls = mockBridge.ui.addItem.mock.calls;
      expect(calls[0][0].isChecked).toBe(false); // First track (video)
      expect(calls[1][0].isChecked).toBe(true);  // Second track (audio)
    });

    it('should show no duplicates message when none found', async () => {
      const items = [
        new Track({ name: 'Track 1', videoId: 'v1' }),
        new Track({ name: 'Track 2', videoId: 'v2' })
      ];
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue(items);

      await processor.findDuplicateTracks();

      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.RESULTS.NO_DUPLICATES_FOUND);
    });
  });

  describe('keepOnlySelected', () => {
    it('should remove unmarked tracks from the playlist', async () => {
      // Mock DOM elements
      const row1 = document.createElement('div');
      row1.className = `${CONSTANTS.UI.CLASSES.GRID_ROW} ${CONSTANTS.UI.CLASSES.DUPLICATE_GROUP_ROW}`;
      row1.dataset.originalMedia = JSON.stringify({ videoId: 'v1', playlistSetVideoId: 'ps1' });
      const cb1 = document.createElement('input');
      cb1.type = 'checkbox';
      cb1.className = CONSTANTS.UI.CLASSES.ITEM_CHECKBOX;
      cb1.checked = true; // KEEP
      row1.appendChild(cb1);

      const row2 = document.createElement('div');
      row2.className = `${CONSTANTS.UI.CLASSES.GRID_ROW} ${CONSTANTS.UI.CLASSES.DUPLICATE_GROUP_ROW}`;
      row2.dataset.originalMedia = JSON.stringify({ videoId: 'v2', playlistSetVideoId: 'ps2' });
      const cb2 = document.createElement('input');
      cb2.type = 'checkbox';
      cb2.className = CONSTANTS.UI.CLASSES.ITEM_CHECKBOX;
      cb2.checked = false; // REMOVE
      row2.appendChild(cb2);

      document.body.appendChild(row1);
      document.body.appendChild(row2);

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockYTMusicAPI.removeItemsFromPlaylist.mockResolvedValue(true);

      await processor.keepOnlySelected();

      expect(mockYTMusicAPI.removeItemsFromPlaylist).toHaveBeenCalledWith('PL123', [
        expect.objectContaining({ videoId: 'v2', setVideoId: 'ps2' })
      ]);
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(MESSAGES.ACTIONS.KEEP_COMPLETE(1));

      // Cleanup
      document.body.removeChild(row1);
      document.body.removeChild(row2);
    });
  });
});
