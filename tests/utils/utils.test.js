import { describe, it, expect } from 'vitest';
import * as Utils from '../../utils/utils.js';

describe('Utils', () => {
  describe('isGoodMatch', () => {
    it('should return true for identical strings', () => {
      expect(Utils.isGoodMatch('Hello', 'Hello')).toBe(true);
    });

    it('should return true for very similar strings', () => {
      expect(Utils.isGoodMatch('Taylor Swift - Shake It Off', 'Shake It Off - Taylor Swift')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(Utils.isGoodMatch('Taylor Swift', 'Katy Perry')).toBe(false);
    });

    it('should return false for empty replacement', () => {
      expect(Utils.isGoodMatch('Something', '')).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(Utils.formatFileSize(0)).toBe('0 Bytes');
      expect(Utils.formatFileSize(1024)).toBe('1 KB');
      expect(Utils.formatFileSize(1024 * 1024)).toBe('1 MB');
    });
  });

  describe('formatDate', () => {
    it('should format timestamps', () => {
      const ts = new Date('2024-01-01T12:00:00Z').getTime();
      expect(Utils.formatDate(ts)).toContain('2024');
    });
  });

  describe('calculateJaroWinklerDistance', () => {
    it('should return 1 for identical strings', () => {
      expect(Utils.calculateJaroWinklerDistance('martha', 'martha')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      expect(Utils.calculateJaroWinklerDistance('abc', 'xyz')).toBe(0);
    });

    it('should return a score for similar strings', () => {
      const score = Utils.calculateJaroWinklerDistance('dwayne', 'duane');
      expect(score).toBeGreaterThan(0.8);
      expect(score).toBeLessThan(1);
    });
  });
});
