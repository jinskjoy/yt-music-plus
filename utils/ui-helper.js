import { TextSimilarity, Formatters, BrowserUtils } from './utils.js';

/**
 * MediaItem - Represents a track/item UI component
 */
export class MediaItem {
  /**
   * Build a DOM fragment representing a track/item from a media object.
   * @param {Object} media
   * @returns {HTMLElement}
   */
  static render(media = {}) {
    const template = document.getElementById('yt-music-plus-media-item-template');
    if (!template) {
      throw new Error('Template "yt-music-plus-media-item-template" not found');
    }

    const clone = template.content.cloneNode(true);
    const item = clone.querySelector('.media-item');
    const thumb = item.querySelector('.media-thumbnail');
    const title = item.querySelector('.media-title');
    const artist = item.querySelector('.media-artist');
    const link = item.querySelector('.media-link');

    if (media.thumbnail) {
      thumb.src = media.thumbnail;
    } else {
      thumb.remove();
    }

    title.textContent = media.name || 'Unknown Title';

    if (media.artist) {
      artist.textContent = media.artist;
    } else {
      artist.remove();
    }

    if (media.url) {
      link.href = media.url;
    } else {
      link.remove();
    }

    return item;
  }
}

/**
 * MediaGridRow - Represents a row in the results grid
 */
export class MediaGridRow {
  /**
   * Construct a grid row representing a single mapping from an original
   * media item to its replacement.
   *
   * @param {Object} originalMedia
   * @param {Object} replacementMedia
   * @param {number} [serialNumber=1]
   * @returns {HTMLElement}
   */
  static render(originalMedia, replacementMedia, serialNumber = 1) {
    const template = document.getElementById('yt-music-plus-grid-row-template');
    if (!template) {
      throw new Error('Template "yt-music-plus-grid-row-template" not found');
    }

    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.grid-row');
    
    row.dataset.serialNumber = serialNumber;
    row.dataset.videoId = originalMedia.videoId || '';
    row.dataset.name = originalMedia.name || '';
    row.dataset.originalMedia = JSON.stringify(originalMedia);
    row.dataset.replacementMedia = JSON.stringify(replacementMedia || {});

    const searchTerms = [
      originalMedia?.name,
      originalMedia?.artist,
      originalMedia?.album,
      replacementMedia?.name,
      replacementMedia?.artist,
      replacementMedia?.album
    ].filter(Boolean).join(' ').toLowerCase();
    row.dataset.searchString = searchTerms;

    row.querySelector('.grid-col-serial').textContent = serialNumber;

    const checkbox = row.querySelector('.item-checkbox');
    const isListOnlyMode = document.querySelector('.items-grid-wrapper')?.classList.contains('list-only-mode');
    const hasReplacement = replacementMedia && replacementMedia.videoId;
    const isPending = replacementMedia && replacementMedia.isPending;
    const isGoodMatch = replacementMedia ? replacementMedia.isGoodMatch !== false : true;

    checkbox.checked = replacementMedia && replacementMedia.isChecked !== undefined 
      ? replacementMedia.isChecked 
      : (!!hasReplacement && isGoodMatch);

    if (!isListOnlyMode && !hasReplacement && !isPending) {
      checkbox.disabled = true;
    }
    const originalCol = row.querySelector('.grid-col-original');
    originalCol.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      if (!checkbox.disabled) {
        checkbox.checked = !checkbox.checked;
        checkbox.dataset.userInteracted = 'true';
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    originalCol.appendChild(MediaItem.render(originalMedia));

    const replacementCol = row.querySelector('.grid-col-replacement');
    if (replacementMedia && replacementMedia.isGoodMatch === false) {
      replacementCol.querySelector('.warning-icon').classList.remove('hidden');
      replacementCol.classList.add('potential-mismatch');
    }
    replacementCol.appendChild(
      MediaItem.render(
        replacementMedia || { name: 'No replacement found' }
      )
    );

    return row;
  }
}

/**
 * PlaylistCard - Represents a playlist card component
 */
export class PlaylistCard {
  /**
   * Quick factory for a playlist card element used in the playlist picker UI.
   * @param {Object} playlist
   * @returns {HTMLElement}
   */
  static render(playlist = {}) {
    const template = document.getElementById('yt-music-plus-playlist-card-template');
    if (!template) {
      throw new Error('Template "yt-music-plus-playlist-card-template" not found');
    }

    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.playlist-card');
    const thumb = card.querySelector('.playlist-card-thumbnail');
    const title = card.querySelector('.playlist-card-title');
    const meta = card.querySelector('.playlist-card-meta');

    thumb.src = playlist.thumbnail || '';
    thumb.alt = playlist.title || 'Playlist Thumbnail';
    title.textContent = playlist.title || 'Untitled Playlist';
    meta.textContent = playlist.subtitle || '';

    return card;
  }
}

/**
 * UIHelper - Handles high-level UI operations and state management
 */
export class UIHelper {
  static ISSUE_URL = 'https://chromewebstore.google.com/detail/lkieghnbgfnidfhdeclkjkmnjokmkmdc/support';

