import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackProcessor } from '../../scripts/track-processor.js';
import { Track } from '../../scripts/models/track.js';
import { CONSTANTS } from '../../utils/constants.js';

describe('TrackProcessor Extended', () => {
  let processor;
  let mockBridge;

  beforeEach(() => {
    mockBridge = {
      ytMusicAPI: {
        getPlaylistItems: vi.fn(),
        getCurrentPlaylistIdFromURL: vi.fn(),
        searchMusic: vi.fn(),
        getBestSearchResult: vi.fn(),
        removeItemsFromPlaylist: vi.fn()
      },
      ui: {
        clearPlaylistItemsContainer: vi.fn(),
        addItem: vi.fn(),
        updateItemRow: vi.fn(),
        setProgressText: vi.fn(),
        toggleSearchProgress: vi.fn(),
        updateViewMode: vi.fn()
      },
      session: {
        start: vi.fn(),
        stop: vi.fn(),
        updateProgress: vi.fn(),
        isCancelled: false,
        progressText: '0%'
      },
      sleep: vi.fn().mockResolvedValue(),
      beforeActionsOnSelectedItems: vi.fn(),
      afterActionsOnSelectedItems: vi.fn(),
      currentSelectedPlaylist: { id: 'p1' }
    };
    processor = new TrackProcessor(mockBridge);
  });

  describe('fetchTargetPlaylistItems', () => {
    it('should fetch and cache items', async () => {
      mockBridge.ytMusicAPI.getPlaylistItems.mockResolvedValue([
        { videoId: 'v1' }, { videoId: 'v2' }
      ]);
      
      await processor.fetchTargetPlaylistItems();
      
      expect(processor.targetPlaylistItems.has('v1')).toBe(true);
      expect(processor.targetPlaylistItems.has('v2')).toBe(true);
      expect(processor.targetPlaylistItems.size).toBe(2);
    });

    it('should handle API errors gracefully', async () => {
       mockBridge.ytMusicAPI.getPlaylistItems.mockRejectedValue(new Error('Fail'));
       await processor.fetchTargetPlaylistItems();
       expect(processor.targetPlaylistItems.size).toBe(0);
    });
  });

  describe('checkForDuplicate', () => {
    it('should identify duplicates correctly', () => {
      processor.targetPlaylistItems.set('v1', true);
      
      const track1 = { replacement: { videoId: 'v1' } };
      processor.checkForDuplicate(track1);
      expect(track1.isDuplicate).toBe(true);
      
      const track2 = { replacement: { videoId: 'v3' } };
      processor.checkForDuplicate(track2);
      expect(track2.isDuplicate).toBe(false);
    });
  });

  describe('processPlaylistItems', () => {
    it('should process items and update UI', async () => {
      const items = [
        new Track({ name: 'T1' }),
        new Track({ name: 'T2', isGeneric: true })
      ];
      
      mockBridge.ytMusicAPI.searchMusic.mockResolvedValue({});
      mockBridge.ytMusicAPI.getBestSearchResult.mockReturnValue({ videoId: 'v_repl' });

      await processor.processPlaylistItems(items);

      expect(mockBridge.ui.addItem).toHaveBeenCalledTimes(2);
      expect(mockBridge.ui.updateItemRow).toHaveBeenCalledTimes(1); // T2 is generic, skipped
      expect(items[0].replacement.videoId).toBe('v_repl');
    });

    it('should handle cancellation', async () => {
       const items = [new Track({ name: 'T1' }), new Track({ name: 'T2' })];
       mockBridge.session.isCancelled = true;
       
       await processor.processPlaylistItems(items);
       expect(mockBridge.ui.updateItemRow).toHaveBeenCalled();
       expect(items[0].searchCancelled).toBe(true);
    });
  });

  describe('findUnavailableTracks', () => {
    it('should filter unavailable tracks and process them', async () => {
      const allItems = [
        new Track({ name: 'T1', isGreyedOut: true }),
        new Track({ name: 'T2', isGreyedOut: false })
      ];
      mockBridge.ytMusicAPI.getPlaylistItems.mockResolvedValue(allItems);
      
      const spyProcess = vi.spyOn(processor, 'processPlaylistItems').mockResolvedValue();
      
      await processor.findUnavailableTracks();
      
      expect(spyProcess).toHaveBeenCalledWith([allItems[0]]);
    });

    it('should handle case where no unavailable tracks are found', async () => {
       mockBridge.ytMusicAPI.getPlaylistItems.mockResolvedValue([new Track({ name: 'T1' })]);
       await processor.findUnavailableTracks();
       expect(mockBridge.ui.setProgressText).toHaveBeenCalledWith(expect.stringContaining('No unavailable tracks'));
    });
  });

  describe('listAllTracks', () => {
    it('should list all tracks in UI', async () => {
      const items = [new Track({ name: 'T1' }), new Track({ name: 'T2' })];
      mockBridge.ytMusicAPI.getPlaylistItems.mockResolvedValue(items);
      
      await processor.listAllTracks();
      
      expect(mockBridge.ui.addItem).toHaveBeenCalledTimes(2);
    });
  });
});
