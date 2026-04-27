import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YTMusicAPI } from '../../scripts/yt-music-api.js';
import { Track } from '../../scripts/models/track.js';

describe('YTMusicAPI', () => {
  let api;

  beforeEach(() => {
    api = new YTMusicAPI();
    vi.clearAllMocks();
  });

  it('should set auth token correctly', () => {
    api.setAuthToken('Bearer token');
    expect(api.isAuthTokenSet()).toBe(true);
    expect(api.authToken).toBe('Bearer token');
  });

  describe('makePostRequest', () => {
    it('should make a POST request with correct headers and body', async () => {
      const mockResponse = { data: 'test' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      api.setAuthToken('Bearer token');
      const result = await api.makePostRequest('/test-endpoint', { foo: 'bar' });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ foo: 'bar' }),
        })
      );
    });
  });

  describe('searchMusic', () => {
    it('should build query string correctly using Track instance', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const track = new Track({
        name: 'Shake It Off',
        artists: ['Taylor Swift'],
        album: '1989'
      });

      await api.searchMusic(track);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/search'),
        expect.objectContaining({
          body: expect.stringContaining('Shake It Off - 1989 - Taylor Swift')
        })
      );
    });
  });

  describe('addItemToPlaylist', () => {
    it('should send correct add action', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'STATUS_SUCCEEDED' }),
      });

      const result = await api.addItemToPlaylist('PL123', 'vid456');
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('edit_playlist'),
        expect.objectContaining({
          body: expect.stringContaining('ACTION_ADD_VIDEO')
        })
      );
    });
  });

  describe('addItemsToPlaylist', () => {
    it('should return true for empty videoIds', async () => {
      const result = await api.addItemsToPlaylist('PL123', []);
      expect(result).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should send correct bulk add actions', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'STATUS_SUCCEEDED' }),
      });

      const videoIds = ['vid1', 'vid2'];
      const result = await api.addItemsToPlaylist('PL123', videoIds);
      
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('edit_playlist'),
        expect.objectContaining({
          body: expect.stringContaining('"action":"ACTION_ADD_VIDEO","addedVideoId":"vid1"')
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('edit_playlist'),
        expect.objectContaining({
          body: expect.stringContaining('"action":"ACTION_ADD_VIDEO","addedVideoId":"vid2"')
        })
      );
    });
  });

  describe('removeItemsFromPlaylist', () => {
    it('should return true for empty items', async () => {
      const result = await api.removeItemsFromPlaylist('PL123', []);
      expect(result).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should send correct bulk remove actions', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'STATUS_SUCCEEDED' }),
      });

      const items = [
        { videoId: 'vid1', setVideoId: 'set1' },
        { videoId: 'vid2', setVideoId: 'set2' }
      ];
      const result = await api.removeItemsFromPlaylist('PL123', items);
      
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('edit_playlist'),
        expect.objectContaining({
          body: expect.stringContaining('"action":"ACTION_REMOVE_VIDEO","removedVideoId":"vid1","setVideoId":"set1"')
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('edit_playlist'),
        expect.objectContaining({
          body: expect.stringContaining('"action":"ACTION_REMOVE_VIDEO","removedVideoId":"vid2","setVideoId":"set2"')
        })
      );
    });
  });
});