  /**
   * Shorthand for document.createElement with optional configuration.
   * @param {string} tag
   * @param {Object} [opts]
   * @returns {HTMLElement}
   */
  static _createElement(tag, opts = {}) {
    const el = document.createElement(tag);
    if (opts.classes) {
      const classes = Array.isArray(opts.classes)
        ? opts.classes
        : String(opts.classes).trim().split(/\s+/);
      if (classes.length) el.classList.add(...classes);
    }
    if (opts.attrs) {
      Object.entries(opts.attrs).forEach(([key, value]) => el.setAttribute(key, value));
    }
    if (opts.text) el.textContent = opts.text;
    return el;
  }

  /**
   * Display a transient status message on a given element.
   * @param {Element} element
   * @param {string} message
   * @param {'success'|'error'|'info'} [type='info']
   * @param {number} [duration=3000]
   */
  static showStatus(element, message, type = 'info', duration = 3000) {
    if (!element) return;

    element.textContent = message;
    element.className = `status-message show ${type}`;

    if (duration > 0) {
      setTimeout(() => element.classList.remove('show'), duration);
    }
  }

  // --- Wrapper methods for delegated utility classes ---

  static formatDate(ts, opts) { return Formatters.formatDate(ts, opts); }
  static formatFileSize(bytes) { return Formatters.formatFileSize(bytes); }
  static debounce(fn, delay) { return BrowserUtils.debounce(fn, delay); }
  static throttle(fn, limit) { return BrowserUtils.throttle(fn, limit); }
  static async copyToClipboard(text) { return BrowserUtils.copyToClipboard(text); }
  static getRandomColor() { return BrowserUtils.getRandomColor(); }
  static calculateJaroWinklerDistance(s1, s2) { return TextSimilarity.calculateJaroWinklerDistance(s1, s2); }
  static isGoodMatch(t1, t2, threshold) { return TextSimilarity.isGoodMatch(t1, t2, threshold); }

  /**
   * Populate a grid container with rows.
   */
  static createMediaGridRows(records, containerId = 'yt-music-plus-itemsGridContainer') {
    const container = document.getElementById(containerId);
    if (!container) return null;

    container.querySelectorAll('.grid-row').forEach((r) => r.remove());

    records.forEach((record, index) => {
      container.appendChild(
        MediaGridRow.render(
          record.originalMedia,
          record.replacementMedia,
          index + 1
        )
      );
    });

    return container;
  }

  /**
   * Remove a row from the grid.
   */
  static removeMediaGridRow(originalRecord, containerId = 'yt-music-plus-itemsGridContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    let row;
    if (originalRecord.videoId) {
      row = container.querySelector(`.grid-row[data-video-id="${originalRecord.videoId}"]`);
    } else {
      // Fallback to name if no videoId (e.g. local files)
      row = Array.from(container.querySelectorAll('.grid-row')).find(r => r.dataset.name === originalRecord.name);
    }

    if (row) {
      row.remove();
      UIHelper.updateCheckAllCheckbox();
    }
  }

  /**
   * Populate playlist info UI.
   */
  static setPlaylistDetails(playlist = {}) {
    const map = [
      ['yt-music-plus-playlistThumbnail', 'src', playlist.thumbnail],
      ['yt-music-plus-playlistName', 'textContent', playlist.title],
      ['yt-music-plus-playlistTrackCount', 'textContent', playlist.subtitle],
      ['yt-music-plus-playlistDescription', 'textContent', playlist.owner],
    ];

    map.forEach(([id, prop, value]) => {
      const el = document.getElementById(id);
      if (el && value != null) el[prop] = value;
    });
  }

  /**
   * Shows error in row.
   */
  static showErrorInGridRow(originalRecord, errorMessage, containerId = 'yt-music-plus-itemsGridContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    let row;
    if (originalRecord.videoId) {
      row = container.querySelector(`.grid-row[data-video-id="${originalRecord.videoId}"]`);
    } else {
      row = Array.from(container.querySelectorAll('.grid-row')).find(r => r.dataset.name === originalRecord.name);
    }

    if (row) {
      const replacementCol = row.querySelector('.grid-col-replacement');
      if (replacementCol && !replacementCol.querySelector('.error-message')) {
        const template = document.getElementById('yt-music-plus-error-message-template');
        if (!template) throw new Error('Template "yt-music-plus-error-message-template" not found');
        
        const errorDiv = template.content.cloneNode(true).querySelector('.error-message');
        errorDiv.textContent = `Error: ${errorMessage}`;
        replacementCol.appendChild(errorDiv);
      }
    }
  }

