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
});
