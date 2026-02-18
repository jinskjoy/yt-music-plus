/**
 * DOMModifier - Handles DOM manipulation operations
 */
export class DOMModifier {
  /**
   * Modify a DOM element
   * @param {string} selector - CSS selector
   * @param {Object} modifications - Modifications to apply
   * @returns {Promise<Object>} Result of modification
   */
  static async modifyElement(selector, modifications) {
    try {
      const element = document.querySelector(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      const {
        text,
        html,
        attributes,
        styles,
        classList,
        remove,
      } = modifications;

      // Modify text content
      if (text !== undefined) {
        element.textContent = text;
      }

      // Modify HTML content
      if (html !== undefined) {
        element.innerHTML = html;
      }

      // Modify attributes
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          if (value === null) {
            element.removeAttribute(key);
          } else {
            element.setAttribute(key, value);
          }
        });
      }

      // Modify styles
      if (styles) {
        Object.entries(styles).forEach(([key, value]) => {
          element.style[key] = value;
        });
      }

      // Modify classes
      if (classList) {
        if (classList.add) {
          element.classList.add(...(Array.isArray(classList.add) ? classList.add : [classList.add]));
        }
        if (classList.remove) {
          element.classList.remove(...(Array.isArray(classList.remove) ? classList.remove : [classList.remove]));
        }
      }

      // Remove element
      if (remove) {
        element.remove();
      }

      return { success: true, message: 'Element modified successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Create a new DOM element
   * @param {string} tag - HTML tag name
   * @param {Object} config - Element configuration
   * @returns {Element} Created element
   */
  static createElement(tag, config = {}) {
    const element = document.createElement(tag);

    if (config.text) element.textContent = config.text;
    if (config.html) element.innerHTML = config.html;
    if (config.id) element.id = config.id;
    if (config.className) element.className = config.className;

    if (config.attributes) {
      Object.entries(config.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }

    if (config.styles) {
      Object.entries(config.styles).forEach(([key, value]) => {
        element.style[key] = value;
      });
    }

    if (config.children) {
      const children = Array.isArray(config.children) ? config.children : [config.children];
      children.forEach((child) => {
        element.appendChild(child);
      });
    }

    return element;
  }

  /**
   * Insert element after a reference element
   * @param {Element} newElement - Element to insert
   * @param {Element} referenceElement - Reference element
   */
  static insertAfter(newElement, referenceElement) {
    referenceElement.parentNode.insertBefore(newElement, referenceElement.nextSibling);
  }

  /**
   * Find elements by various criteria
   * @param {Object} criteria - Search criteria
   * @returns {Element[]} Found elements
   */
  static findElements(criteria) {
    const {
      selector,
      text,
      attribute,
      attributeValue,
      className,
    } = criteria;

    let elements = [];

    if (selector) {
      elements = Array.from(document.querySelectorAll(selector));
    }

    if (text) {
      elements = Array.from(document.querySelectorAll('*')).filter((el) =>
        el.textContent.includes(text)
      );
    }

    if (attribute && attributeValue) {
      elements = Array.from(document.querySelectorAll(`[${attribute}="${attributeValue}"]`));
    }

    if (className) {
      elements = Array.from(document.querySelectorAll(`.${className}`));
    }

    return elements;
  }

  /**
   * Watch for DOM changes
   * @param {Function} callback - Callback function
   * @param {Object} options - Observer options
   * @returns {MutationObserver} Observer instance
   */
  static watchDOM(callback, options = {}) {
    const defaultOptions = {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: false,
      ...options,
    };

    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, defaultOptions);

    return observer;
  }
}
