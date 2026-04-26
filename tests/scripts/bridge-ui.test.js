import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BridgeUI } from '../../scripts/bridge-ui.js';
import { UIHelper, MediaGridRow, PlaylistCard } from '../../utils/ui-helper.js';
import { BrowserUtils } from '../../utils/utils.js';
import fs from 'fs';
import path from 'path';

vi.mock('../../utils/ui-helper.js', () => ({
  UIHelper: {
    updateCheckAllCheckbox: vi.fn(),
    createNoPlaylistsMessage: vi.fn(() => document.createElement('div')),
    createActionButtons: vi.fn(() => document.createElement('div'))
  },
  MediaGridRow: {
    render: vi.fn(() => {
      const el = document.createElement('div');
      el.className = 'grid-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'item-checkbox';
      el.appendChild(cb);
      return el;
    })
  },
  PlaylistCard: {
    render: vi.fn(() => document.createElement('div'))
  }
}));

vi.mock('../../utils/utils.js', () => ({
  BrowserUtils: {
    debounce: vi.fn((fn) => fn)
  }
}));

describe('BridgeUI', () => {
  let bridgeUI;
  let mockBridge;

  beforeEach(() => {
    const htmlPath = path.resolve(__dirname, '../../html/in-site-popup.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = htmlContent;

    mockBridge = {
      playerHandler: {},
      _createMediaObjects: vi.fn(() => ({ originalMedia: {}, replacementMedia: {} })),
      onPlaylistSelected: vi.fn(),
      initPlaylistFetching: vi.fn(),
      showPopup: vi.fn()
    };

    bridgeUI = new BridgeUI(mockBridge);
    vi.clearAllMocks();
  });

  describe('setProgressText', () => {
    it('should set text and show footer when text is provided', () => {
      bridgeUI.setProgressText('Loading...');
      const el = document.getElementById('progressText');
      const footer = document.getElementById('ytMusicPlusSelectionFooter');
      
      expect(el.textContent).toBe('Loading...');
      expect(el.classList.contains('hidden')).toBe(false);
      expect(footer.classList.contains('hidden')).toBe(false);
    });

    it('should hide progress text when text is empty', () => {
      bridgeUI.setProgressText('');
      const el = document.getElementById('progressText');
      expect(el.classList.contains('hidden')).toBe(true);
    });
  });

  describe('clearPlaylistItemsContainer', () => {
    it('should clear rows and reset buttons', () => {
      const container = document.getElementById('yt-music-plus-itemsGridContainer');
      container.appendChild(document.createElement('div'));
      
      const replaceBtn = document.getElementById('replaceSelectedBtn');
      replaceBtn.classList.add('hidden');

      bridgeUI.clearPlaylistItemsContainer();

      expect(container.children.length).toBe(0);
      expect(replaceBtn.classList.contains('hidden')).toBe(false);
      expect(bridgeUI.rowMap.size).toBe(0);
    });
  });

  describe('addItem', () => {
    it('should render and append a new item row', () => {
      const container = document.getElementById('yt-music-plus-itemsGridContainer');
      const item = { id: '1' };
      
      bridgeUI.addItem(item, 'url', 0);

      expect(mockBridge._createMediaObjects).toHaveBeenCalledWith(item, 'url');
      expect(MediaGridRow.render).toHaveBeenCalled();
      expect(container.children.length).toBe(1);
      expect(bridgeUI.rowMap.has(0)).toBe(true);
    });
  });

  describe('toggleSearchProgress', () => {
    it('should toggle visibility of progress elements and disable buttons', () => {
      const searchProgress = document.getElementById('searchProgress');
      const findUnavailableBtn = document.getElementById('findUnavailableBtn');
      
      bridgeUI.toggleSearchProgress(true, true);

      expect(searchProgress.classList.contains('hidden')).toBe(false);
      expect(document.getElementById('cancelSearchBtn').classList.contains('hidden')).toBe(false);
      expect(findUnavailableBtn.disabled).toBe(true);
      expect(UIHelper.updateCheckAllCheckbox).toHaveBeenCalled();

      bridgeUI.toggleSearchProgress(false);
      expect(searchProgress.classList.contains('hidden')).toBe(true);
      expect(findUnavailableBtn.disabled).toBe(false);
    });
  });

  describe('displayPlaylistsForSelection', () => {
    it('should render playlist cards and handle clicks', () => {
      const grid = document.getElementById('playlistsGrid');
      const playlists = [{ id: 'p1', title: 'P1' }];
      
      const mockCard = document.createElement('div');
      PlaylistCard.render.mockReturnValue(mockCard);

      bridgeUI.displayPlaylistsForSelection(playlists);

      expect(grid.children.length).toBe(1);
      expect(PlaylistCard.render).toHaveBeenCalledWith(playlists[0]);

      mockCard.dispatchEvent(new MouseEvent('click'));
      expect(mockBridge.onPlaylistSelected).toHaveBeenCalledWith(playlists[0]);
    });

    it('should show no playlists message when cache is empty', () => {
      bridgeUI.displayPlaylistsForSelection([]);
      expect(UIHelper.createNoPlaylistsMessage).toHaveBeenCalled();
    });
  });

  describe('filterGridItems', () => {
    it('should show/hide rows based on search query', () => {
      const container = document.getElementById('yt-music-plus-itemsGridContainer');
      
      const row1 = document.createElement('div');
      row1.className = 'grid-row';
      row1.dataset.searchString = 'song title artist';
      
      const row2 = document.createElement('div');
      row2.className = 'grid-row';
      row2.dataset.searchString = 'another track';
      
      container.appendChild(row1);
      container.appendChild(row2);

      bridgeUI.filterGridItems('title');

      expect(row1.classList.contains('hidden')).toBe(false);
      expect(row2.classList.contains('hidden')).toBe(true);

      bridgeUI.filterGridItems('');
      expect(row1.classList.contains('hidden')).toBe(false);
      expect(row2.classList.contains('hidden')).toBe(false);
    });
  });

  describe('updateItemRow', () => {
    it('should replace an existing row and preserve checkbox state if user interacted', () => {
      const container = document.getElementById('yt-music-plus-itemsGridContainer');
      
      const oldRow = document.createElement('div');
      const oldCheckbox = document.createElement('input');
      oldCheckbox.type = 'checkbox';
      oldCheckbox.className = 'item-checkbox';
      oldCheckbox.checked = true;
      oldCheckbox.dataset.userInteracted = 'true';
      oldRow.appendChild(oldCheckbox);
      container.appendChild(oldRow);
      
      bridgeUI.rowMap.set(0, oldRow);

      const newItem = { id: 'new' };
      bridgeUI.updateItemRow(newItem, 'url', 0);

      const newRow = bridgeUI.rowMap.get(0);
      expect(newRow).not.toBe(oldRow);
      expect(container.contains(newRow)).toBe(true);
      expect(container.contains(oldRow)).toBe(false);

      const newCheckbox = newRow.querySelector('.item-checkbox');
      expect(newCheckbox.checked).toBe(true);
      expect(newCheckbox.dataset.userInteracted).toBe('true');
    });
  });

  describe('initSearchBox', () => {
    it('should initialize search box and clear button', () => {
      const searchInput = document.getElementById('ytMusicPlusSearchInput');
      const clearBtn = document.getElementById('ytMusicPlusClearSearchBtn');
      
      bridgeUI.initSearchBox();
      expect(searchInput.dataset.initialized).toBe('true');

      // Test input event
      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input'));
      expect(clearBtn.classList.contains('hidden')).toBe(false);

      // Test clear button click
      clearBtn.dispatchEvent(new MouseEvent('click'));
      expect(searchInput.value).toBe('');
      expect(clearBtn.classList.contains('hidden')).toBe(true);
    });
  });
});
