/**
 * DOMHelper - Utility functions for DOM operations
 */
export class DOMHelper {
  /**
   * Create an element with configuration
   * @param {string} tag - HTML tag name
   * @param {string} className - CSS class name
   * @param {Object} config - Element configuration
   * @returns {Element} Created element
   */
  static createElement(tag, className = '', config = {}) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (config.id) element.id = config.id;
    if (config.text) element.textContent = config.text;
    if (config.html) element.innerHTML = config.html;

    if (config.attributes) {
      Object.entries(config.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }

    if (config.styles) {
      Object.assign(element.style, config.styles);
    }

    if (config.data) {
      Object.entries(config.data).forEach(([key, value]) => {
        element.dataset[key] = value;
      });
    }

    if (config.listeners) {
      Object.entries(config.listeners).forEach(([event, handler]) => {
        element.addEventListener(event, handler);
      });
    }

    return element;
  }

  /**
   * Query single element
   * @param {string} selector - CSS selector
   * @param {Element} parent - Parent element
   * @returns {Element|null} Found element
   */
  static query(selector, parent = document) {
    return parent.querySelector(selector);
  }

  /**
   * Query multiple elements
   * @param {string} selector - CSS selector
   * @param {Element} parent - Parent element
   * @returns {Element[]} Found elements
   */
  static queryAll(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  }

  /**
   * Add event listener to multiple elements
   * @param {string|Element[]} selector - CSS selector or element array
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  static on(selector, event, handler) {
    const elements = typeof selector === 'string'
      ? this.queryAll(selector)
      : Array.isArray(selector) ? selector : [selector];

    elements.forEach((el) => {
      if (el) el.addEventListener(event, handler);
    });
  }

  /**
   * Remove event listener from multiple elements
   * @param {string|Element[]} selector - CSS selector or element array
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  static off(selector, event, handler) {
    const elements = typeof selector === 'string'
      ? this.queryAll(selector)
      : Array.isArray(selector) ? selector : [selector];

    elements.forEach((el) => {
      if (el) el.removeEventListener(event, handler);
    });
  }

  /**
   * Add class to elements
   * @param {string|Element[]} selector - CSS selector or element array
   * @param {string} className - Class name
   */
  static addClass(selector, className) {
    const elements = typeof selector === 'string'
      ? this.queryAll(selector)
      : Array.isArray(selector) ? selector : [selector];

    elements.forEach((el) => {
      if (el) el.classList.add(className);
    });
  }

  /**
   * Remove class from elements
   * @param {string|Element[]} selector - CSS selector or element array
   * @param {string} className - Class name
   */
  static removeClass(selector, className) {
    const elements = typeof selector === 'string'
      ? this.queryAll(selector)
      : Array.isArray(selector) ? selector : [selector];

    elements.forEach((el) => {
      if (el) el.classList.remove(className);
    });
  }

  /**
   * Toggle class on elements
   * @param {string|Element[]} selector - CSS selector or element array
   * @param {string} className - Class name
   */
  static toggleClass(selector, className) {
    const elements = typeof selector === 'string'
      ? this.queryAll(selector)
      : Array.isArray(selector) ? selector : [selector];

    elements.forEach((el) => {
      if (el) el.classList.toggle(className);
    });
  }

  /**
   * Set multiple attributes on element
   * @param {Element} element - Target element
   * @param {Object} attributes - Attribute key-value pairs
   */
  static setAttributes(element, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value === null) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, value);
      }
    });
  }

  /**
   * Set multiple styles on element
   * @param {Element} element - Target element
   * @param {Object} styles - Style key-value pairs
   */
  static setStyles(element, styles) {
    Object.assign(element.style, styles);
  }

  /**
   * Remove multiple elements
   * @param {string|Element[]} selector - CSS selector or element array
   */
  static remove(selector) {
    const elements = typeof selector === 'string'
      ? this.queryAll(selector)
      : Array.isArray(selector) ? selector : [selector];

    elements.forEach((el) => {
      if (el) el.remove();
    });
  }

  /**
   * Insert element after reference element
   * @param {Element} newElement - Element to insert
   * @param {Element} referenceElement - Reference element
   */
  static insertAfter(newElement, referenceElement) {
    referenceElement.parentNode.insertBefore(newElement, referenceElement.nextSibling);
  }

  /**
   * Insert element before reference element
   * @param {Element} newElement - Element to insert
   * @param {Element} referenceElement - Reference element
   */
  static insertBefore(newElement, referenceElement) {
    referenceElement.parentNode.insertBefore(newElement, referenceElement);
  }

  /**
   * Check if element is visible
   * @param {Element} element - Target element
   * @returns {boolean} Visibility status
   */
  static isVisible(element) {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  }
}
