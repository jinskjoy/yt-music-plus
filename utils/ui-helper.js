/**
 * UIHelper - Handles UI utilities and helper functions
 */
export class UIHelper {
  /**
   * Show status message
   * @param {Element} element - Element to display status in
   * @param {string} message - Message to display
   * @param {string} type - Message type (success, error, info)
   * @param {number} duration - Duration in ms (0 = permanent)
   */
  static showStatus(element, message, type = 'info', duration = 3000) {
    if (!element) return;

    element.textContent = message;
    element.className = `status-message show ${type}`;

    if (duration > 0) {
      setTimeout(() => {
        element.classList.remove('show');
      }, duration);
    }
  }


  /**
   * Format timestamp to readable date
   * @param {number} timestamp - Timestamp in milliseconds
   * @param {Object} options - Formatting options
   * @returns {string} Formatted date string
   */
  static formatDate(timestamp, options = {}) {
    const date = new Date(timestamp);
    const {
      format = 'short',
      locale = 'en-US',
    } = options;

    if (format === 'short') {
      return date.toLocaleDateString(locale);
    }
    if (format === 'long') {
      return date.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    if (format === 'time') {
      return date.toLocaleTimeString(locale);
    }
    return date.toLocaleString(locale);
  }

  /**
   * Format file size
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size string
   */
  static formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
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
  static throttle(func, limit = 300) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success status
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
  static getRandomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
  }

  /**
   * Creates a media item element
   * @param {Object} media - Media object (must have name, artist, thumbnail, url)
   * @returns {HTMLElement} The media item element
   */
  static createMediaItem(media) {
    const mediaItem = document.createElement('div');
    mediaItem.className = 'media-item';


    // Media info container
    const mediaInfo = document.createElement('div');
    mediaInfo.className = 'media-info';

    // Title
    const title = document.createElement('div');
    title.className = 'media-title';
    title.textContent = media.name || 'Unknown Title';

    // Append to media info
    mediaInfo.appendChild(title);
    if (media.artist) {
      // Artist
      const artist = document.createElement('div');
      artist.className = 'media-artist';
      artist.textContent = media.artist || 'Unknown Artist';

      mediaInfo.appendChild(artist);
    }
    if (media.url) {
      // Link
      const link = document.createElement('a');
      link.href = media.url || '#';
      link.target = '_blank';
      link.className = 'media-link';
      // Add icon that link opens in new tab
      const linkIcon = document.createElement('span');
      linkIcon.className = 'link-icon';
      linkIcon.textContent = '🔗 Link';
      link.appendChild(linkIcon);
      mediaInfo.appendChild(link);
    }

    // Append to media item
    if (media.thumbnail) {

      // Thumbnail image
      const img = document.createElement('img');
      img.src = media.thumbnail || '';
      img.alt = 'thumbnail';
      img.className = 'media-thumbnail';
      mediaItem.appendChild(img);
    }
    mediaItem.appendChild(mediaInfo);

    return mediaItem;
  }

  /**
   * Creates a single grid row for media items
   * @param {Object} originalMedia - The original media object (must have name, artist, thumbnail, url)
   * @param {Object} replacementMedia - The replacement media object (must have name, artist, thumbnail, url)
   * @param {number} serialNumber - The serial number for this row
   * @returns {HTMLElement} The grid row element
   */
  static createMediaGridRow(originalMedia, replacementMedia, serialNumber = 1) {
    const row = document.createElement('div');
    row.className = 'grid-row';

    // Serial number column
    const serialCol = document.createElement('div');
    serialCol.className = 'grid-col grid-col-serial';
    serialCol.textContent = serialNumber;

    // Checkbox column
    const checkboxCol = document.createElement('div');
    checkboxCol.className = 'grid-col grid-col-checkbox';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'item-checkbox';
    checkbox.checked = replacementMedia ? true : false; // Default to checked if replacement exists, unchecked otherwise
    checkboxCol.appendChild(checkbox);

    // Original media column
    const originalCol = document.createElement('div');
    originalCol.className = 'grid-col grid-col-original';
    originalCol.appendChild(this.createMediaItem(originalMedia));

    // Replacement media column
    const replacementCol = document.createElement('div');
    replacementCol.className = 'grid-col grid-col-replacement';
    if (replacementMedia && replacementMedia.isGoodMatch === false) {
      const warningIcon = document.createElement('span');
      warningIcon.className = 'warning-icon';
      warningIcon.textContent = '⚠️';
      replacementCol.appendChild(warningIcon);
      replacementCol.classList.add('potential-mismatch');
    }
    replacementCol.appendChild(replacementMedia ? this.createMediaItem(replacementMedia) : this.createMediaItem({ name: "No replacement found" }));

    // Append all columns to row
    row.appendChild(serialCol);
    row.appendChild(originalCol);
    row.appendChild(replacementCol);
    row.appendChild(checkboxCol);

    return row;
  }

