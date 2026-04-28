import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BridgeUI } from '../../scripts/bridge-ui.js';
import { CONSTANTS } from '../../utils/constants.js';
import fs from 'fs';
import path from 'path';

describe('BridgeUI', () => {
  let mockBridge;
  let bridgeUI;

  beforeEach(() => {
    // Load the HTML for DOM testing
    const htmlPath = path.resolve(__dirname, '../../html/in-site-popup.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = htmlContent;

    mockBridge = {
      cancelTargetSelection: vi.fn(),
      initPlaylistFetching: vi.fn(),
      _createMediaObjects: vi.fn((item) => ({ 
        originalMedia: { ...item }, 
        replacementMedia: item.replacement ? { ...item.replacement } : null 
      })),
      playerHandler: {
        getVideoData: vi.fn(() => null),
        getPlayerState: vi.fn(() => -1),
        isLocalFilePlaying: vi.fn(() => false)
      },
      onTargetPlaylistSelected: vi.fn(),
      onPlaylistSelected: vi.fn(),
      targetPlaylist: { title: 'Initial Target' }
    };
    
    bridgeUI = new BridgeUI(mockBridge);
  });

  describe('setProgressText', () => {
    it('should set text and show footer when text is provided', () => {
      const progressText = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PROGRESS_TEXT);
      const footer = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SELECTION_FOOTER);
      
      bridgeUI.setProgressText('Loading items...');
      
      expect(progressText.textContent).toBe('Loading items...');
      expect(progressText.classList.contains('hidden')).toBe(false);
      expect(footer.classList.contains('hidden')).toBe(false);
    });

    it('should hide progress text when text is empty', () => {
      const progressText = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PROGRESS_TEXT);
      progressText.classList.remove('hidden');
      
      bridgeUI.setProgressText('');
      
      expect(progressText.classList.contains('hidden')).toBe(true);
    });
  });

  describe('clearPlaylistItemsContainer', () => {
    it('should clear rows and rowMap', () => {
      const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
      const row = document.createElement('div');
      container.appendChild(row);
      bridgeUI.rowMap.set(1, row);
      
      bridgeUI.clearPlaylistItemsContainer();
      
      expect(container.children.length).toBe(0);
      expect(bridgeUI.rowMap.size).toBe(0);
    });
  });

  describe('clearActiveButtons', () => {
    it('should remove active class from all buttons', () => {
      const container = document.querySelector('.playlist-action-buttons');
      const btn = document.createElement('button');
      btn.className = 'btn active';
      container.appendChild(btn);
      
      bridgeUI.clearActiveButtons();
      
      expect(btn.classList.contains('active')).toBe(false);
    });
  });

  describe('setActiveButton', () => {
    it('should set the active class on the specified button and clear others', () => {
      const container = document.querySelector('.playlist-action-buttons');
      
      const btn1 = document.createElement('button');
      btn1.id = 'btn1';
      btn1.className = 'btn active';
      
      const btn2 = document.createElement('button');
      btn2.id = 'btn2';
      btn2.className = 'btn';
      
      container.appendChild(btn1);
      container.appendChild(btn2);
      
      bridgeUI.setActiveButton('btn2');
      
      expect(btn1.classList.contains('active')).toBe(false);
      expect(btn2.classList.contains('active')).toBe(true);
    });

    it('should do nothing if buttonId does not exist', () => {
      const container = document.querySelector('.playlist-action-buttons');
      const btn1 = document.createElement('button');
      btn1.className = 'btn active';
      container.appendChild(btn1);
      
      bridgeUI.setActiveButton('nonExistent');
      
      // Should clear existing active buttons anyway
      expect(btn1.classList.contains('active')).toBe(false);
    });
  });

  describe('addItem', () => {
    it('should render and append a new item row', () => {
      const item = { name: 'Test Track', videoId: 'v123' };
      const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
      
      bridgeUI.addItem(item, 'http://base/', 1);
      
      expect(container.children.length).toBe(1);
      expect(bridgeUI.rowMap.has(1)).toBe(true);
    });
  });

  describe('toggleSearchProgress', () => {
    it('should toggle visibility of progress elements and disable buttons', () => {
      const overlay = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SEARCH_PROGRESS);
      const btn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_UNAVAILABLE);
      
      bridgeUI.toggleSearchProgress(true);
      expect(overlay.classList.contains('hidden')).toBe(false);
      expect(btn.disabled).toBe(true);
      
      bridgeUI.toggleSearchProgress(false);
      expect(overlay.classList.contains('hidden')).toBe(true);
      expect(btn.disabled).toBe(false);
    });
  });

  describe('displayPlaylistsForSelection', () => {
    it('should render playlist cards and handle clicks', () => {
      const playlists = [{ id: 'p1', title: 'P1' }, { id: 'p2', title: 'P2' }];
      const grid = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLISTS_GRID);
      
      bridgeUI.displayPlaylistsForSelection(playlists);
      
      expect(grid.children.length).toBe(2);
      
      grid.children[0].click();
      expect(mockBridge.onPlaylistSelected).toHaveBeenCalledWith(playlists[0]);
    });

    it('should show no playlists message when cache is empty', () => {
      const grid = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLISTS_GRID);
      
      bridgeUI.displayPlaylistsForSelection([]);
      
      expect(grid.querySelector('.no-playlists-message')).not.toBeNull();
    });
  });

  describe('filterGridItems', () => {
    it('should show/hide rows based on search query', () => {
      const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
      
      const row1 = document.createElement('div');
      row1.className = 'grid-row';
      row1.dataset.searchString = 'apple pie';
      
      const row2 = document.createElement('div');
      row2.className = 'grid-row';
      row2.dataset.searchString = 'banana cake';
      
      container.appendChild(row1);
      container.appendChild(row2);
      
      bridgeUI.filterGridItems('apple');
      
      expect(row1.classList.contains('hidden')).toBe(false);
      expect(row2.classList.contains('hidden')).toBe(true);
      
      bridgeUI.filterGridItems('');
      expect(row1.classList.contains('hidden')).toBe(false);
      expect(row2.classList.contains('hidden')).toBe(false);
    });
  });

  describe('updateItemRow', () => {
    it('should replace an existing row and preserve checkbox state if user interacted', () => {
      const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
      const item = { name: 'Initial', videoId: 'v1' };
      
      const oldRow = bridgeUI.addItem(item, 'base/', 1);
      const checkbox = oldRow.querySelector('.item-checkbox');
      checkbox.checked = true;
      checkbox.dataset.userInteracted = 'true';
      
      const updatedItem = { name: 'Updated', videoId: 'v1' };
      bridgeUI.updateItemRow(updatedItem, 'base/', 1);
      
      const newRow = container.querySelector('.grid-row');
      expect(newRow.querySelector('.media-title').textContent).toBe('Updated');
      expect(newRow.querySelector('.item-checkbox').checked).toBe(true);
    });

    it('should respect current search filter when updating a row', () => {
      const searchInput = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SEARCH_INPUT);
      searchInput.value = 'filter';
      
      const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
      const item = { name: 'Does Not Match', videoId: 'v1' };
      
      bridgeUI.addItem(item, 'base/', 1);
      bridgeUI.updateItemRow(item, 'base/', 1);
      
      const row = container.querySelector('.grid-row');
      expect(row.classList.contains('hidden')).toBe(true);
    });
  });

  describe('initSearchBox', () => {
    it('should initialize search box and clear button', () => {
      const input = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SEARCH_INPUT);
      const clearBtn = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.CLEAR_SEARCH_BTN);
      
      bridgeUI.initSearchBox();
      expect(input.dataset.initialized).toBe('true');
      
      input.value = 'test';
      input.dispatchEvent(new Event('input'));
      expect(clearBtn.classList.contains('hidden')).toBe(false);
      
      clearBtn.click();
      expect(input.value).toBe('');
      expect(clearBtn.classList.contains('hidden')).toBe(true);
    });
  });

  describe('updateViewMode', () => {
    it('should set DEFAULT mode correctly', () => {
      const playlist = { isEditable: true };
      const { BUTTON_IDS } = CONSTANTS.UI;
      
      bridgeUI.updateViewMode(CONSTANTS.UI.VIEW_MODES.DEFAULT, playlist);
      
      expect(document.getElementById(BUTTON_IDS.REPLACE_SELECTED).classList.contains('hidden')).toBe(true);
      expect(document.getElementById(BUTTON_IDS.ADD_SELECTED).classList.contains('hidden')).toBe(true);
      expect(document.getElementById(BUTTON_IDS.REMOVE_SELECTED).classList.contains('hidden')).toBe(true);
      expect(document.getElementById(BUTTON_IDS.KEEP_ONLY_SELECTED).classList.contains('hidden')).toBe(true);
    });

    it('should set SEARCH_RESULTS mode correctly for editable playlist', () => {
      const playlist = { isEditable: true };
      const { BUTTON_IDS } = CONSTANTS.UI;
      
      bridgeUI.updateViewMode(CONSTANTS.UI.VIEW_MODES.SEARCH_RESULTS, playlist);
      
      expect(document.getElementById(BUTTON_IDS.REPLACE_SELECTED).classList.contains('hidden')).toBe(false);
      expect(document.getElementById(BUTTON_IDS.ADD_SELECTED).classList.contains('hidden')).toBe(false);
      expect(document.getElementById(BUTTON_IDS.REMOVE_SELECTED).classList.contains('hidden')).toBe(false);
    });

    it('should set DUPLICATES mode correctly', () => {
      const playlist = { isEditable: true };
      const { BUTTON_IDS } = CONSTANTS.UI;
      
      bridgeUI.updateViewMode(CONSTANTS.UI.VIEW_MODES.DUPLICATES, playlist);
      
      expect(document.getElementById(BUTTON_IDS.KEEP_ONLY_SELECTED).classList.contains('hidden')).toBe(false);
      expect(document.getElementById(BUTTON_IDS.REPLACE_SELECTED).classList.contains('hidden')).toBe(true);
    });

    it('should set IMPORT mode correctly', () => {
      const playlist = { isEditable: true };
      const { BUTTON_IDS } = CONSTANTS.UI;
      mockBridge.targetPlaylist = { title: 'Some Target' };
      
      bridgeUI.updateViewMode(CONSTANTS.UI.VIEW_MODES.IMPORT, playlist);
      
      expect(document.getElementById(BUTTON_IDS.ADD_SELECTED).classList.contains('hidden')).toBe(false);
      expect(document.getElementById(BUTTON_IDS.FIND_LOCAL_REPLACEMENTS).classList.contains('hidden')).toBe(false);
      
      const targetContainer = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLIST_CONTAINER);
      expect(targetContainer.classList.contains('hidden')).toBe(false);
    });
  });

  describe('setListOnlyMode', () => {
    it('should toggle list-only mode class and update buttons visibility', () => {
      const gridWrapper = document.querySelector(`.${CONSTANTS.UI.CLASSES.ITEMS_GRID_WRAPPER}`);
      const removeBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.REMOVE_SELECTED);
      const replaceBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.REPLACE_SELECTED);
      
      bridgeUI.setListOnlyMode(true);
      expect(gridWrapper.classList.contains('list-only-mode')).toBe(true);
      expect(removeBtn.classList.contains('hidden')).toBe(false);
      expect(replaceBtn.classList.contains('hidden')).toBe(true);
      
      bridgeUI.setListOnlyMode(false);
      expect(gridWrapper.classList.contains('list-only-mode')).toBe(false);
    });
  });

  describe('setDuplicateTrackMode', () => {
    it('should toggle duplicate track mode class', () => {
      const gridWrapper = document.querySelector(`.${CONSTANTS.UI.CLASSES.ITEMS_GRID_WRAPPER}`);
      
      bridgeUI.setDuplicateTrackMode(true);
      expect(gridWrapper.classList.contains('duplicate-track-mode')).toBe(true);
      
      bridgeUI.setDuplicateTrackMode(false);
      expect(gridWrapper.classList.contains('duplicate-track-mode')).toBe(false);
    });
  });

  describe('updateTargetPlaylistDisplay', () => {
    it('should set name when playlist is provided', () => {
      const playlist = { title: 'My Target Playlist' };
      const nameEl = document.getElementById('targetPlaylistName');
      
      bridgeUI.updateTargetPlaylistDisplay(playlist);
      
      expect(nameEl.textContent).toBe('My Target Playlist');
    });

    it('should not change visibility when playlist is null', () => {
      const container = document.getElementById('targetPlaylistContainer');
      container.classList.remove('hidden');
      
      bridgeUI.updateTargetPlaylistDisplay(null);
      
      // Should remain visible (visibility is handled by updateViewMode)
      expect(container.classList.contains('hidden')).toBe(false);
    });
  });
});
