import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BridgeUI } from '../../scripts/bridge-ui.js';
import { CONSTANTS } from '../../utils/constants.js';
import fs from 'fs';
import path from 'path';

describe('BridgeUI Coverage', () => {
  let bridgeUI;
  let mockBridge;
  let html;

  beforeEach(() => {
    // Load the HTML template
    const templatePath = path.resolve(__dirname, '../../html/in-site-popup.html');
    html = fs.readFileSync(templatePath, 'utf8');
    document.body.innerHTML = html;

    // Create a template for Ignore Group button if it doesn't exist in the HTML (or if we need to mock it)
    if (!document.getElementById(CONSTANTS.UI.ELEMENT_IDS.IGNORE_GROUP_BTN_TEMPLATE)) {
      const template = document.createElement('template');
      template.id = CONSTANTS.UI.ELEMENT_IDS.IGNORE_GROUP_BTN_TEMPLATE;
      template.innerHTML = `<button class="${CONSTANTS.UI.CLASSES.IGNORE_GROUP_BTN}">Ignore</button>`;
      document.body.appendChild(template);
    }

    mockBridge = {
      ytMusicAPI: {},
      playerHandler: {
        getVideoData: vi.fn().mockReturnValue({ video_id: 'v1' }),
        getPlayerState: vi.fn().mockReturnValue(1),
        isLocalFilePlaying: vi.fn().mockReturnValue(false)
      },
      session: { isCancelled: false },
      cancelTargetSelection: vi.fn(),
      initPlaylistFetching: vi.fn(),
      onTargetPlaylistSelected: vi.fn(),
      onPlaylistSelected: vi.fn(),
      showPopup: vi.fn(),
      _createMediaObjects: vi.fn().mockReturnValue({
        originalMedia: { videoId: 'orig1', name: 'Original' },
        replacementMedia: { videoId: 'repl1', name: 'Replacement' }
      })
    };

    bridgeUI = new BridgeUI(mockBridge);
  });

  describe('initTargetModalButtons', () => {
    it('should attach event listeners to target modal buttons', () => {
      const closeBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.CLOSE_TARGET_MODAL);
      const cancelBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.CANCEL_TARGET_MODAL);
      const refreshBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.REFRESH_TARGET_PLAYLISTS);
      const loadAllBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.LOAD_ALL_TARGET_PLAYLISTS);

      // Trigger clicks
      closeBtn?.click();
      expect(mockBridge.cancelTargetSelection).toHaveBeenCalled();

      cancelBtn?.click();
      expect(mockBridge.cancelTargetSelection).toHaveBeenCalledTimes(2);

      refreshBtn?.click();
      expect(mockBridge.initPlaylistFetching).toHaveBeenCalledWith(true, true, true);

      loadAllBtn?.click();
      expect(mockBridge.initPlaylistFetching).toHaveBeenCalledWith(true, false, true);
    });
  });

  describe('addItem with groupInfo', () => {
    it('should add "Ignore Group" button for start of group', () => {
      const groupInfo = { isStart: true, groupIndex: 0, indexInGroup: 0 };
      const item = { name: 'Track 1' };
      
      const gridRow = bridgeUI.addItem(item, 'base/', 1, groupInfo);
      
      const ignoreBtn = gridRow.querySelector('.' + CONSTANTS.UI.CLASSES.IGNORE_GROUP_BTN);
      expect(ignoreBtn).not.toBeNull();

      // Test ignore button click
      ignoreBtn.click();
      expect(document.querySelector(`[data-group-index="0"]`)).toBeNull();
      expect(bridgeUI.rowMap.has(1)).toBe(false);
    });
  });

  describe('updateItemRow with search filtering', () => {
    it('should hide row if it does not match search input', () => {
      const item = { name: 'Track 1' };
      // Make sure it's in a container so parentNode works
      const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
      bridgeUI.addItem(item, 'base/', 1);
      
      const searchInput = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SEARCH_INPUT);
      searchInput.value = 'non-matching-query';

      // Mock _createMediaObjects to return data that will result in a specific searchString
      vi.spyOn(mockBridge, '_createMediaObjects').mockReturnValue({
        originalMedia: { name: 'Track 1', artist: 'Artist 1' },
        replacementMedia: { name: 'Repl 1' }
      });

      bridgeUI.updateItemRow(item, 'base/', 1);
      
      const row = bridgeUI.rowMap.get(1);
      expect(row.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });
  });

  describe('displayTargetPlaylists', () => {
    it('should render playlist cards in target grid', () => {
      const playlists = [{ id: 'p1', title: 'Playlist 1' }];
      bridgeUI.displayTargetPlaylists(playlists);
      
      const grid = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLISTS_GRID);
      expect(grid.children.length).toBe(1);
      
      grid.children[0].click();
      expect(mockBridge.onTargetPlaylistSelected).toHaveBeenCalledWith(playlists[0]);
    });
  });

  describe('initSearchBox', () => {
    it('should initialize search input and clear button', () => {
      const searchInput = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SEARCH_INPUT);
      const clearBtn = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.CLEAR_SEARCH_BTN);
      
      bridgeUI.initSearchBox();
      expect(searchInput.dataset.initialized).toBe('true');

      // Test clear button
      searchInput.value = 'test';
      clearBtn.click();
      expect(searchInput.value).toBe('');
      expect(clearBtn.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });
  });

  describe('injectActionButtons', () => {
    it('should inject buttons into header', () => {
      const header = document.createElement('ytmusic-responsive-header-renderer');
      document.body.appendChild(header);

      bridgeUI.injectActionButtons({ showPlaylistButton: true });
      
      const injected = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ACTION_BUTTONS);
      expect(injected).not.toBeNull();
      expect(header.contains(injected)).toBe(true);

      // Test click
      injected.click();
      expect(mockBridge.showPopup).toHaveBeenCalled();
    });

    it('should not inject if already exists', () => {
      const header = document.createElement('ytmusic-responsive-header-renderer');
      const existing = document.createElement('div');
      existing.id = CONSTANTS.UI.ELEMENT_IDS.ACTION_BUTTONS;
      header.appendChild(existing);
      document.body.appendChild(header);

      bridgeUI.injectActionButtons({ showPlaylistButton: true });
      expect(header.querySelectorAll(`#${CONSTANTS.UI.ELEMENT_IDS.ACTION_BUTTONS}`).length).toBe(1);
    });

    it('should not inject if disabled in settings', () => {
      const header = document.createElement('ytmusic-responsive-header-renderer');
      document.body.appendChild(header);
      bridgeUI.injectActionButtons({ showPlaylistButton: false });
      expect(document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ACTION_BUTTONS)).toBeNull();
    });
  });

  describe('displayPlaylistsForSelection', () => {
    it('should render playlists and handle clicks', () => {
      const playlistsGrid = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLISTS_GRID);
      const playlists = [{ id: 'p1', title: 'P1' }];
      
      bridgeUI.displayPlaylistsForSelection(playlists);
      
      expect(playlistsGrid.children.length).toBe(1);
      playlistsGrid.children[0].click();
      expect(mockBridge.onPlaylistSelected).toHaveBeenCalledWith(playlists[0]);
    });

    it('should call onTargetPlaylistSelected when isSelectingTarget is true', () => {
      mockBridge.isSelectingTarget = true;
      const playlists = [{ id: 'p1', title: 'P1' }];
      bridgeUI.displayPlaylistsForSelection(playlists);
      
      document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLISTS_GRID).children[0].click();
      expect(mockBridge.onTargetPlaylistSelected).toHaveBeenCalledWith(playlists[0]);
    });

    it('should show no playlists message if empty', () => {
      bridgeUI.displayPlaylistsForSelection([]);
      const playlistsGrid = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLISTS_GRID);
      expect(playlistsGrid.querySelector('.' + CONSTANTS.UI.CLASSES.NO_PLAYLISTS_MESSAGE)).not.toBeNull();
    });
  });

  describe('updateViewMode', () => {
    it('should update UI for SEARCH_RESULTS mode', () => {
      bridgeUI.updateViewMode(CONSTANTS.UI.VIEW_MODES.SEARCH_RESULTS, { isEditable: true });
      
      expect(document.getElementById(CONSTANTS.UI.BUTTON_IDS.REPLACE_SELECTED).classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
      expect(document.getElementById(CONSTANTS.UI.BUTTON_IDS.KEEP_ONLY_SELECTED).classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });

    it('should update UI for DUPLICATES mode', () => {
      bridgeUI.updateViewMode(CONSTANTS.UI.VIEW_MODES.DUPLICATES, { isEditable: true });
      
      expect(document.getElementById(CONSTANTS.UI.BUTTON_IDS.KEEP_ONLY_SELECTED).classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
      expect(document.getElementById(CONSTANTS.UI.ELEMENT_IDS.GRID_HEADER_REPLACEMENT).textContent).toBe('Ignore Group');
    });

    it('should hide editable actions if playlist is not editable', () => {
      bridgeUI.updateViewMode(CONSTANTS.UI.VIEW_MODES.SEARCH_RESULTS, { isEditable: false });
      expect(document.getElementById(CONSTANTS.UI.BUTTON_IDS.REPLACE_SELECTED).classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });
  });

  describe('showTriggerButtons', () => {
    it('should toggle nav button and action buttons', () => {
      const navBtn = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.NAV_BTN);
      const actionBtn = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ACTION_BUTTONS);
      // Ensure they exist in mock DOM if not in template
      if (!navBtn) {
        const d = document.createElement('div'); d.id = CONSTANTS.UI.ELEMENT_IDS.NAV_BTN;
        document.body.appendChild(d);
      }
      if (!actionBtn) {
        const d = document.createElement('div'); d.id = CONSTANTS.UI.ELEMENT_IDS.ACTION_BUTTONS;
        document.body.appendChild(d);
      }

      bridgeUI.showTriggerButtons({ showNavButton: false, showPlaylistButton: false });
      expect(document.getElementById(CONSTANTS.UI.ELEMENT_IDS.NAV_BTN).classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
      expect(document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ACTION_BUTTONS).classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });
  });

  describe('updateItemRow edge cases', () => {
    it('should retain checkbox state if user interacted', () => {
      const item = { name: 'Track 1' };
      const row = bridgeUI.addItem(item, 'base/', 1);
      const cb = row.querySelector('.' + CONSTANTS.UI.CLASSES.ITEM_CHECKBOX);
      cb.checked = true;
      cb.dataset.userInteracted = 'true';

      bridgeUI.updateItemRow(item, 'base/', 1);
      
      const newRow = bridgeUI.rowMap.get(1);
      const newCb = newRow.querySelector('.' + CONSTANTS.UI.CLASSES.ITEM_CHECKBOX);
      expect(newCb.checked).toBe(true);
      expect(newCb.dataset.userInteracted).toBe('true');
    });
  });

  describe('setActiveButton', () => {
    it('should set button as active and clear others', () => {
      const container = document.createElement('div');
      container.className = 'yt-music-plus-playlist-action-buttons';
      
      const btn1 = document.createElement('button');
      btn1.id = 'btn1';
      btn1.className = 'yt-music-plus-btn';
      
      const btn2 = document.createElement('button');
      btn2.id = 'btn2';
      btn2.className = 'yt-music-plus-btn yt-music-plus-active';
      
      container.appendChild(btn1);
      container.appendChild(btn2);
      document.body.appendChild(container);

      bridgeUI.setActiveButton('btn1');
      
      expect(btn1.classList.contains(CONSTANTS.UI.CLASSES.ACTIVE)).toBe(true);
      expect(btn2.classList.contains(CONSTANTS.UI.CLASSES.ACTIVE)).toBe(false);
    });
  });

  describe('hasActiveActionButton', () => {
    it('should return true if an active button exists', () => {
      const container = document.createElement('div');
      container.className = 'yt-music-plus-playlist-action-buttons';
      const btn = document.createElement('button');
      btn.className = 'yt-music-plus-btn yt-music-plus-active';
      container.appendChild(btn);
      document.body.appendChild(container);
      expect(bridgeUI.hasActiveActionButton()).toBe(true);
    });
  });

  describe('toggleSearchProgress', () => {
    it('should toggle visibility of search progress and cancel button', () => {
      const searchProgress = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SEARCH_PROGRESS);
      const cancelBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.CANCEL_SEARCH);
      
      bridgeUI.toggleSearchProgress(true, true);
      expect(searchProgress.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
      expect(cancelBtn.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
      
      bridgeUI.toggleSearchProgress(false, false);
      expect(searchProgress.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
      expect(cancelBtn.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });
  });

  describe('updateFooterVisibility', () => {
    it('should handle isSelectionView = true', () => {
      bridgeUI.updateFooterVisibility(true);
      expect(document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_SELECTION_ACTIONS).classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
      expect(document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PROGRESS_TEXT).classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });
  });

  describe('updatePopupTitle', () => {
    it('should update the title text', () => {
      bridgeUI.updatePopupTitle('New Title');
      expect(document.getElementById(CONSTANTS.UI.ELEMENT_IDS.POPUP_TITLE).textContent).toBe('New Title');
    });
  });

  describe('updateTargetPlaylistDisplay', () => {
    it('should update the target playlist name', () => {
      bridgeUI.updateTargetPlaylistDisplay({ title: 'Target P' });
      expect(document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLIST_NAME).textContent).toBe('Target P');
    });
  });

  describe('setTargetModalVisibility', () => {
    it('should toggle target modal visibility', () => {
      const modal = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLIST_MODAL);
      bridgeUI.setTargetModalVisibility(true);
      expect(modal.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
      bridgeUI.setTargetModalVisibility(false);
      expect(modal.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });
  });

  describe('toggleTargetSearchProgress', () => {
    it('should toggle target search progress', () => {
      const indicator = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLISTS_LOADING);
      bridgeUI.toggleTargetSearchProgress(true);
      expect(indicator.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
      bridgeUI.toggleTargetSearchProgress(false);
      expect(indicator.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
    });
  });

  describe('initRefreshButton loadAll', () => {
    it('should handle loadAll button click', async () => {
      const loadAllBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.LOAD_ALL_PLAYLISTS);
      bridgeUI.initRefreshButton();
      loadAllBtn.click();
      expect(mockBridge.initPlaylistFetching).toHaveBeenCalledWith(true, false);
    });
  });
});
