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
   * Show loading spinner
   * @param {Element} element - Element to display spinner in
   */
  static showLoader(element) {
    if (!element) return;
    element.innerHTML = '<div class="spinner"></div>';
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
}
