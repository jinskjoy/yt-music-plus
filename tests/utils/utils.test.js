import { describe, it, expect } from 'vitest';
import { TextSimilarity, Formatters } from '../../utils/utils.js';

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
  });

  describe('Formatters.formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(Formatters.formatFileSize(0)).toBe('0 Bytes');
      expect(Formatters.formatFileSize(1024)).toBe('1 KB');
      expect(Formatters.formatFileSize(1024 * 1024)).toBe('1 MB');
    });
  });

  describe('Formatters.formatDate', () => {
    it('should format timestamps', () => {
      const ts = new Date('2024-01-01T12:00:00Z').getTime();
      expect(Formatters.formatDate(ts)).toContain('2024');
    });
  });

  describe('TextSimilarity.calculateJaroWinklerDistance', () => {
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
});
