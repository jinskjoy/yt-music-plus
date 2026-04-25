import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UIHelper } from '../../utils/ui-helper.js';

describe('UIHelper', () => {
  describe('isGoodMatch', () => {
    it('should return true for identical strings', () => {
      expect(UIHelper.isGoodMatch('Hello', 'Hello')).toBe(true);
    });

    it('should return true for very similar strings', () => {
      expect(UIHelper.isGoodMatch('Taylor Swift - Shake It Off', 'Shake It Off - Taylor Swift')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(UIHelper.isGoodMatch('Taylor Swift', 'Katy Perry')).toBe(false);
    });

    it('should return false for empty replacement', () => {
      expect(UIHelper.isGoodMatch('Something', '')).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(UIHelper.formatFileSize(0)).toBe('0 Bytes');
      expect(UIHelper.formatFileSize(1024)).toBe('1 KB');
      expect(UIHelper.formatFileSize(1024 * 1024)).toBe('1 MB');
    });
  });

  describe('formatDate', () => {
    it('should format timestamps', () => {
      const ts = new Date('2024-01-01T12:00:00Z').getTime();
      expect(UIHelper.formatDate(ts)).toContain('2024');
    });
  });

  describe('_createElement', () => {
    it('should create an element with classes and attributes', () => {
      const el = UIHelper._createElement('div', {
        classes: ['test-class', 'another-class'],
        attrs: { id: 'test-id', 'data-val': '123' },
        text: 'Hello World'
      });

      expect(el.tagName).toBe('DIV');
      expect(el.classList.contains('test-class')).toBe(true);
      expect(el.classList.contains('another-class')).toBe(true);
      expect(el.id).toBe('test-id');
      expect(el.getAttribute('data-val')).toBe('123');
      expect(el.textContent).toBe('Hello World');
    });
  });

  describe('createMediaItem', () => {
    it('should create a media item element', () => {
      const media = {
        name: 'Test Song',
        artist: 'Test Artist',
        url: 'https://youtube.com/watch?v=123',
        thumbnail: 'https://img.com/123.jpg'
      };

      const el = UIHelper.createMediaItem(media);
      expect(el.querySelector('.media-title').textContent).toBe('Test Song');
      expect(el.querySelector('.media-artist').textContent).toBe('Test Artist');
      expect(el.querySelector('.media-link').href).toBe('https://youtube.com/watch?v=123');
      expect(el.querySelector('.media-thumbnail').src).toBe('https://img.com/123.jpg');
    });
  });
});