  /**
   * Creates grid rows for media items that need replacement
   * @param {Array} records - Array of records, each containing originalMedia and replacementMedia objects
   * @param {string} containerId - The ID of the container where rows should be inserted (default: 'yt-music-plus-itemsGridContainer')
   * @returns {HTMLElement} The container with inserted rows, or null if container not found
   */
  static createMediaGridRows(records, containerId = 'yt-music-plus-itemsGridContainer') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with ID ${containerId} not found`);
      return null;
    }

    // Clear existing rows (keeping the header)
    const existingRows = container.querySelectorAll('.grid-row');
    existingRows.forEach(row => row.remove());

    // Create rows for each record
    records.forEach((record, index) => {
      const row = this.createMediaGridRow(record.originalMedia, record.replacementMedia, index + 1);
      container.appendChild(row);
    });

    return container;
  }

  static setPlaylistDetails(playlist) {
    //Fill Playlist Info Section with playlist details
    const thumbnailEl = document.getElementById('yt-music-plus-playlistThumbnail');
    const nameEl = document.getElementById('yt-music-plus-playlistName');
    const trackCountEl = document.getElementById('yt-music-plus-playlistTrackCount');
    const descriptionEl = document.getElementById('yt-music-plus-playlistDescription');

    if (thumbnailEl && playlist.thumbnail) {
      thumbnailEl.src = playlist.thumbnail;
    }
    if (nameEl && playlist.title) {
      nameEl.textContent = playlist.title;
    }
    if (trackCountEl && playlist.subtitle) {
      trackCountEl.textContent = playlist.subtitle;
    }
    if (descriptionEl && playlist.owner) {
      descriptionEl.textContent = playlist.owner || '';
    }
  }

  // Simple title similarity check based on common words and length difference
  static calculateTitleSimilarity(title1, title2) {
    // Simple similarity check based on common words and length difference
    const words1 = title1.toLowerCase().split(/\s+/);
    const words2 = title2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word)).length;
    const lengthDifference = Math.abs(title1.length - title2.length);
    const maxLength = Math.max(title1.length, title2.length);

    // Calculate a similarity score based on common words and length difference
    const similarityScore = (commonWords / maxLength) - (lengthDifference / maxLength);
    return similarityScore;
  }
  //Levenshtein distance or Jaro-Winkler distance
  static calculateLevenshteinDistance(s1, s2) {
    const len1 = s1.length;
    const len2 = s2.length;
    const dp = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[len1][len2];
  }

  static calculateJaroWinklerDistance(s1, s2) {
    let m = 0; // Number of matching characters
    let t = 0; // Number of transpositions
    const s1Len = s1.length;
    const s2Len = s2.length;
    if (s1Len === 0) return s2Len === 0 ? 1 : 0;
    if (s2Len === 0) return 0;

    const matchDistance = Math.floor(Math.max(s1Len, s2Len) / 2) - 1;
    const s1Matches = new Array(s1Len).fill(false);
    const s2Matches = new Array(s2Len).fill(false);

    for (let i = 0; i < s1Len; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, s2Len);
      for (let j = start; j < end; j++) {
        if (s2Matches[j]) continue;
        if (s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        m++;
        break;
      }
    }
    if (m === 0) return 0;

    let k = 0;
    for (let i = 0; i < s1Len; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) t++;
      k++;
    }
    t /= 2;

    const j = (m / s1Len + m / s2Len + (m - t) / m) / 3;
    const l = Math.min(4, [...s1].findIndex((c, i) => c !== s2[i]));
    const p = 0.1;

    return j + l * p * (1 - j);
  }

  // Check if the best search result is a good match for the original item based on title similarity
  //Combine the title similarity score and the Levenshtein distance or Jaro-Winkler distance to get a more accurate similarity measure. You can experiment with different weights for each metric to see what works best for your use case.
  static isGoodMatch(originalTitle, replacementTitle, similarityThreshold = 0.5) {
    //Add exception handling for cases where replacementTitle is null or empty, which can happen if no search results were found or if the best search result doesn't have a title. In such cases, we should consider it as not a good match.
    if (!replacementTitle) {
      console.log("Replacement title is null or empty, considering it as not a good match.");
      return false;
    }
    try {
      //const titleSimilarity = this.calculateTitleSimilarity(originalTitle, replacementTitle);
      //const levenshteinDistance = this.calculateLevenshteinDistance(originalTitle, replacementTitle);
      const jaroWinklerDistance = this.calculateJaroWinklerDistance(originalTitle, replacementTitle);
      //console.log(`Title similarity: ${titleSimilarity}, Levenshtein distance: ${levenshteinDistance}, Jaro-Winkler distance: ${jaroWinklerDistance}`);
      // Combine the metrics into a single similarity score (you can adjust the weights as needed)
      
      const combinedSimilarity = jaroWinklerDistance; // Using only Jaro-Winkler distance for simplicity
      
      console.log(`Combined similarity score: ${combinedSimilarity} (threshold: ${similarityThreshold})`);
      return combinedSimilarity >= similarityThreshold;
    } catch (error) {
      console.error("Error calculating similarity metrics:", error);
      return false;
    }
  }
}
