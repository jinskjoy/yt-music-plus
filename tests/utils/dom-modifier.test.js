import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DOMModifier } from '../../utils/dom-modifier.js';

describe('DOMModifier', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('modifyElement', () => {
    it('should modify an element', async () => {
      document.body.innerHTML = '<div id="test"></div>';
      const result = await DOMModifier.modifyElement('#test', {
        text: 'New Text',
        attributes: { 'data-test': 'value' },
        styles: { color: 'red' },
        classList: { add: 'new-class' }
      });

      const el = document.getElementById('test');
      expect(result.success).toBe(true);
      expect(el.textContent).toBe('New Text');
      expect(el.getAttribute('data-test')).toBe('value');
      expect(el.style.color).toBe('red');
      expect(el.classList.contains('new-class')).toBe(true);
    });

    it('should handle removal of attributes', async () => {
      document.body.innerHTML = '<div id="test" title="old"></div>';
      await DOMModifier.modifyElement('#test', {
        attributes: { title: null }
      });
      expect(document.getElementById('test').hasAttribute('title')).toBe(false);
    });

    it('should handle class removal', async () => {
      document.body.innerHTML = '<div id="test" class="a b"></div>';
      await DOMModifier.modifyElement('#test', {
        classList: { remove: ['a'] }
      });
      expect(document.getElementById('test').classList.contains('a')).toBe(false);
      expect(document.getElementById('test').classList.contains('b')).toBe(true);
    });

    it('should remove element if remove is true', async () => {
      document.body.innerHTML = '<div id="test"></div>';
      await DOMModifier.modifyElement('#test', { remove: true });
      expect(document.getElementById('test')).toBeNull();
    });

    it('should return failure if element not found', async () => {
      const result = await DOMModifier.modifyElement('#none', {});
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('createElement', () => {
    it('should create an element with config', () => {
      const child = document.createElement('span');
      const el = DOMModifier.createElement('div', {
        id: 'new-el',
        className: 'my-class',
        attributes: { title: 'T' },
        styles: { display: 'block' },
        children: child
      });

      expect(el.tagName).toBe('DIV');
      expect(el.id).toBe('new-el');
      expect(el.className).toBe('my-class');
      expect(el.getAttribute('title')).toBe('T');
      expect(el.style.display).toBe('block');
      expect(el.firstChild).toBe(child);
    });
    
    it('should handle config.text and config.html', () => {
       const el = DOMModifier.createElement('div', { text: 'Hello' });
       expect(el.textContent).toBe('Hello');
       
       const el2 = DOMModifier.createElement('div', { html: '<b>Hi</b>' });
       expect(el2.innerHTML).toBe('<b>Hi</b>');
    });
  });

  describe('insertAfter', () => {
    it('should insert after reference', () => {
      const parent = document.createElement('div');
      const ref = document.createElement('div');
      parent.appendChild(ref);
      const newEl = document.createElement('span');
      
      DOMModifier.insertAfter(newEl, ref);
      expect(parent.lastChild).toBe(newEl);
    });
  });

  describe('findElements', () => {
    it('should find elements by various criteria', () => {
      document.body.innerHTML = `
        <div class="test-find" id="target-div" data-attr="val">UniqueText</div>
        <div class="test-find">Other</div>
      `;

      expect(DOMModifier.findElements({ selector: '.test-find' })).toHaveLength(2);
      const foundByText = DOMModifier.findElements({ text: 'UniqueText' });
      expect(foundByText.length).toBeGreaterThanOrEqual(1);
      const tagNames = foundByText.map(el => el.tagName);
      expect(tagNames).toContain('DIV');

      expect(DOMModifier.findElements({ attribute: 'data-attr', attributeValue: 'val' })).toHaveLength(1);
      expect(DOMModifier.findElements({ className: 'test-find' })).toHaveLength(2);
    });
  });

  describe('watchDOM', () => {
    it('should setup mutation observer', () => {
      const callback = vi.fn();
      const observer = DOMModifier.watchDOM(callback);
      expect(observer).toBeInstanceOf(MutationObserver);
      observer.disconnect();
    });
  });
});
