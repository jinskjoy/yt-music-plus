import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaItem, MediaGridRow, PlaylistCard } from '../../utils/ui-helper.js';
import { CONSTANTS } from '../../utils/constants.js';
import fs from 'fs';
import path from 'path';

describe('UI Components', () => {
  beforeEach(() => {
    const htmlPath = path.resolve(__dirname, '../../html/in-site-popup.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = htmlContent;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  describe('MediaItem', () => {
    it('should render with all fields', () => {
      const media = {
        name: 'Song',
        artist: 'Artist',
        url: 'https://youtube.com/watch?v=123',
        thumbnail: 'https://img.com/123.jpg'
      };
      const el = MediaItem.render(media);
      
      expect(el.querySelector('.media-title').textContent).toBe('Song');
      expect(el.querySelector('.media-artist').textContent).toBe('Artist');
      expect(el.querySelector('.media-link').href).toBe('https://youtube.com/watch?v=123');
      expect(el.querySelector('.media-thumbnail').src).toBe('https://img.com/123.jpg');
    });

    it('should remove elements for missing fields', () => {
      const media = { name: 'Only Name' };
      const el = MediaItem.render(media);
      
      expect(el.querySelector('.media-artist')).toBeNull();
      expect(el.querySelector('.media-link')).toBeNull();
      expect(el.querySelector('.media-thumbnail')).toBeNull();
    });

    it('should handle player controls interaction', () => {
      const media = { videoId: 'v123', name: 'Song' };
      const playerHandler = {
        getVideoData: vi.fn(() => ({ video_id: 'v123' })),
        getPlayerState: vi.fn(() => CONSTANTS.PLAYER.STATE.PAUSED),
        playTrack: vi.fn(),
        pauseTrack: vi.fn(),
        seekBy: vi.fn()
      };

      const el = MediaItem.render(media, playerHandler);
      const controls = el.querySelector('.yt-music-plus-controls');
      expect(controls.classList.contains('hidden')).toBe(false);

      const playBtn = controls.querySelector('.btn-play');
      const pauseBtn = controls.querySelector('.btn-pause');

      // Play click
      playBtn.dispatchEvent(new MouseEvent('click'));
      expect(playerHandler.playTrack).toHaveBeenCalledWith('v123');
      expect(playBtn.classList.contains('hidden')).toBe(true);
      expect(pauseBtn.classList.contains('hidden')).toBe(false);

      // Pause click
      pauseBtn.dispatchEvent(new MouseEvent('click'));
      expect(playerHandler.pauseTrack).toHaveBeenCalled();
      expect(playBtn.classList.contains('hidden')).toBe(false);
      expect(pauseBtn.classList.contains('hidden')).toBe(true);
    });
  });

  describe('MediaGridRow', () => {
    it('should render a row with original and replacement media', () => {
      const original = { name: 'Orig', videoId: 'o1' };
      const replacement = { name: 'Repl', videoId: 'r1', isGoodMatch: true };
      
      const row = MediaGridRow.render(original, replacement, 5);
      
      expect(row.dataset.serialNumber).toBe('5');
      expect(row.querySelector('.grid-col-serial').textContent).toBe('5');
      expect(row.querySelector('.grid-col-original').textContent).toContain('Orig');
      expect(row.querySelector('.grid-col-replacement').textContent).toContain('Repl');
      
      const checkbox = row.querySelector('.item-checkbox');
      expect(checkbox.checked).toBe(true);
    });

    it('should handle mismatch warning', () => {
      const original = { name: 'Orig' };
      const replacement = { name: 'Repl', videoId: 'r1', isGoodMatch: false };
      
      const row = MediaGridRow.render(original, replacement);
      const replacementCol = row.querySelector('.grid-col-replacement');
      
      expect(replacementCol.classList.contains('potential-mismatch')).toBe(true);
      expect(replacementCol.querySelector('.warning-icon').classList.contains('hidden')).toBe(false);
    });

    it('should toggle checkbox on original column click', () => {
      const original = { name: 'Orig' };
      const replacement = { name: 'Repl', videoId: 'r1' };
      const row = MediaGridRow.render(original, replacement);
      const checkbox = row.querySelector('.item-checkbox');
      const originalCol = row.querySelector('.grid-col-original');

      checkbox.checked = false;
      originalCol.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      
      expect(checkbox.checked).toBe(true);
      expect(checkbox.dataset.userInteracted).toBe('true');
    });

    it('should disable checkbox if no replacement and not in list-only mode', () => {
      const original = { name: 'Orig' };
      const row = MediaGridRow.render(original, null);
      const checkbox = row.querySelector('.item-checkbox');
      
      expect(checkbox.disabled).toBe(true);
    });

    it('should NOT disable checkbox if no replacement but in list-only mode', () => {
      const gridWrapper = document.querySelector('.items-grid-wrapper');
      gridWrapper.classList.add('list-only-mode');

      const original = { name: 'Orig' };
      const row = MediaGridRow.render(original, null);
      const checkbox = row.querySelector('.item-checkbox');
      
      expect(checkbox.disabled).toBe(false);
    });

    it('should NOT disable checkbox if there is a replacement even if not in list-only mode', () => {
      const original = { name: 'Orig' };
      const replacement = { name: 'Repl', videoId: 'r1' };
      const row = MediaGridRow.render(original, replacement);
      const checkbox = row.querySelector('.item-checkbox');
      
      expect(checkbox.disabled).toBe(false);
    });
  });

  describe('PlaylistCard', () => {
    it('should render playlist information', () => {
      const playlist = {
        title: 'My Playlist',
        thumbnail: 'thumb.jpg',
        subtitle: '10 tracks'
      };
      
      const card = PlaylistCard.render(playlist);
      expect(card.querySelector('.playlist-card-title').textContent).toBe('My Playlist');
      expect(card.querySelector('.playlist-card-thumbnail').src).toContain('thumb.jpg');
      expect(card.querySelector('.playlist-card-meta').textContent).toBe('10 tracks');
    });
  });
});
