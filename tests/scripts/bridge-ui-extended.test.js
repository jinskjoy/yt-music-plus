import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BridgeUI } from '../../scripts/bridge-ui.js';
import { CONSTANTS } from '../../utils/constants.js';
import { MediaGridRow } from '../../utils/ui-helper.js';
import fs from 'fs';
import path from 'path';

describe('BridgeUI Extended', () => {
  let mockBridge;
  let bridgeUI;

  beforeEach(() => {
    const htmlPath = path.resolve(__dirname, '../../html/in-site-popup.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = htmlContent;

    document.body.insertAdjacentHTML('beforeend', `
      <template id="yt-music-plus-action-buttons-template">
        <div id="${CONSTANTS.UI.ELEMENT_IDS.ACTION_BUTTONS}"></div>
      </template>
    `);

    mockBridge = {
      cancelTargetSelection: vi.fn(),
      initPlaylistFetching: vi.fn(),
      onTargetPlaylistSelected: vi.fn(),
      onPlaylistSelected: vi.fn(),
      showPopup: vi.fn(),
      _createMediaObjects: vi.fn(() => ({ originalMedia: {}, replacementMedia: {} })),
      playerHandler: {}
    };
    
    bridgeUI = new BridgeUI(mockBridge);
  });

  it('should initialize and attach target modal buttons', () => {
    const closeBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.CLOSE_TARGET_MODAL);
    closeBtn.click();
    expect(mockBridge.cancelTargetSelection).toHaveBeenCalled();
  });

  it('should set progress text and show footer', () => {
    const footer = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SELECTION_FOOTER);
    footer.classList.add(CONSTANTS.UI.CLASSES.HIDDEN);
    
    bridgeUI.setProgressText('Loading...');
    
    expect(document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PROGRESS_TEXT).textContent).toBe('Loading...');
    expect(footer.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
  });

  it('should clear playlist items', () => {
    const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
    container.innerHTML = '<div>Item</div>';
    bridgeUI.rowMap.set(1, {});
    
    bridgeUI.clearPlaylistItemsContainer();
    
    expect(container.children.length).toBe(0);
    expect(bridgeUI.rowMap.size).toBe(0);
  });

  it('should set active button', () => {
    const btnId = CONSTANTS.UI.BUTTON_IDS.FIND_UNAVAILABLE;
    const btn = document.getElementById(btnId);
    
    bridgeUI.setActiveButton(btnId);
    expect(btn.classList.contains(CONSTANTS.UI.CLASSES.ACTIVE)).toBe(true);
    expect(bridgeUI.hasActiveActionButton()).toBe(true);
    
    bridgeUI.clearActiveButtons();
    expect(btn.classList.contains(CONSTANTS.UI.CLASSES.ACTIVE)).toBe(false);
  });

  it('should toggle search progress and disable buttons', () => {
    const btn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_UNAVAILABLE);
    bridgeUI.toggleSearchProgress(true);
    expect(btn.disabled).toBe(true);
    
    bridgeUI.toggleSearchProgress(false);
    expect(btn.disabled).toBe(false);
  });

  it('should display target playlists', () => {
    const playlists = [{ id: 'p1', title: 'P1' }];
    const grid = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.TARGET_PLAYLISTS_GRID);
    
    // We need the template for PlaylistCard
    document.body.insertAdjacentHTML('beforeend', `
      <template id="${CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_CARD_TEMPLATE}">
        <div class="${CONSTANTS.UI.CLASSES.PLAYLIST_CARD}">
          <img class="${CONSTANTS.UI.CLASSES.PLAYLIST_CARD_THUMBNAIL}">
          <div class="${CONSTANTS.UI.CLASSES.PLAYLIST_CARD_TITLE}"></div>
          <div class="${CONSTANTS.UI.CLASSES.PLAYLIST_CARD_META}"></div>
        </div>
      </template>
    `);
    
    bridgeUI.displayTargetPlaylists(playlists);
    expect(grid.children.length).toBe(1);
  });

  it('should inject action buttons', () => {
    const header = document.createElement(CONSTANTS.UI.SELECTORS.YT_MUSIC_HEADER);
    document.body.appendChild(header);
    
    bridgeUI.injectActionButtons();
    expect(document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ACTION_BUTTONS)).not.toBeNull();
  });

  it('should update view mode', () => {
    const findLocalBtn = document.getElementById(CONSTANTS.UI.BUTTON_IDS.FIND_LOCAL_REPLACEMENTS);
    bridgeUI.updateViewMode(CONSTANTS.UI.VIEW_MODES.IMPORT, { isEditable: true });
    expect(findLocalBtn.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
    
    bridgeUI.updateViewMode(CONSTANTS.UI.VIEW_MODES.LIST_ALL, { isEditable: true });
    expect(findLocalBtn.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
  });

  describe('addItems and race conditions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Setup grid row template
      document.body.insertAdjacentHTML('beforeend', `
        <template id="${CONSTANTS.UI.ELEMENT_IDS.GRID_ROW_TEMPLATE}">
          <div class="${CONSTANTS.UI.CLASSES.GRID_ROW}">
            <div class="${CONSTANTS.UI.CLASSES.GRID_COL_SERIAL}"></div>
            <div class="${CONSTANTS.UI.CLASSES.GRID_COL_ORIGINAL}"></div>
            <div class="${CONSTANTS.UI.CLASSES.GRID_COL_REPLACEMENT}"></div>
            <input type="checkbox" class="${CONSTANTS.UI.CLASSES.ITEM_CHECKBOX}">
          </div>
        </template>
        <template id="${CONSTANTS.UI.ELEMENT_IDS.MEDIA_ITEM_TEMPLATE}">
          <div class="${CONSTANTS.UI.CLASSES.MEDIA_ITEM}">
            <img class="${CONSTANTS.UI.CLASSES.MEDIA_THUMBNAIL}">
            <div class="${CONSTANTS.UI.CLASSES.MEDIA_TITLE}"></div>
          </div>
        </template>
      `);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should add items in chunks and handle yield', async () => {
      const items = Array(120).fill({ name: 'Track' });
      const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
      
      const promise = bridgeUI.addItems(items, 'base/', 1, 50);
      
      // First chunk (50) should be added immediately
      expect(container.children.length).toBe(50);
      
      // Advance timers for next chunk
      vi.advanceTimersByTime(0);
      await Promise.resolve(); // Allow microtasks
      expect(container.children.length).toBe(100);
      
      // Advance timers for last chunk
      vi.advanceTimersByTime(0);
      await Promise.resolve();
      expect(container.children.length).toBe(120);
      
      await promise;
    });

    it('should abort rendering if renderVersion changes (race condition)', async () => {
      const items = Array(100).fill({ name: 'Track' });
      const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
      
      const promise = bridgeUI.addItems(items, 'base/', 1, 50);
      expect(container.children.length).toBe(50);
      
      // Change version by clearing or manual increment
      bridgeUI.clearPlaylistItemsContainer();
      
      vi.advanceTimersByTime(0);
      await Promise.resolve();
      
      // Should not have added the second chunk because version changed
      expect(container.children.length).toBe(0); // 0 because clearPlaylistItemsContainer clears it
      
      await promise;
    });

    it('should return early if container is missing', async () => {
      document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER).remove();
      const items = [{ name: 'T1' }];
      await bridgeUI.addItems(items, 'base/');
      expect(bridgeUI.rowMap.size).toBe(0);
    });
  });

  describe('Visibility and modes', () => {
    it('should clear grid when switching to selection screen', () => {
      const container = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.ITEMS_GRID_CONTAINER);
      container.innerHTML = '<div>Row</div>';
      
      bridgeUI.setPlaylistScreenVisibility(true);
      expect(container.children.length).toBe(0);
    });

    it('should update footer visibility correctly', () => {
      const counts = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.PLAYLIST_COUNTS);
      const selCount = document.getElementById(CONSTANTS.UI.ELEMENT_IDS.SELECTION_COUNT);
      
      bridgeUI.updateFooterVisibility(true);
      expect(counts.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
      expect(selCount.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
      
      bridgeUI.updateFooterVisibility(false);
      expect(counts.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(true);
      expect(selCount.classList.contains(CONSTANTS.UI.CLASSES.HIDDEN)).toBe(false);
    });
  });
});
