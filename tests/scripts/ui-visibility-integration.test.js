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
      playerHandler: {},
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
});
