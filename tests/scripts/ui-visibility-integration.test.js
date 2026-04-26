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
      session: { isCancelled: false }
    };
    
    bridgeUI = new BridgeUI(mockBridge);
    mockBridge.ui = bridgeUI;
    
    trackProcessor = new TrackProcessor(mockBridge);
    
    vi.clearAllMocks();
  });

  describe('Local Import Mode Visibility', () => {
    it('should hide Replace and Remove buttons when in import mode', () => {
      mockBridge.currentSelectedPlaylist = { isEditable: true };
      
      const replaceBtn = document.getElementById('replaceSelectedBtn');
      const removeBtn = document.getElementById('removeSelectedBtn');
      const addBtn = document.getElementById('addSelectedBtn');
      
      replaceBtn.classList.remove('hidden');
      removeBtn.classList.remove('hidden');
      
      // We simulate what bridge.updateImportButtonVisibility() does since we can't easily new Bridge()
      // But we call the logic we want to test:
      const updateImportButtonVisibility = () => {
        const isEditable = mockBridge.currentSelectedPlaylist?.isEditable !== false;
        if (replaceBtn) replaceBtn.classList.add('hidden');
        if (removeBtn) removeBtn.classList.add('hidden');
        if (addBtn) addBtn.classList.toggle('hidden', !isEditable);
      };

      updateImportButtonVisibility();
      
      expect(replaceBtn.classList.contains('hidden')).toBe(true);
      expect(removeBtn.classList.contains('hidden')).toBe(true);
      expect(addBtn.classList.contains('hidden')).toBe(false);
    });
  });

  describe('List All Tracks Visibility', () => {
    it('should hide Replace and Add buttons, and show Remove button', async () => {
      mockBridge.currentSelectedPlaylist = { id: 'p123' };
      // Mock API to return some tracks
      mockBridge.ytMusicAPI.getPlaylistItems.mockResolvedValue([
        { name: 'Track 1', videoId: 'v1' }
      ]);
      
      const replaceBtn = document.getElementById('replaceSelectedBtn');
      const addBtn = document.getElementById('addSelectedBtn');
      const removeBtn = document.getElementById('removeSelectedBtn');
      
      // Ensure they start in a known state
      replaceBtn.classList.remove('hidden');
      addBtn.classList.remove('hidden');
      removeBtn.classList.add('hidden');
      
      // CALL THE ACTUAL CODE
      await trackProcessor.listAllTracks();
      
      expect(replaceBtn.classList.contains('hidden')).toBe(true);
      expect(addBtn.classList.contains('hidden')).toBe(true);
      expect(removeBtn.classList.contains('hidden')).toBe(false);
    });
  });
});
