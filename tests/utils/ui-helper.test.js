import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UIHelper, MediaItem, MediaGridRow, PlaylistCard } from '../../utils/ui-helper.js';
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

    it('should handle media without thumbnail, artist or url', () => {
      const media = { name: 'Minimal Track' };
      const el = MediaItem.render(media);
      expect(el.querySelector('.yt-music-plus-media-thumbnail')).toBeNull();
      expect(el.querySelector('.yt-music-plus-media-artist')).toBeNull();
      expect(el.querySelector('.yt-music-plus-media-link')).toBeNull();
    });

    it('should handle local file playback', () => {
      const media = { name: 'Local Track', localFile: { name: 'test.mp3' } };
      const playerHandler = {
        isLocalFilePlaying: vi.fn().mockReturnValue(true),
        playLocalFile: vi.fn(),
        pauseTrack: vi.fn(),
        seekBy: vi.fn()
      };
      const el = MediaItem.render(media, playerHandler);
      const playBtn = el.querySelector('.yt-music-plus-btn-play');
      const pauseBtn = el.querySelector('.yt-music-plus-btn-pause');

      expect(playBtn.classList.contains('yt-music-plus-hidden')).toBe(true);
      expect(pauseBtn.classList.contains('yt-music-plus-hidden')).toBe(false);

      pauseBtn.click();
      expect(playerHandler.pauseTrack).toHaveBeenCalled();
    });

    it('should bind seek buttons', () => {
      const media = { videoId: 'v1' };
      const playerHandler = {
        getVideoData: vi.fn(),
        getPlayerState: vi.fn(),
        seekBy: vi.fn()
      };
      const el = MediaItem.render(media, playerHandler);
      el.querySelector('.yt-music-plus-btn-seek-back').click();
      el.querySelector('.yt-music-plus-btn-seek-forward').click();
      expect(playerHandler.seekBy).toHaveBeenCalledWith(-10);
      expect(playerHandler.seekBy).toHaveBeenCalledWith(10);
    });
  });

  describe('MediaGridRow.render', () => {
    it('should render a row with original and replacement media', () => {
      const original = { name: 'Original', videoId: 'v1' };
      const replacement = { name: 'Replacement', videoId: 'v2', isGoodMatch: true };
      const row = MediaGridRow.render(original, replacement, 5);

      expect(row.dataset.serialNumber).toBe('5');
      expect(row.dataset.videoId).toBe('v1');
      expect(row.querySelector('.yt-music-plus-grid-col-serial').textContent).toBe('5');
      expect(row.querySelector('.yt-music-plus-item-checkbox').checked).toBe(true);
    });

    it('should show warning for mismatch or duplicate', () => {
      const original = { name: 'Original' };
      const replacement = { name: 'Mismatch', isGoodMatch: false };
      const row = MediaGridRow.render(original, replacement);

      expect(row.querySelector('.yt-music-plus-grid-col-replacement').classList.contains('yt-music-plus-potential-mismatch')).toBe(true);
      
      const duplicate = { name: 'Duplicate', isDuplicate: true };
      const row2 = MediaGridRow.render(original, duplicate);
      expect(row2.querySelector('.yt-music-plus-warning-message-text').textContent).toBe(CONSTANTS.UI.STRINGS.ALREADY_IN_PLAYLIST);
    });

    it('should toggle checkbox when clicking original column', () => {
      const row = MediaGridRow.render({ name: 'O' }, { name: 'R', videoId: 'v1' });
      const checkbox = row.querySelector('.yt-music-plus-item-checkbox');
      const originalCol = row.querySelector('.yt-music-plus-grid-col-original');

      expect(checkbox.checked).toBe(true);
      originalCol.click();
      expect(checkbox.checked).toBe(false);
    });
  });

  describe('PlaylistCard.render', () => {
    it('should render a playlist card', () => {
      const playlist = { title: 'My Playlist', subtitle: '10 tracks', thumbnail: 'thumb.jpg' };
      const card = PlaylistCard.render(playlist);
      expect(card.querySelector('.yt-music-plus-playlist-card-title').textContent).toBe('My Playlist');
      expect(card.querySelector('.yt-music-plus-playlist-card-thumbnail').src).toContain('thumb.jpg');
    });
  });

  describe('UIHelper Status and Details', () => {
    it('showStatus should update element content and classes', () => {
      vi.useFakeTimers();
      const el = document.createElement('div');
      UIHelper.showStatus(el, 'Success Message', 'success', 100);
      
      expect(el.textContent).toBe('Success Message');
      expect(el.classList.contains('success')).toBe(true);
      expect(el.classList.contains('show')).toBe(true);

      vi.advanceTimersByTime(100);
      expect(el.classList.contains('show')).toBe(false);
      vi.useRealTimers();
    });

    it('setPlaylistDetails should update multiple elements', () => {
      const playlist = { title: 'T', subtitle: 'S', owner: 'O', thumbnail: 'url' };
      UIHelper.setPlaylistDetails(playlist);
      
      expect(document.getElementById('yt-music-plus-playlistName').textContent).toBe('T');
      expect(document.getElementById('yt-music-plus-playlistTrackCount').textContent).toBe('S');
      expect(document.getElementById('yt-music-plus-playlistDescription').textContent).toBe('O');
      expect(document.getElementById('yt-music-plus-playlistThumbnail').src).toContain('url');
    });
  });

  describe('UIHelper Grid Operations', () => {
    it('createMediaGridRows should populate container', () => {
      const records = [
        { originalMedia: { name: 'O1' }, replacementMedia: { name: 'R1' } },
        { originalMedia: { name: 'O2' }, replacementMedia: { name: 'R2' } }
      ];
      UIHelper.createMediaGridRows(records);
      const container = document.getElementById('yt-music-plus-itemsGridContainer');
      expect(container.querySelectorAll('.yt-music-plus-grid-row')).toHaveLength(2);
    });

    it('removeMediaGridRow should remove row by videoId or name', () => {
      const container = document.getElementById('yt-music-plus-itemsGridContainer');
      const row1 = MediaGridRow.render({ name: 'O1', videoId: 'v1' }, {});
      const row2 = MediaGridRow.render({ name: 'O2' }, {});
      container.appendChild(row1);
      container.appendChild(row2);

      UIHelper.removeMediaGridRow({ videoId: 'v1' });
      expect(container.querySelectorAll('.yt-music-plus-grid-row')).toHaveLength(1);

      UIHelper.removeMediaGridRow({ name: 'O2' });
      expect(container.querySelectorAll('.yt-music-plus-grid-row')).toHaveLength(0);
    });

    it('showErrorInGridRow should append error message', () => {
      const container = document.getElementById('yt-music-plus-itemsGridContainer');
      const row = MediaGridRow.render({ name: 'O1', videoId: 'v1' }, {});
      container.appendChild(row);

      UIHelper.showErrorInGridRow({ videoId: 'v1' }, 'Test Error');
      const errorMsg = row.querySelector('.yt-music-plus-error-message');
      expect(errorMsg.textContent).toBe('Error: Test Error');
    });

    it('getSelectedMediaItems should return checked items', () => {
      const container = document.getElementById('yt-music-plus-itemsGridContainer');
      const row1 = MediaGridRow.render({ name: 'O1' }, { name: 'R1' });
      const row2 = MediaGridRow.render({ name: 'O2' }, { name: 'R2' });
      container.appendChild(row1);
      container.appendChild(row2);
      
      row1.querySelector('.yt-music-plus-item-checkbox').checked = true;
      row2.querySelector('.yt-music-plus-item-checkbox').checked = false;

      const selected = UIHelper.getSelectedMediaItems();
      expect(selected).toHaveLength(1);
      expect(selected[0].originalMedia.name).toBe('O1');
    });
  });

  describe('UIHelper Templates and Toggles', () => {
    it('createActionButtons should clone template', () => {
      const btns = UIHelper.createActionButtons();
      expect(btns.id).toBe('yt-music-plus-action-buttons');
    });

    it('createNoPlaylistsMessage should clone template', () => {
      const msg = UIHelper.createNoPlaylistsMessage();
      expect(msg.classList.contains('yt-music-plus-no-playlists-message')).toBe(true);
    });

    it('toggleGrid should work without forceExpand', () => {
      const infoSection = document.querySelector('.yt-music-plus-playlist-info-section');
      infoSection.classList.remove('yt-music-plus-collapsed');
      
      UIHelper.toggleGrid();
      expect(infoSection.classList.contains('yt-music-plus-collapsed')).toBe(true);
      
      UIHelper.toggleGrid();
      expect(infoSection.classList.contains('yt-music-plus-collapsed')).toBe(false);
    });
  });
});