  /**
   * Updates check-all checkbox and button states.
   */
  static updateCheckAllCheckbox() {
    const popupElement = document.querySelector('.yt-music-extended-popup-container');
    if (!popupElement) return;

    const selectAllCheckbox = popupElement.querySelector('#yt-music-plus-selectAllCheckbox');
    const checkboxes = Array.from(popupElement.querySelectorAll('.item-checkbox:not([disabled])')).filter(cb => {
      const row = cb.closest('.grid-row');
      return row && !row.classList.contains('hidden');
    });
    const allCheckboxes = popupElement.querySelectorAll('.item-checkbox');
    
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    }

    const anyChecked = Array.from(allCheckboxes).some(cb => cb.checked);
    const anyCheckedWithReplacement = Array.from(allCheckboxes).some(cb => {
      if (!cb.checked) return false;
      const row = cb.closest('.grid-row');
      const replacement = JSON.parse(row?.dataset.replacementMedia || '{}');
      return !!replacement.videoId;
    });

    const isListOnlyMode = popupElement.querySelector('.items-grid-wrapper')?.classList.contains('list-only-mode');
    const searchProgress = document.getElementById('searchProgress');
    const isSearching = searchProgress && !searchProgress.classList.contains('hidden');

    const removeBtn = popupElement.querySelector('#removeSelectedBtn');
    if (removeBtn) removeBtn.disabled = isSearching ? true : !anyChecked;

    const addBtn = popupElement.querySelector('#addSelectedBtn');
    if (addBtn) addBtn.disabled = isSearching || isListOnlyMode ? true : !anyCheckedWithReplacement;

    const replaceBtn = popupElement.querySelector('#replaceSelectedBtn');
    if (replaceBtn) replaceBtn.disabled = isSearching || isListOnlyMode ? true : !anyCheckedWithReplacement;

    const footer = popupElement.querySelector('#ytMusicPlusSelectionFooter');
    if (footer) {
      const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;
      const totalCount = allCheckboxes.length;
      const textContainer = footer.querySelector('.footer-right') || footer;
      
      if (totalCount > 0) {
        textContainer.textContent = `${checkedCount} of ${totalCount} item${totalCount !== 1 ? 's' : ''} selected`;
        textContainer.classList.remove('hidden');
      } else {
        textContainer.classList.add('hidden');
      }

      const progressText = document.getElementById('progressText');
      const hasProgressText = progressText && !progressText.classList.contains('hidden');
      footer.classList.toggle('hidden', !(totalCount > 0 || isSearching || hasProgressText));
    }
  }

  /**
   * Get selected items from grid.
   */
  static getSelectedMediaItems() {
    return Array.from(document.querySelectorAll('.item-checkbox'))
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => {
        const row = checkbox.closest('.grid-row');
        return {
          originalMedia: JSON.parse(row.dataset.originalMedia || '{}'),
          replacementMedia: JSON.parse(row.dataset.replacementMedia || '{}'),
        };
      });
  }

  /**
   * Create action buttons for header.
   */
  static createActionButtons() {
    const template = document.getElementById('yt-music-plus-action-buttons-template');
    if (!template) throw new Error('Template "yt-music-plus-action-buttons-template" not found');
    return template.content.cloneNode(true).querySelector('#yt-music-plus-action-buttons');
  }

  /**
   * Create fallback message for playlists grid.
   */
  static createNoPlaylistsMessage() {
    const template = document.getElementById('yt-music-plus-no-playlists-template');
    if (!template) throw new Error('Template "yt-music-plus-no-playlists-template" not found');
    return template.content.cloneNode(true).querySelector('.no-playlists-message');
  }

  /**
   * Toggle grid expansion.
   */
  static toggleGrid(forceExpand) {
    const infoSection = document.querySelector('.playlist-info-section');
    const toggleGridBtn = document.getElementById('toggleGridBtn');
    const gridWrapper = document.querySelector('.items-grid-wrapper');

    if (!infoSection) return;

    const isHidden = infoSection.classList.contains('collapsed');
    const shouldExpand = forceExpand !== undefined ? forceExpand : !isHidden;

    infoSection.classList.toggle('collapsed', shouldExpand);
    if (toggleGridBtn) {
      toggleGridBtn.textContent = shouldExpand ? '⤡' : '⤢';
      toggleGridBtn.title = shouldExpand ? 'Collapse grid' : 'Expand grid';
    }
    if (gridWrapper) gridWrapper.classList.toggle('expanded', shouldExpand);
  }
}
