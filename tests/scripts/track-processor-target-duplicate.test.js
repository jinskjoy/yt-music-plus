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

describe('TrackProcessor - Target Duplicate Check', () => {
  let processor;
  let mockBridge;
  let mockYTMusicAPI;

  beforeEach(() => {
    mockYTMusicAPI = {
      getPlaylistItems: vi.fn(),
      searchMusic: vi.fn(),
      getBestSearchResult: vi.fn(),
      getCurrentPlaylistIdFromURL: vi.fn(() => 'PL_SOURCE')
    };

    mockBridge = {
      ytMusicAPI: mockYTMusicAPI,
      targetPlaylist: { id: 'PL_TARGET', title: 'Target Playlist' },
      session: {
        isCancelled: false,
        start: vi.fn(),
        stop: vi.fn(),
        updateProgress: vi.fn(),
        progressText: 'Progressing...'
      },
      ui: {
        clearPlaylistItemsContainer: vi.fn(),
        addItem: vi.fn(),
        updateItemRow: vi.fn(),
        updateViewMode: vi.fn(),
        setProgressText: vi.fn(),
        toggleSearchProgress: vi.fn(),
        resetActionButtonsForPlaylist: vi.fn(),
        setTargetContainerVisibility: vi.fn()
      },
      sleep: vi.fn().mockResolvedValue(),
      _createMediaObjects: vi.fn((item, baseUrl) => ({
        originalMedia: item,
        replacementMedia: item.replacement
      }))
    };

    processor = new TrackProcessor(mockBridge);
    vi.clearAllMocks();
  });

  describe('fetchTargetPlaylistItems', () => {
    it('should fetch and cache target playlist items', async () => {
      const targetItems = [
        { videoId: 'v1', name: 'Track 1' },
        { videoId: 'v2', name: 'Track 2' }
      ];
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue(targetItems);

      await processor.fetchTargetPlaylistItems();

      expect(mockYTMusicAPI.getPlaylistItems).toHaveBeenCalledWith('PL_TARGET');
      expect(processor.targetPlaylistItems.has('v1')).toBe(true);
      expect(processor.targetPlaylistItems.has('v2')).toBe(true);
      expect(processor.targetPlaylistItems.has('v3')).toBe(false);
    });
  });

  describe('checkForDuplicate', () => {
    it('should mark item as duplicate if replacement videoId is in target cache', () => {
      processor.targetPlaylistItems.set('v1', true);
      
      const itemWithDuplicate = {
        replacement: { videoId: 'v1' }
      };
      const itemNoDuplicate = {
        replacement: { videoId: 'v2' }
      };

      processor.checkForDuplicate(itemWithDuplicate);
      processor.checkForDuplicate(itemNoDuplicate);

      expect(itemWithDuplicate.isDuplicate).toBe(true);
      expect(itemNoDuplicate.isDuplicate).toBe(false);
    });
  });

  describe('processPlaylistItems', () => {
    it('should check for duplicates during processing', async () => {
      const items = [new Track({ name: 'Unavailable', isGreyedOut: true })];
      const replacement = { videoId: 'v1', name: 'Replacement' };
      
      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([{ videoId: 'v1' }]); // Target has the replacement
      mockYTMusicAPI.searchMusic.mockResolvedValue({});
      mockYTMusicAPI.getBestSearchResult.mockReturnValue(replacement);

      await processor.processPlaylistItems(items);

      expect(items[0].isDuplicate).toBe(true);
      expect(mockBridge.ui.updateItemRow).toHaveBeenCalledWith(
        expect.objectContaining({ isDuplicate: true }),
        expect.any(String),
        expect.any(Number)
      );
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(
        expect.stringContaining(MESSAGES.RESULTS.DUPLICATE_IN_TARGET(1))
      );
    });
  });

  describe('recheckDuplicates', () => {
    it('should re-evaluate duplicates when target playlist changes', async () => {
      // Set up DOM mock for recheckDuplicates
      const row1 = document.createElement('div');
      row1.className = CONSTANTS.UI.CLASSES.GRID_ROW;
      row1.dataset.serialNumber = '1';
      row1.dataset.originalMedia = JSON.stringify({ name: 'Track 1' });
      row1.dataset.replacementMedia = JSON.stringify({ videoId: 'v1', name: 'Repl 1' });
      
      const container = document.createElement('div');
      container.id = CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER;
      container.appendChild(row1);
      document.body.appendChild(container);

      mockYTMusicAPI.getPlaylistItems.mockResolvedValue([{ videoId: 'v1' }]); // Now it's a duplicate

      await processor.recheckDuplicates();

      expect(mockBridge.ui.updateItemRow).toHaveBeenCalledWith(
        expect.objectContaining({ isDuplicate: true }),
        CONSTANTS.API.BASE_URL,
        1
      );
      expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith('Found 1 duplicates in the new target playlist.');

      document.body.removeChild(container);
    });
  });
});
