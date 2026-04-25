import * as Utils from './utils.js';

/**
 * UIHelper - Handles UI utilities and helper functions
 */
export class UIHelper {
  static ISSUE_URL = 'https://chromewebstore.google.com/detail/lkieghnbgfnidfhdeclkjkmnjokmkmdc/support';

  /* --------------------------------------------------------------------------
   * Core DOM helpers (private)
   * --------------------------------------------------------------------------
   */

  /**
   * Shorthand for document.createElement with optional classes, attributes and text.
   * Improves readability when building complex DOM structures.
   *
   * @param {string} tag
   * @param {Object} [opts]
   * @param {string|string[]} [opts.classes] - single class or array of classes
   * @param {Object} [opts.attrs] - key/value map of attributes to set
   * @param {string} [opts.text] - textContent to assign
   * @returns {HTMLElement}
   */
  static _createElement(tag, opts = {}) {
    const el = document.createElement(tag);
    if (opts.classes) {
      // support either an array or a space‑separated string of class names
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

  // ---------------------------------------------------------------------------
  // public helpers
  // ---------------------------------------------------------------------------

  /**
   * Display a transient status message on a given element.
   * @param {Element} element - Element to display status in
   * @param {string} message - Message to display
   * @param {'success'|'error'|'info'} [type='info'] - Message type
   * @param {number} [duration=3000] - Duration in ms (0 = permanent)
   */
  static showStatus(element, message, type = 'info', duration = 3000) {
    if (!element) return;

    element.textContent = message;
    element.className = `status-message show ${type}`;

    if (duration > 0) {
      setTimeout(() => element.classList.remove('show'), duration);
    }
  }


  /**
   * Format timestamp to readable date (Wrapper for Utils.formatDate)
   */
  static formatDate(timestamp, options = {}) {
    return Utils.formatDate(timestamp, options);
  }

  /**
   * Human‑friendly file size formatter (Wrapper for Utils.formatFileSize)
   */
  static formatFileSize(bytes) {
    return Utils.formatFileSize(bytes);
  }

  /**
   * Return a debounced version of `func` (Wrapper for Utils.debounce)
   */
  static debounce(func, delay = 300) {
    return Utils.debounce(func, delay);
  }

  /**
   * Throttles `func` (Wrapper for Utils.throttle)
   */
  static throttle(func, limit = 300) {
    return Utils.throttle(func, limit);
  }

  /**
   * Attempt to write `text` to the clipboard (Wrapper for Utils.copyToClipboard)
   */
  static async copyToClipboard(text) {
    return Utils.copyToClipboard(text);
  }

  /**
   * Generate a random 6‑digit hex color string (Wrapper for Utils.getRandomColor)
   */
  static getRandomColor() {
    return Utils.getRandomColor();
  }

  /**
   * Build a DOM fragment representing a track/item from a media object.
   *
   * @param {{name?:string,artist?:string,thumbnail?:string,url?:string}} media
   * @returns {HTMLElement}
   */
  static createMediaItem(media = {}) {
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

  /**
   * Construct a grid row representing a single mapping from an original
   * media item to its replacement.
   *
   * @param {Object} originalMedia
   * @param {Object} replacementMedia
   * @param {number} [serialNumber=1]
   * @returns {HTMLElement}
   */
  static createMediaGridRow(originalMedia, replacementMedia, serialNumber = 1) {
    const template = document.getElementById('yt-music-plus-grid-row-template');
    if (!template) {
      throw new Error('Template "yt-music-plus-grid-row-template" not found');
    }

    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.grid-row');
    
    row.dataset.serialNumber = serialNumber;
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
    originalCol.style.cursor = 'pointer';
    originalCol.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      if (!checkbox.disabled) {
        checkbox.checked = !checkbox.checked;
        checkbox.dataset.userInteracted = 'true';
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    originalCol.appendChild(UIHelper.createMediaItem(originalMedia));

    const replacementCol = row.querySelector('.grid-col-replacement');
    if (replacementMedia && replacementMedia.isGoodMatch === false) {
      replacementCol.querySelector('.warning-icon').classList.remove('hidden');
      replacementCol.classList.add('potential-mismatch');
    }
    replacementCol.appendChild(
      UIHelper.createMediaItem(
        replacementMedia || { name: 'No replacement found' }
      )
    );

    return row;
  }

  /**
   * Populate a grid container with rows generated from an array of records.
   * Existing rows are removed but the header row is preserved.
   *
   * @param {Array<{originalMedia:Object,replacementMedia:Object}>} records
   * @param {string} [containerId='yt-music-plus-itemsGridContainer']
   * @returns {HTMLElement|null}
   */
  static createMediaGridRows(records, containerId = 'yt-music-plus-itemsGridContainer') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with ID ${containerId} not found`);
      return null;
    }

    container.querySelectorAll('.grid-row').forEach((r) => r.remove());

    records.forEach((record, index) => {
      container.appendChild(
        UIHelper.createMediaGridRow(
          record.originalMedia,
          record.replacementMedia,
          index + 1
        )
      );
    });

    return container;
  }

  /**
   * Remove the grid row corresponding to a given original record (compares
   * videoId). Silently fails if container is missing.
   *
   * @param {Object} originalRecord
   * @param {string} [containerId='yt-music-plus-itemsGridContainer']
   */
  static removeMediaGridRow(originalRecord, containerId = 'yt-music-plus-itemsGridContainer') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with ID ${containerId} not found`);
      return;
    }

    container.querySelectorAll('.grid-row').forEach((row) => {
      const data = JSON.parse(row.dataset.originalMedia || '{}');
      let isMatch = false;
      if (data.videoId && originalRecord.videoId) {
        isMatch = data.videoId === originalRecord.videoId;
      } else {
        isMatch = data.name === originalRecord.name;
      }
      if (isMatch) row.remove();
    });
  }

  /**
   * Populate playlist information UI elements if they exist, only updating
   * fields when the corresponding data is available.
   *
   * @param {Object} playlist
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
   * Shows error message in the replacement column for a specific item
   * @param {Object} originalRecord 
   * @param {string} errorMessage 
   * @param {string} containerId 
   */
  static showErrorInGridRow(originalRecord, errorMessage, containerId = 'yt-music-plus-itemsGridContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('.grid-row').forEach((row) => {
      const data = JSON.parse(row.dataset.originalMedia || '{}');
      let isMatch = false;
      if (data.videoId && originalRecord.videoId) {
        isMatch = data.videoId === originalRecord.videoId;
      } else {
        isMatch = data.name === originalRecord.name;
      }
      if (isMatch) {
        const replacementCol = row.querySelector('.grid-col-replacement');
        if (replacementCol) {
          if (replacementCol.querySelector('.error-message')) return;

          const errorDiv = UIHelper._createElement('div', {
            classes: 'error-message',
            text: `Error: ${errorMessage}`
          });
          errorDiv.style.color = 'red';
          errorDiv.style.fontSize = '12px';
          errorDiv.style.fontWeight = '500';
          errorDiv.style.marginTop = '4px';
          replacementCol.appendChild(errorDiv);
        }
      }
    });
  }

  /**
   * Compute the Jaro‑Winkler similarity between two strings (Wrapper for Utils.calculateJaroWinklerDistance)
   */
  static calculateJaroWinklerDistance(s1, s2) {
    return Utils.calculateJaroWinklerDistance(s1, s2);
  }

  /**
   * Determine whether two titles are "close enough" (Wrapper for Utils.isGoodMatch)
   */
  static isGoodMatch(originalTitle, replacementTitle, similarityThreshold = 0.5) {
    return Utils.isGoodMatch(originalTitle, replacementTitle, similarityThreshold);
  }

  /**
   * Updates the select-all checkbox state based on individual checkbox states
   * Also enables/disables action buttons based on selection
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
    
    // Update select-all checkbox state
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    }

    // Enable/disable action buttons based on selection
    const anyChecked = Array.from(allCheckboxes).some(cb => cb.checked);
    const anyCheckedWithReplacement = Array.from(allCheckboxes).some(cb => {
      if (!cb.checked) return false;
      const row = cb.closest('.grid-row');
      if (!row) return false;
      const replacement = JSON.parse(row.dataset.replacementMedia || '{}');
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

    const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;
    const totalCount = allCheckboxes.length;
    
    const footer = popupElement.querySelector('#ytMusicPlusSelectionFooter');
    
    if (footer) {
      const textContainer = footer.querySelector('.footer-right') || footer;
      
      if (totalCount > 0) {
        textContainer.textContent = `${checkedCount} of ${totalCount} item${totalCount !== 1 ? 's' : ''} selected`;
        textContainer.classList.remove('hidden');
      } else {
        textContainer.classList.add('hidden');
      }

      const progressText = document.getElementById('progressText');
      const hasProgressText = progressText && !progressText.classList.contains('hidden');

      if (totalCount > 0 || isSearching || hasProgressText) {
        footer.classList.remove('hidden');
      } else {
        footer.classList.add('hidden');
      }
    }
  }

  /**
   * Read the current set of checked rows from the grid and return their
   * original+replacement metadata.
   *
   * @returns {Array<{originalMedia:Object,replacementMedia:Object}>}
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
   * Quick factory for a playlist card element used in the playlist picker UI.
   * @param {Object} playlist
   * @returns {HTMLElement}
   */
  static createPlaylistCard(playlist = {}) {
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

  /**
   * Build and return the set of action buttons that are injected into the
   * YouTube Music header.
   *
   * @returns {HTMLElement}
   */
  static createActionButtons() {
    const template = document.getElementById('yt-music-plus-action-buttons-template');
    if (!template) {
      throw new Error('Template "yt-music-plus-action-buttons-template" not found');
    }

    const clone = template.content.cloneNode(true);
    return clone.querySelector('#yt-music-plus-action-buttons');
  }

  /**
   * Helper for displaying a fallback message when no playlists are
   * available in a grid layout.
   *
   * @returns {HTMLElement}
   */
  static createNoPlaylistsMessage() {
    const msg = UIHelper._createElement('div');
    msg.appendChild(
      UIHelper._createElement('span', {
        text: 'No editable playlists found. Try refreshing the page. Google changes their API frequently, if you think it\'s broken, please report an issue on ',
      })
    );
    msg.appendChild(
      UIHelper._createElement('a', {
        text: 'the Chrome Web Store',
        attrs: {
          href: UIHelper.ISSUE_URL,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      })
    );
    Object.assign(msg.style, {
      gridColumn: '1/-1',
      padding: '20px',
      textAlign: 'center',
    });
    return msg;
  }

  /**
   * Toggles the expanded state of the items grid by hiding/showing playlist info.
   * @param {boolean} [forceExpand] - If true, forces expanded state. If false, forces collapsed. If undefined, toggles.
   */
  static toggleGrid(forceExpand) {
    const infoSection = document.querySelector('.playlist-info-section');
    const toggleGridBtn = document.getElementById('toggleGridBtn');
    const gridWrapper = document.querySelector('.items-grid-wrapper');

    if (!infoSection) return;

    const isHidden = infoSection.classList.contains('collapsed');
    const shouldExpand = forceExpand !== undefined ? forceExpand : !isHidden;

    if (shouldExpand) {
      infoSection.classList.add('collapsed');
      if (toggleGridBtn) {
        toggleGridBtn.textContent = '⤡';
        toggleGridBtn.title = 'Collapse grid';
        toggleGridBtn.setAttribute('aria-label', 'Collapse grid');
      }
      if (gridWrapper) gridWrapper.classList.add('expanded');
    } else {
      infoSection.classList.remove('collapsed');
      if (toggleGridBtn) {
        toggleGridBtn.textContent = '⤢';
        toggleGridBtn.title = 'Expand grid';
        toggleGridBtn.setAttribute('aria-label', 'Expand grid');
      }
      if (gridWrapper) gridWrapper.classList.remove('expanded');
    }
  }
}

