import { CONSTANTS } from './constants.js';

/**
 * Generic Utility functions refactored into classes
 */

/**
 * TextSimilarity - Handles string similarity calculations
 */
export class TextSimilarity {
  /**
   * Compute the Jaro‑Winkler similarity between two strings.
   * Returns a value in [0,1] where 1 indicates identical strings.
   *
   * @param {string} s1
   * @param {string} s2
   * @returns {number}
   */
  static calculateJaroWinklerDistance(s1, s2) {
    if (!s1.length) return s2.length ? 0 : 1;
    if (!s2.length) return 0;

    const s1Len = s1.length;
    const s2Len = s2.length;
    const matchDist = Math.floor(Math.max(s1Len, s2Len) / 2) - 1;

    const s1Matches = Array(s1Len).fill(false);
    const s2Matches = Array(s2Len).fill(false);
    let matches = 0;

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
    
    let prefixLen = 0;
    for (let i = 0; i < Math.min(CONSTANTS.API.JARO_WINKLER_PREFIX_LEN, s1Len, s2Len); i++) {
      if (s1[i] === s2[i]) prefixLen++;
      else break;
    }

    const scaling = CONSTANTS.API.JARO_WINKLER_SCALING_FACTOR;
    return jaro + prefixLen * scaling * (1 - jaro);
  }

  /**
   * Determine whether two titles are "close enough" to consider the match
   * valid. Currently uses only Jaro‑Winkler similarity.
   *
   * @param {string} originalTitle
   * @param {string} replacementTitle
   * @param {number} [similarityThreshold=CONSTANTS.API.SIMILARITY_THRESHOLD]
   * @returns {boolean}
   */
  static isGoodMatch(originalTitle, replacementTitle, similarityThreshold = CONSTANTS.API.SIMILARITY_THRESHOLD) {
    if (!replacementTitle) {
      return false;
    }

    try {
      const score = this.calculateJaroWinklerDistance(originalTitle, replacementTitle);
      return score >= similarityThreshold;
    } catch (e) {
      console.error('Error computing similarity score', e);
      return false;
    }
  }
}

/**
 * Formatters - Handles data formatting
 */
export class Formatters {
  /**
   * Convert a millisecond timestamp into a human‑readable string.
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
}

/**
 * BrowserUtils - Handles browser-specific utility functions
 */
export class BrowserUtils {
  /**
   * Return a debounced version of `func` that fires after `delay` ms have passed
   * since the last call. Useful for limiting expensive event handlers.
   * @param {Function} func
   * @param {number} [delay=CONSTANTS.UI.DEBOUNCE_DELAY_MS]
   * @returns {Function}
   */
  static debounce(func, delay = CONSTANTS.UI.DEBOUNCE_DELAY_MS) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * Throttles `func` so that it can only be invoked once every `limit` ms.
   * Handy for scroll/resize callbacks.
   * @param {Function} func
   * @param {number} [limit=CONSTANTS.UI.THROTTLE_LIMIT_MS]
   * @returns {Function}
   */
  static throttle(func, limit = CONSTANTS.UI.THROTTLE_LIMIT_MS) {
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
   * Generate a random 6‑digit hex color string.
   * @returns {string}
   */
  static getRandomColor() {
    return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
  }
}
