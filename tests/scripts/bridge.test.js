import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../../scripts/bridge.js';
import { CONSTANTS } from '../../utils/constants.js';
import { MESSAGES } from '../../utils/ui-messages.js';
import { UIHelper } from '../../utils/ui-helper.js';
import fs from 'fs';
import path from 'path';

describe('Bridge Move Selected Tracks', () => {
  let bridge;

  beforeEach(() => {
    // Load DOM HTML
    const htmlPath = path.resolve(__dirname, '../../html/in-site-popup.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = `<div id="yt-music-plus-popup" class="yt-music-plus-root">${htmlContent}</div>`;

    // The IIFE sets window.bridgeInstance
    bridge = window.bridgeInstance;
    
    // Clear and mock nested methods/APIs as needed
    vi.spyOn(bridge.ytMusicAPI, 'addItemsToPlaylist').mockResolvedValue(true);
    vi.spyOn(bridge.ytMusicAPI, 'removeItemsFromPlaylist').mockResolvedValue(true);
    vi.spyOn(bridge.ytMusicAPI, 'getCurrentPlaylistIdFromURL').mockReturnValue('src123');
    vi.spyOn(bridge.ui, 'setTargetModalVisibility').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'updatePopupTitle').mockImplementation(() => {});
    vi.spyOn(bridge.ui, 'setProgressText').mockImplementation(() => {});
    vi.spyOn(bridge, 'initPlaylistFetching').mockResolvedValue();
    vi.spyOn(bridge, 'beforeActionsOnSelectedItems').mockImplementation(() => {});
    vi.spyOn(bridge, 'afterActionsOnSelectedItems').mockResolvedValue();

    // Mock UIHelper.getSelectedMediaItems
    vi.spyOn(UIHelper, 'getSelectedMediaItems').mockReturnValue([
      {
        originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
        replacementMedia: null
      }
    ]);
    vi.spyOn(UIHelper, 'removeMediaGridRow').mockImplementation(() => {});
    
    bridge.currentSelectedPlaylist = { id: 'src123', title: 'Source Playlist' };
    bridge.isMovingTracks = false;
    bridge.tracksToMove = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize moving state and open target modal when moveSelectedItems is called', async () => {
    await bridge.moveSelectedItems();

    expect(bridge.isMovingTracks).toBe(true);
    expect(bridge.tracksToMove).toEqual([
      {
        originalMedia: { videoId: 'vid123', playlistSetVideoId: 'set456' },
        replacementMedia: null
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
});
