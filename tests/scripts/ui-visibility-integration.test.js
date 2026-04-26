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

    // Create a real BridgeUI and a mock bridge
    mockBridge = {
      ytMusicAPI: {
        getPlaylistItems: vi.fn(),
        isAuthTokenSet: vi.fn(() => true)
      },
      _createMediaObjects: vi.fn((item) => ({ originalMedia: item, replacementMedia: {} })),
      playerHandler: {},
      session: { isCancelled: false },
      currentSelectedPlaylist: { id: 'p123', isEditable: true }
    };
    
    bridgeUI = new BridgeUI(mockBridge);
    mockBridge.ui = bridgeUI;
    
    trackProcessor = new TrackProcessor(mockBridge);
    
    vi.clearAllMocks();
  });

  describe('Local Import Mode Visibility', () => {
    it('should hide Replace and Remove buttons when in import mode', () => {
      const replaceBtn = document.getElementById('replaceSelectedBtn');
      const removeBtn = document.getElementById('removeSelectedBtn');
      const addBtn = document.getElementById('addSelectedBtn');
      
      // Reset state
      replaceBtn.classList.remove('hidden');
      removeBtn.classList.remove('hidden');
      addBtn.classList.remove('hidden');
      
      // CALL THE ACTUAL CODE IN BridgeUI
      bridgeUI.updateImportButtonVisibility(mockBridge.currentSelectedPlaylist);
      
      expect(replaceBtn.classList.contains('hidden')).toBe(true);
      expect(removeBtn.classList.contains('hidden')).toBe(true);
      expect(addBtn.classList.contains('hidden')).toBe(false);
    });

    it('should hide Add button in import mode if playlist is not editable', () => {
      mockBridge.currentSelectedPlaylist.isEditable = false;
      const addBtn = document.getElementById('addSelectedBtn');
      
      bridgeUI.updateImportButtonVisibility(mockBridge.currentSelectedPlaylist);
      
      expect(addBtn.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Playlist Selection Visibility', () => {
    it('should reset buttons correctly for editable playlist', () => {
      const replaceBtn = document.getElementById('replaceSelectedBtn');
      replaceBtn.classList.add('hidden');
      
      bridgeUI.resetActionButtonsForPlaylist(mockBridge.currentSelectedPlaylist);
      
      expect(replaceBtn.classList.contains('hidden')).toBe(false);
    });

    it('should hide buttons for non-editable playlist', () => {
      mockBridge.currentSelectedPlaylist.isEditable = false;
      const replaceBtn = document.getElementById('replaceSelectedBtn');
      
      bridgeUI.resetActionButtonsForPlaylist(mockBridge.currentSelectedPlaylist);
      
      expect(replaceBtn.classList.contains('hidden')).toBe(true);
    });
  });

  describe('List All Tracks Visibility', () => {
    it('should hide Replace and Add buttons, and show Remove button', async () => {
      mockBridge.ytMusicAPI.getPlaylistItems.mockResolvedValue([
        { name: 'Track 1', videoId: 'v1' }
      ]);
      
      const replaceBtn = document.getElementById('replaceSelectedBtn');
      const addBtn = document.getElementById('addSelectedBtn');
      const removeBtn = document.getElementById('removeSelectedBtn');
      
      replaceBtn.classList.remove('hidden');
      addBtn.classList.remove('hidden');
      removeBtn.classList.add('hidden');
      
      await trackProcessor.listAllTracks();
      
      expect(replaceBtn.classList.contains('hidden')).toBe(true);
      expect(addBtn.classList.contains('hidden')).toBe(true);
      expect(removeBtn.classList.contains('hidden')).toBe(false);
    });
  });
});
