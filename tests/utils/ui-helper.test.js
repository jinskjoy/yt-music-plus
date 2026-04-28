import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UIHelper, MediaItem, MediaGridRow } from '../../utils/ui-helper.js';
import { CONSTANTS } from '../../utils/constants.js';
import fs from 'fs';
import path from 'path';

describe('UIHelper', () => {
  beforeEach(() => {
    const htmlPath = path.resolve(__dirname, '../../html/in-site-popup.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = htmlContent;
    vi.clearAllMocks();
  });

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

  describe('MediaItem.render', () => {
    it('should create a media item element', () => {
      const media = {
        name: 'Test Song',
        artist: 'Test Artist',
        url: 'https://youtube.com/watch?v=123',
        thumbnail: 'https://img.com/123.jpg'
      };

      const el = MediaItem.render(media);
      expect(el.querySelector('.yt-music-plus-media-title').textContent).toBe('Test Song');
      expect(el.querySelector('.yt-music-plus-media-artist').textContent).toBe('Test Artist');
      expect(el.querySelector('.yt-music-plus-media-link').href).toBe('https://youtube.com/watch?v=123');
      expect(el.querySelector('.yt-music-plus-media-thumbnail').src).toBe('https://img.com/123.jpg');
    });

    it('should show/hide play and pause buttons on hover based on player state', () => {
      const media = { videoId: 'vid123', name: 'Test Song' };
      const playerHandler = {
        getVideoData: vi.fn(),
        getPlayerState: vi.fn(),
        playTrack: vi.fn(),
        pauseTrack: vi.fn(),
        seekBy: vi.fn()
      };

      const el = MediaItem.render(media, playerHandler);
      const mediaInfo = el.querySelector('.yt-music-plus-media-info');
      const playBtn = el.querySelector('.yt-music-plus-btn-play');
      const pauseBtn = el.querySelector('.yt-music-plus-btn-pause');

      // Case 1: Playing the current track
      playerHandler.getVideoData.mockReturnValue({ video_id: 'vid123' });
      playerHandler.getPlayerState.mockReturnValue(CONSTANTS.PLAYER.STATE.PLAYING); // Playing
      
      mediaInfo.dispatchEvent(new MouseEvent('mouseenter'));
      expect(playBtn.classList.contains('yt-music-plus-hidden')).toBe(true);
      expect(pauseBtn.classList.contains('yt-music-plus-hidden')).toBe(false);

      // Case 2: Paused on the current track
      playerHandler.getPlayerState.mockReturnValue(CONSTANTS.PLAYER.STATE.PAUSED); // Paused
      mediaInfo.dispatchEvent(new MouseEvent('mouseenter'));
      expect(playBtn.classList.contains('yt-music-plus-hidden')).toBe(false);
      expect(pauseBtn.classList.contains('yt-music-plus-hidden')).toBe(true);

      // Case 3: Different track playing
      playerHandler.getVideoData.mockReturnValue({ video_id: 'different' });
      playerHandler.getPlayerState.mockReturnValue(CONSTANTS.PLAYER.STATE.PLAYING); // Playing
      mediaInfo.dispatchEvent(new MouseEvent('mouseenter'));
      expect(playBtn.classList.contains('yt-music-plus-hidden')).toBe(false);
      expect(pauseBtn.classList.contains('yt-music-plus-hidden')).toBe(true);
    });
  });

  describe('updateCheckAllCheckbox', () => {
    it('should update select-all checkbox and button states', () => {
      const selectAll = document.getElementById('yt-music-plus-selectAllCheckbox');
      const replaceBtn = document.getElementById('yt-music-plus-replaceSelectedBtn');
      const container = document.getElementById('yt-music-plus-itemsGridContainer');

      // Add a row with a replacement
      const row = MediaGridRow.render({ name: 'O' }, { name: 'R', videoId: 'v1' });
      container.appendChild(row);
      const checkbox = row.querySelector('.yt-music-plus-item-checkbox');

      UIHelper.updateCheckAllCheckbox();
      expect(selectAll.checked).toBe(true);
      expect(replaceBtn.disabled).toBe(false);

      // Uncheck it
      checkbox.checked = false;
      UIHelper.updateCheckAllCheckbox();
      expect(selectAll.checked).toBe(false);
      expect(replaceBtn.disabled).toBe(true);
    });

    it('should disable Add and Replace buttons in list-only-mode', () => {
      const container = document.getElementById('yt-music-plus-itemsGridContainer');
      const gridWrapper = document.querySelector('.yt-music-plus-items-grid-wrapper');
      gridWrapper.classList.add('yt-music-plus-list-only-mode');

      // Add a row with a replacement
      const row = MediaGridRow.render({ name: 'O' }, { name: 'R', videoId: 'v1' });
      container.appendChild(row);
      row.querySelector('.yt-music-plus-item-checkbox').checked = true;

      UIHelper.updateCheckAllCheckbox();

      expect(document.getElementById('yt-music-plus-replaceSelectedBtn').disabled).toBe(true);
      expect(document.getElementById('yt-music-plus-addSelectedBtn').disabled).toBe(true);
      expect(document.getElementById('yt-music-plus-removeSelectedBtn').disabled).toBe(false);
    });
  });

  describe('toggleGrid', () => {
    it('should toggle collapsed class and button text', () => {
      const infoSection = document.querySelector('.yt-music-plus-playlist-info-section');
      const toggleBtn = document.getElementById('yt-music-plus-toggleGridBtn');
      
      UIHelper.toggleGrid(true);
      expect(infoSection.classList.contains('yt-music-plus-collapsed')).toBe(true);
      expect(toggleBtn.textContent).toBe('⤡');

      UIHelper.toggleGrid(false);
      expect(infoSection.classList.contains('yt-music-plus-collapsed')).toBe(false);
      expect(toggleBtn.textContent).toBe('⤢');
    });
  });
});
