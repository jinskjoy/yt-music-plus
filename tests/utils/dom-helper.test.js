import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DOMHelper } from '../../utils/dom-helper.js';

describe('DOMHelper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('createElement', () => {
    it('should create an element with basic properties', () => {
      const el = DOMHelper.createElement('div', 'test-class', {
        id: 'test-id',
        text: 'Hello'
      });
      expect(el.tagName).toBe('DIV');
      expect(el.className).toBe('test-class');
      expect(el.id).toBe('test-id');
      expect(el.textContent).toBe('Hello');
    });

    it('should handle empty options', () => {
      const el = DOMHelper.createElement('div');
      expect(el.tagName).toBe('DIV');
    });

    it('should handle innerHTML', () => {
      const el = DOMHelper.createElement('div', '', { html: '<span>Nested</span>' });
      expect(el.innerHTML).toBe('<span>Nested</span>');
    });

    it('should handle attributes', () => {
      const el = DOMHelper.createElement('div', '', {
        attributes: { 'aria-label': 'test', 'role': 'button' }
      });
      expect(el.getAttribute('aria-label')).toBe('test');
      expect(el.getAttribute('role')).toBe('button');
    });

    it('should handle styles', () => {
      const el = DOMHelper.createElement('div', '', {
        styles: { color: 'red', display: 'flex' }
      });
      expect(el.style.color).toBe('red');
      expect(el.style.display).toBe('flex');
    });

    it('should handle data attributes', () => {
      const el = DOMHelper.createElement('div', '', {
        data: { id: '123', type: 'user' }
      });
      expect(el.dataset.id).toBe('123');
      expect(el.dataset.type).toBe('user');
    });

    it('should handle event listeners', () => {
      const handler = vi.fn();
      const el = DOMHelper.createElement('button', '', {
        listeners: { click: handler }
      });
      el.click();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Query methods', () => {
    it('query should return single element', () => {
      document.body.innerHTML = '<div class="test"></div><div class="test"></div>';
      const el = DOMHelper.query('.test');
      expect(el).not.toBeNull();
      expect(el.tagName).toBe('DIV');
    });

    it('queryAll should return array of elements', () => {
      document.body.innerHTML = '<div class="test"></div><div class="test"></div>';
      const els = DOMHelper.queryAll('.test');
      expect(Array.isArray(els)).toBe(true);
      expect(els.length).toBe(2);
    });
  });

  describe('Event methods', () => {
    it('on/off should add and remove listeners', () => {
      const el = document.createElement('button');
      const handler = vi.fn();
      
      DOMHelper.on(el, 'click', handler);
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
      
      DOMHelper.off(el, 'click', handler);
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('on should handle string selector', () => {
      const el = document.createElement('button');
      el.className = 'test-btn';
      document.body.appendChild(el);
      const handler = vi.fn();
      
      DOMHelper.on('.test-btn', 'click', handler);
      el.click();
      expect(handler).toHaveBeenCalled();
    });
    
    it('on should handle array of elements and falsy elements', () => {
      const el1 = document.createElement('button');
      const handler = vi.fn();
      
      DOMHelper.on([el1, null], 'click', handler);
      el1.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('on/off should handle single non-string/non-array selector', () => {
      const el = document.createElement('button');
      const handler = vi.fn();
      DOMHelper.on(el, 'click', handler);
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
      
      DOMHelper.off(el, 'click', handler);
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('off should handle string selector and array', () => {
      const el = document.createElement('button');
      el.className = 'test-off';
      document.body.appendChild(el);
      const handler = vi.fn();
      
      DOMHelper.on(el, 'click', handler);
      DOMHelper.off('.test-off', 'click', handler);
      el.click();
      expect(handler).not.toHaveBeenCalled();
      
      DOMHelper.on(el, 'click', handler);
      DOMHelper.off([el, null], 'click', handler);
      el.click();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Class methods', () => {
    it('addClass/removeClass/toggleClass should handle various selector types', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      el.className = 'test';
      
      // String selector
      DOMHelper.addClass('.test', 'a');
      expect(el.classList.contains('a')).toBe(true);
      
      // Array selector with null
      DOMHelper.removeClass([el, null], 'a');
      expect(el.classList.contains('a')).toBe(false);

      DOMHelper.addClass([el], 'd');
      expect(el.classList.contains('d')).toBe(true);
      
      // Single element
      DOMHelper.toggleClass(el, 'b');
      expect(el.classList.contains('b')).toBe(true);

      DOMHelper.toggleClass([el], 'e');
      expect(el.classList.contains('e')).toBe(true);
      
      // Falsy single element
      DOMHelper.addClass(null, 'c');
      DOMHelper.removeClass(null, 'b');
      DOMHelper.toggleClass(null, 'b');
    });

    it('removeClass should handle string selector', () => {
      const el = document.createElement('div');
      el.className = 'test2';
      document.body.appendChild(el);
      DOMHelper.addClass(el, 'foo');
      DOMHelper.removeClass('.test2', 'foo');
      expect(el.classList.contains('foo')).toBe(false);
    });

    it('toggleClass should handle string selector', () => {
      const el = document.createElement('div');
      el.className = 'test3';
      document.body.appendChild(el);
      DOMHelper.toggleClass('.test3', 'bar');
      expect(el.classList.contains('bar')).toBe(true);
    });
  });

  describe('Attribute and Style methods', () => {
    it('setAttributes should handle null to remove', () => {
      const el = document.createElement('div');
      el.setAttribute('title', 'test');
      
      DOMHelper.setAttributes(el, { title: null, id: 'new' });
      expect(el.hasAttribute('title')).toBe(false);
      expect(el.id).toBe('new');
    });

    it('setAttributes should handle falsy element', () => {
      expect(DOMHelper.setAttributes(null, { id: 'test' })).toBeUndefined();
    });

    it('setStyles should update styles and handle falsy element', () => {
      const el = document.createElement('div');
      DOMHelper.setStyles(el, { fontSize: '20px' });
      expect(el.style.fontSize).toBe('20px');
      expect(DOMHelper.setStyles(null, {})).toBeUndefined();
    });
  });

  describe('DOM manipulation', () => {
    it('remove should handle various inputs and string selector', () => {
      const el1 = document.createElement('div');
      el1.className = 'to-remove';
      document.body.appendChild(el1);
      
      DOMHelper.remove('.to-remove');
      expect(document.body.contains(el1)).toBe(false);
      
      const el2 = document.createElement('div');
      document.body.appendChild(el2);
      DOMHelper.remove([el2, null]);
      expect(document.body.contains(el2)).toBe(false);
      
      const el3 = document.createElement('div');
      document.body.appendChild(el3);
      DOMHelper.remove(el3);
      expect(document.body.contains(el3)).toBe(false);
    });

    it('insertAfter and insertBefore', () => {
      const parent = document.createElement('div');
      const ref = document.createElement('div');
      parent.appendChild(ref);
      
      const el1 = document.createElement('span');
      DOMHelper.insertBefore(el1, ref);
      expect(parent.firstChild).toBe(el1);
      
      const el2 = document.createElement('p');
      DOMHelper.insertAfter(el2, ref);
      expect(parent.lastChild).toBe(el2);
      
      // Case where ref has no parent
      const orphan = document.createElement('div');
      expect(DOMHelper.insertAfter(el2, orphan)).toBeUndefined();
      expect(DOMHelper.insertBefore(el2, orphan)).toBeUndefined();
    });
  });

  describe('isVisible', () => {
    it('should return true if element has dimensions', () => {
      const el = document.createElement('div');
      // Mocking offsetWidth
      Object.defineProperty(el, 'offsetWidth', { value: 10, configurable: true });
      expect(DOMHelper.isVisible(el)).toBe(true);
    });

    it('should return false if element has no dimensions', () => {
      const el = document.createElement('div');
      // In some environments getClientRects might return an empty list for hidden elements
      vi.spyOn(el, 'getClientRects').mockReturnValue([]);
      expect(DOMHelper.isVisible(el)).toBe(false);
    });

    it('should handle falsy element', () => {
      expect(DOMHelper.isVisible(null)).toBe(false);
    });
  });

  describe('Query methods edge cases', () => {
    it('query/queryAll should handle missing parent or selector', () => {
      expect(DOMHelper.query('.none')).toBeNull();
      expect(DOMHelper.queryAll('.none')).toEqual([]);
      
      const el = document.createElement('div');
      expect(DOMHelper.query('.child', el)).toBeNull();
      expect(DOMHelper.queryAll('.child', el)).toEqual([]);
    });
  });
});
