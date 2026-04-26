import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackProcessor } from '../../scripts/track-processor.js';
import { BridgeUI } from '../../scripts/bridge-ui.js';
import fs from 'fs';
import path from 'path';

describe('UI Visibility Integration', () => {
  let mockBridge;
  let trackProcessor;
  let bridgeUI;

  beforeEach(() => {
    const htmlPath = path.resolve(__dirname, '../../html/in-site-popup.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = htmlContent;

    mockBridge = {
      ytMusicAPI: {
        getPlaylistItems: vi.fn(),
        isAuthTokenSet: vi.fn(() => true)
      },
      _createMediaObjects: vi.fn((item) => ({ originalMedia: item, replacementMedia: {} })),
      playerHandler: {
        isLocalFilePlaying: vi.fn(() => false),
        getVideoData: vi.fn(() => null),
        getPlayerState: vi.fn(() => -1) // CONSTANTS.PLAYER.STATE.UNSTARTED
      },
      session: { isCancelled: false },
      currentSelectedPlaylist: { id: 'p123', isEditable: true }
    };
    
    bridgeUI = new BridgeUI(mockBridge);
    mockBridge.ui = bridgeUI;
    
    trackProcessor = new TrackProcessor(mockBridge);
    
    vi.clearAllMocks();
  });

  describe('List All Tracks Workflow', () => {
    it('should coordinate button visibility via TrackProcessor', async () => {
      mockBridge.ytMusicAPI.getPlaylistItems.mockResolvedValue([
        { name: 'Track 1', videoId: 'v1' }
      ]);
      
      const replaceBtn = document.getElementById('replaceSelectedBtn');
      const addBtn = document.getElementById('addSelectedBtn');
      const removeBtn = document.getElementById('removeSelectedBtn');
      
      await trackProcessor.listAllTracks();
      
      expect(replaceBtn.classList.contains('hidden')).toBe(true);
      expect(addBtn.classList.contains('hidden')).toBe(true);
      expect(removeBtn.classList.contains('hidden')).toBe(false);
    });
  });

  describe('Target Playlist Visibility', () => {
    it('should hide target playlist container when listing all tracks', async () => {
      const targetContainer = document.getElementById('targetPlaylistContainer');
      targetContainer.classList.remove('hidden');
      
      mockBridge.ytMusicAPI.getPlaylistItems.mockResolvedValue([]);
      await trackProcessor.listAllTracks();
      
      expect(targetContainer.classList.contains('hidden')).toBe(true);
    });

    it('should hide target playlist container when finding unavailable tracks', async () => {
      const targetContainer = document.getElementById('targetPlaylistContainer');
      targetContainer.classList.remove('hidden');
      
      mockBridge.ytMusicAPI.getPlaylistItems.mockResolvedValue([]);
      await trackProcessor.findUnavailableTracks();
      
      expect(targetContainer.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Target Playlist Selection', () => {
    it('should toggle screens correctly during target selection', () => {
      const detailsScreen = document.getElementById('playlistDetailsScreen');
      const selectionScreen = document.getElementById('playlistSelectionScreen');
      const cancelBtn = document.getElementById('cancelTargetSelectionBtn');
      const popupTitle = document.getElementById('popupTitle');

      // Mock the methods on bridge
      mockBridge.targetPlaylist = { id: 'p1', title: 'P1' };
      mockBridge.currentSelectedPlaylist = { id: 'p1', title: 'P1' };
      mockBridge.playlistsCache = [{ id: 'p1', title: 'P1' }, { id: 'p2', title: 'P2' }];
      
      // Simulate showPlaylistSelectionForTarget
      mockBridge.isSelectingTarget = true;
      cancelBtn.classList.remove('hidden');
      detailsScreen.classList.add('hidden');
      selectionScreen.classList.remove('hidden');
      popupTitle.textContent = 'Select Target Playlist';
      bridgeUI.displayPlaylistsForSelection(mockBridge.playlistsCache);

      expect(detailsScreen.classList.contains('hidden')).toBe(true);
      expect(selectionScreen.classList.contains('hidden')).toBe(false);
      expect(cancelBtn.classList.contains('hidden')).toBe(false);
      expect(popupTitle.textContent).toBe('Select Target Playlist');

      // Simulate onTargetPlaylistSelected
      const newTarget = { id: 'p2', title: 'P2' };
      mockBridge.targetPlaylist = newTarget;
      mockBridge.isSelectingTarget = false;
      cancelBtn.classList.add('hidden');
      selectionScreen.classList.add('hidden');
      detailsScreen.classList.remove('hidden');
      bridgeUI.updateTargetPlaylistDisplay(newTarget);
      popupTitle.textContent = 'Playlist: P1';

      expect(detailsScreen.classList.contains('hidden')).toBe(false);
      expect(selectionScreen.classList.contains('hidden')).toBe(true);
      expect(cancelBtn.classList.contains('hidden')).toBe(true);
      expect(document.getElementById('targetPlaylistName').textContent).toBe('P2');
    });
  });
});
