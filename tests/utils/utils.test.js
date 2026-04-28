import { describe, it, expect, vi } from 'vitest';
import { TextSimilarity, Formatters, BrowserUtils } from '../../utils/utils.js';

describe('Utils', () => {
  describe('TextSimilarity.isGoodMatch', () => {
    it('should return true for identical strings', () => {
      expect(TextSimilarity.isGoodMatch('Hello', 'Hello')).toBe(true);
    });

    it('should return true for very similar strings', () => {
      expect(TextSimilarity.isGoodMatch('Taylor Swift - Shake It Off', 'Shake It Off - Taylor Swift')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(TextSimilarity.isGoodMatch('Taylor Swift', 'Katy Perry')).toBe(false);
    });

    it('should return false for empty replacement', () => {
      expect(TextSimilarity.isGoodMatch('Something', '')).toBe(false);
    });

    it('should handle errors gracefully', () => {
      // Force an error by passing something that causes calculateJaroWinklerDistance to fail
      // but calculateJaroWinklerDistance is pretty robust. 
      // Let's mock it instead.
      const spy = vi.spyOn(TextSimilarity, 'calculateJaroWinklerDistance').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(TextSimilarity.isGoodMatch('a', 'b')).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      spy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('Formatters.formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(Formatters.formatFileSize(0)).toBe('0 Bytes');
      expect(Formatters.formatFileSize(1024)).toBe('1 KB');
      expect(Formatters.formatFileSize(1048576)).toBe('1 MB');
      expect(Formatters.formatFileSize(1073741824)).toBe('1 GB');
    });
  });

  describe('Formatters.formatDate', () => {
    const ts = new Date('2024-01-01T12:00:00Z').getTime();

    it('should format timestamps with default (short) format', () => {
      expect(Formatters.formatDate(ts)).toContain('1/1/2024');
    });

    it('should format timestamps with long format', () => {
      const result = Formatters.formatDate(ts, { format: 'long' });
      expect(result).toContain('January 1, 2024');
    });

    it('should format timestamps with time format', () => {
      const result = Formatters.formatDate(ts, { format: 'time' });
      // Time formatting can vary by environment, but it should contain numbers
      expect(result).toMatch(/\d+/);
    });
  });

  describe('TextSimilarity.calculateJaroWinklerDistance', () => {
    it('should handle empty strings', () => {
      expect(TextSimilarity.calculateJaroWinklerDistance('', '')).toBe(1);
      expect(TextSimilarity.calculateJaroWinklerDistance('', 'a')).toBe(0);
      expect(TextSimilarity.calculateJaroWinklerDistance('a', '')).toBe(0);
    });

    it('should return 1 for identical strings', () => {
      expect(TextSimilarity.calculateJaroWinklerDistance('martha', 'martha')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      expect(TextSimilarity.calculateJaroWinklerDistance('abc', 'xyz')).toBe(0);
    });

    it('should return a score for similar strings', () => {
      const score = TextSimilarity.calculateJaroWinklerDistance('dwayne', 'duane');
      expect(score).toBeGreaterThan(0.8);
      expect(score).toBeLessThan(1);
    });
  });

  describe('BrowserUtils', () => {
    it('debounce should delay function execution', () => {
      vi.useFakeTimers();
      const func = vi.fn();
      const debounced = BrowserUtils.debounce(func, 100);

      debounced();
      debounced();
      debounced();

      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('throttle should limit function execution', () => {
      vi.useFakeTimers();
      const func = vi.fn();
      const throttled = BrowserUtils.throttle(func, 100);

      throttled();
      throttled();
      throttled();

      expect(func).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttled();
      expect(func).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('copyToClipboard should use navigator.clipboard', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        configurable: true
      });

      const result = await BrowserUtils.copyToClipboard('test text');
      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('test text');
    });

    it('copyToClipboard should return false on error', async () => {
      const mockWriteText = vi.fn().mockRejectedValue(new Error('Copy failed'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        configurable: true
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await BrowserUtils.copyToClipboard('test text');
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('getRandomColor should return a hex color string', () => {
      const color = BrowserUtils.getRandomColor();
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});
