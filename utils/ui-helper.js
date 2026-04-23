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
   * Format timestamp to readable date
   * @param {number} timestamp - Timestamp in milliseconds
   * @param {Object} options - Formatting options
   * @returns {string} Formatted date string
   */
  /**
   * Convert a millisecond timestamp into a human‑readable string.
   * Supports a few common formats; falls back to toLocaleString if unknown.
   *
   * @param {number} timestamp - milliseconds since epoch
   * @param {Object} [options]
   * @param {'short'|'long'|'time'} [options.format='short']
   * @param {string} [options.locale='en-US']
   * @returns {string}
   */
  static formatDate(timestamp, options = {}) {
    const date = new Date(timestamp);
    const { format = 'short', locale = 'en-US' } = options;

    switch (format) {
      case 'long':
        return date.toLocaleDateString(locale, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      case 'time':
        return date.toLocaleTimeString(locale);
      case 'short':
      default:
        return date.toLocaleDateString(locale);
    }
  }

  /**
   * Format file size
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size string
   */
  /**
   * Human‑friendly file size formatter (metric base 1024).
   * @param {number} bytes
   * @returns {string}
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const units = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${units[i]}`;
  }

  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  /**
   * Return a debounced version of `func` that fires after `delay` ms have passed
   * since the last call. Useful for limiting expensive event handlers.
   * @param {Function} func
   * @param {number} [delay=300]
   * @returns {Function}
   */
  static debounce(func, delay = 300) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * Throttle function calls
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} Throttled function
   */
  /**
   * Throttles `func` so that it can only be invoked once every `limit` ms.
   * Handy for scroll/resize callbacks.
   * @param {Function} func
   * @param {number} [limit=300]
   * @returns {Function}
   */
  static throttle(func, limit = 300) {
    let inThrottle = false;
    return (...args) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success status
   */
  /**
   * Attempt to write `text` to the clipboard. Returns a boolean indicating
   * whether the operation succeeded.
   *
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy:', error);
      return false;
    }
  }

  /**
   * Get random color
   * @returns {string} Random color in hex format
   */
  /**
   * Generate a random 6‑digit hex color string.
   * @returns {string}
   */
  static getRandomColor() {
    return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
  }

  /**
   * Creates a media item element
   * @param {Object} media - Media object (must have name, artist, thumbnail, url)
   * @returns {HTMLElement} The media item element
   */
  /**
   * Build a DOM fragment representing a track/item from a media object.
   * Accepts partial data and falls back to sane defaults so callers don't
   * need to guard for missing values.
   *
   * @param {{name?:string,artist?:string,thumbnail?:string,url?:string}} media
   * @returns {HTMLElement}
   */
  static createMediaItem(media = {}) {
    const item = UIHelper._createElement('div', { classes: 'media-item' });

    const info = UIHelper._createElement('div', { classes: 'media-info' });

    // title is required, artist+link optional
    info.appendChild(
      UIHelper._createElement('div', {
        classes: 'media-title',
        text: media.name || 'Unknown Title',
      })
    );

    if (media.artist) {
      info.appendChild(
        UIHelper._createElement('div', {
          classes: 'media-artist',
          text: media.artist,
        })
      );
    }

    if (media.url) {
      const link = UIHelper._createElement('a', {
        classes: 'media-link',
        attrs: { href: media.url, target: 'yt-music-plus-preview' },
      });
      link.appendChild(
        UIHelper._createElement('span', {
          classes: 'link-icon',
          text: '🔗 Link',
        })
      );
      info.appendChild(link);
    }

    if (media.thumbnail) {
      item.appendChild(
        UIHelper._createElement('img', {
          classes: 'media-thumbnail',
          attrs: { src: media.thumbnail, alt: 'thumbnail' },
        })
      );
    }

    item.appendChild(info);
    return item;
  }

  /**
   * Creates a single grid row for media items
   * @param {Object} originalMedia - The original media object (must have name, artist, thumbnail, url)
   * @param {Object} replacementMedia - The replacement media object (must have name, artist, thumbnail, url)
   * @param {number} serialNumber - The serial number for this row
   * @returns {HTMLElement} The grid row element
   */
  /**
   * Construct a grid row representing a single mapping from an original
   * media item to its replacement. Serial number and metadata are stored as
   * data attributes for easy access later.
   *
   * @param {Object} originalMedia
   * @param {Object} replacementMedia
   * @param {number} [serialNumber=1]
   * @returns {HTMLElement}
   */
  static createMediaGridRow(originalMedia, replacementMedia, serialNumber = 1) {
    const row = UIHelper._createElement('div', { classes: 'grid-row' });
    row.dataset.serialNumber = serialNumber;
    row.dataset.originalMedia = JSON.stringify(originalMedia);
    row.dataset.replacementMedia = JSON.stringify(replacementMedia || {});

    // helper for column creation
    const makeCol = (className) =>
      UIHelper._createElement('div', { classes: ['grid-col', className] });

    // serial
    const serialCol = makeCol('grid-col-serial');
    serialCol.textContent = serialNumber;

    // checkbox
    const checkboxCol = makeCol('grid-col-checkbox');
    const checkbox = UIHelper._createElement('input', { attrs: { type: 'checkbox' } });
    checkbox.classList.add('item-checkbox');

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

    checkboxCol.appendChild(checkbox);

    // original
    const originalCol = makeCol('grid-col-original');
    originalCol.style.cursor = 'pointer';
    originalCol.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      if (!checkbox.disabled) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    originalCol.appendChild(UIHelper.createMediaItem(originalMedia));

    // replacement
    const replacementCol = makeCol('grid-col-replacement');
    if (replacementMedia && replacementMedia.isGoodMatch === false) {
      replacementCol.appendChild(
        UIHelper._createElement('span', { classes: 'warning-icon', text: '⚠️' })
      );
      replacementCol.classList.add('potential-mismatch');
    }
    replacementCol.appendChild(
      UIHelper.createMediaItem(
        replacementMedia || { name: 'No replacement found' }
      )
    );

    // assemble
    row.append(serialCol, originalCol, replacementCol, checkboxCol);
    return row;
  }

  /**
   * Creates grid rows for media items that need replacement
   * @param {Array} records - Array of records, each containing originalMedia and replacementMedia objects
   * @param {string} containerId - The ID of the container where rows should be inserted (default: 'yt-music-plus-itemsGridContainer')
   * @returns {HTMLElement} The container with inserted rows, or null if container not found
   */
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
   * Jaro-Winkler distance implementation for string similarity comparison
   * @param {*} s1 
   * @param {*} s2 
   * @returns A similarity score between 0 and 1, where 1 means identical strings and 0 means completely different strings
   */
  /**
   * Compute the Jaro‑Winkler similarity between two strings.
   * Returns a value in [0,1] where 1 indicates identical strings.
   *
   * @param {string} s1
   * @param {string} s2
   * @returns {number}
   */
  static calculateJaroWinklerDistance(s1, s2) {
    // early exits for empty strings
    if (!s1.length) return s2.length ? 0 : 1;
    if (!s2.length) return 0;

    const s1Len = s1.length;
    const s2Len = s2.length;
    const matchDist = Math.floor(Math.max(s1Len, s2Len) / 2) - 1;

    const s1Matches = Array(s1Len).fill(false);
    const s2Matches = Array(s2Len).fill(false);
    let matches = 0;

    // count matches
    for (let i = 0; i < s1Len; i++) {
      const start = Math.max(0, i - matchDist);
      const end = Math.min(i + matchDist + 1, s2Len);
      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = s2Matches[j] = true;
        matches++;
        break;
      }
    }
    if (matches === 0) return 0;

    // count transpositions
    let k = 0;
    let transpositions = 0;
    for (let i = 0; i < s1Len; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
    transpositions /= 2;

    const jaro =
      (matches / s1Len + matches / s2Len + (matches - transpositions) / matches) / 3;
    const prefixLen = Math.min(4, [...s1].findIndex((c, i) => c !== s2[i]));
    const scaling = 0.1;

    return jaro + prefixLen * scaling * (1 - jaro);
  }

  // Check if the best search result is a good match for the original item based on title similarity
  //Combine the title similarity score and the Levenshtein distance or Jaro-Winkler distance to get a more accurate similarity measure. You can experiment with different weights for each metric to see what works best for your use case.
  /**
   * Determine whether two titles are "close enough" to consider the match
   * valid. Currently uses only Jaro‑Winkler similarity but the implementation
   * is written with future expansion in mind (Levenshtein, etc.).
   *
   * @param {string} originalTitle
   * @param {string} replacementTitle
   * @param {number} [similarityThreshold=0.5]
   * @returns {boolean}
   */
  static isGoodMatch(originalTitle, replacementTitle, similarityThreshold = 0.5) {
    if (!replacementTitle) {
      console.debug('Empty replacement title => not a good match');
      return false;
    }

    try {
      const score = UIHelper.calculateJaroWinklerDistance(
        originalTitle,
        replacementTitle
      );
      console.debug(`similarity score=${score}, threshold=${similarityThreshold}`);
      return score >= similarityThreshold;
    } catch (e) {
      console.error('Error computing similarity score', e);
      return false;
    }
  }

  /**
   * Read the current set of checked rows from the grid and return their
   * original+replacement metadata. The return value is suitable for
   * processing when the user clicks a "apply changes" button, etc.
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
    const card = UIHelper._createElement('div', { classes: 'playlist-card' });
    card.append(
      UIHelper._createElement('img', {
        classes: 'playlist-card-thumbnail',
        attrs: {
          src: playlist.thumbnail || '',
          alt: playlist.title || 'Playlist Thumbnail',
        },
      }),
      UIHelper._createElement('div', {
        classes: 'playlist-card-title',
        text: playlist.title || 'Untitled Playlist',
      }),
      UIHelper._createElement('div', {
        classes: 'playlist-card-meta',
        text: playlist.subtitle || '',
      })
    );
    return card;
  }

  /**
   * Creates action buttons for the header
   * @returns {HTMLElement} The action buttons element
   */
  /**
   * Build and return the set of action buttons that are injected into the
   * YouTube Music header. The element is initially hidden; callers are
   * responsible for inserting it and toggling visibility.
   *
   * @returns {HTMLElement}
   */
  static createActionButtons() {
    const actionButtons = UIHelper._createElement('div', {
      classes: [
        'action-buttons',
        'style-scope',
        'ytmusic-responsive-header-renderer',
        'hidden',
      ],
      attrs: { id: 'yt-music-plus-action-buttons' },
    });

    const innerDiv = UIHelper._createElement('div', {
      classes: ['style-scope'],
      attrs: { role: 'button', tabindex: '0' },
    });

    const contentWrapper = UIHelper._createElement('div', {
      classes: [
        'content-wrapper',
        'style-scope',
        'ytmusic-play-button-renderer',
      ],
    });

    contentWrapper.appendChild(
      UIHelper._createElement('span', {
        classes: ['icon', 'style-scope'],
        text: 'YouTube Music +',
      })
    );

    innerDiv.appendChild(contentWrapper);
    actionButtons.appendChild(innerDiv);
    return actionButtons;
  }

  /**
   * Creates a message element for when no playlists are found
   * @returns {HTMLElement} The no playlists message element
   */
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
      if (gridWrapper) gridWrapper.style.height = 'max(460px, calc(90vh - 250px))';
    } else {
      infoSection.classList.remove('collapsed');
      if (toggleGridBtn) {
        toggleGridBtn.textContent = '⤢';
        toggleGridBtn.title = 'Expand grid';
        toggleGridBtn.setAttribute('aria-label', 'Expand grid');
      }
      if (gridWrapper) gridWrapper.style.height = '';
    }
  }
}
