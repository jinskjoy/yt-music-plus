import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YTMusicAPI } from '../../scripts/yt-music-api.js';
import { YTMusicParser } from '../../scripts/yt-music-parser.js';

describe('YTMusicAPI Extended', () => {
  let api;

  beforeEach(() => {
    api = new YTMusicAPI();
    vi.clearAllMocks();
    
    // Default mock for fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    });
  });

  describe('makeGetRequest', () => {
    it('should make a GET request with correct params and headers', async () => {
      api.setAuthToken('token123');
      await api.makeGetRequest('/get-test', { a: 1, b: 'two' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'GET',
          credentials: 'same-origin',
          headers: expect.objectContaining({
            Authorization: 'token123'
          })
        })
      );

      const firstCallUrl = global.fetch.mock.calls[0][0].toString();
      expect(firstCallUrl).toContain('/get-test?a=1&b=two');
    });

    it('should throw error on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(api.makeGetRequest('/fail')).rejects.toThrow('HTTP error! status: 404');
    });
  });

  describe('makePostRequest', () => {
    it('should throw error on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(api.makePostRequest('/fail')).rejects.toThrow('HTTP error! status: 500');
    });
  });

  describe('getInnertubeContext', () => {
    it('should return context from ytcfg.data_.INNERTUBE_CONTEXT', () => {
      const mockContext = { client: 'test' };
      global.window.ytcfg = { data_: { INNERTUBE_CONTEXT: mockContext } };
      expect(api.getInnertubeContext()).toEqual(mockContext);
    });

    it('should return context from ytcfg.INNERTUBE_CONTEXT', () => {
      const mockContext = { client: 'test2' };
      global.window.ytcfg = { INNERTUBE_CONTEXT: mockContext };
      expect(api.getInnertubeContext()).toEqual(mockContext);
    });

    it('should return empty object if no context found', () => {
      global.window.ytcfg = {};
      expect(api.getInnertubeContext()).toEqual({});
    });
  });

  describe('getPlaylists', () => {
    it('should fetch and parse playlists from multiple browse IDs', async () => {
      const spyFetch = vi.spyOn(api, 'fetchBrowsePlaylists').mockResolvedValue({});
      const spyParse = vi.spyOn(YTMusicParser, 'parsePlaylistsFromResponse').mockReturnValue([
        { id: 'p1', isEditable: true },
        { id: 'p2', isEditable: false }
      ]);

      const result = await api.getPlaylists();
      
      expect(spyFetch).toHaveBeenCalledTimes(2); // Based on CONSTANTS.API.PLAYLIST_BROWSE_IDS
      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toEqual(['p1', 'p2']);
    });

    it('should filter only editable when requested', async () => {
      vi.spyOn(api, 'fetchBrowsePlaylists').mockResolvedValue({});
      vi.spyOn(YTMusicParser, 'parsePlaylistsFromResponse').mockReturnValue([
        { id: 'p1', isEditable: true },
        { id: 'p2', isEditable: false }
      ]);

      const result = await api.getPlaylists(true);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
    });

    it('should throw error if all fetches fail', async () => {
      vi.spyOn(api, 'fetchBrowsePlaylists').mockRejectedValue(new Error('Network Error'));
      await expect(api.getPlaylists()).rejects.toThrow('Network Error');
    });

    it('should return empty array if no playlists found and no error', async () => {
      vi.spyOn(api, 'fetchBrowsePlaylists').mockResolvedValue({});
      vi.spyOn(YTMusicParser, 'parsePlaylistsFromResponse').mockReturnValue([]);
      
      const result = await api.getPlaylists();
      expect(result).toEqual([]);
    });
  });

  describe('getPlaylistItems', () => {
    it('should handle pagination with continuation tokens', async () => {
      const firstResponse = {
        contents: {
          twoColumnBrowseResultsRenderer: {
            secondaryContents: {
              sectionListRenderer: {
                contents: [{
                  musicPlaylistShelfRenderer: {
                    contents: [
                      { musicResponsiveListItemRenderer: {} },
                      { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'token1' } } } }
                    ]
                  }
                }]
              }
            }
          }
        }
      };

      const continuationResponse = {
        onResponseReceivedActions: [{
          appendContinuationItemsAction: {
            continuationItems: [
              { musicResponsiveListItemRenderer: {} }
            ]
          }
        }]
      };

      vi.spyOn(api, 'makePostRequest')
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(continuationResponse);

      const spyParse = vi.spyOn(YTMusicParser, 'parsePlaylistItemsFromResponse')
        .mockReturnValueOnce([{ id: 't1' }])
        .mockReturnValueOnce([{ id: 't2' }]);

      const items = await api.getPlaylistItems('PL123');
      
      expect(items).toHaveLength(2);
      expect(items).toEqual([{ id: 't1' }, { id: 't2' }]);
      expect(api.makePostRequest).toHaveBeenCalledTimes(2);
    });

    it('should handle response with no continuation', async () => {
      const response = {
        contents: {
          twoColumnBrowseResultsRenderer: {
            secondaryContents: {
              sectionListRenderer: {
                contents: [{
                  musicPlaylistShelfRenderer: {
                    contents: [{ musicResponsiveListItemRenderer: {} }]
                  }
                }]
              }
            }
          }
        }
      };

      vi.spyOn(api, 'makePostRequest').mockResolvedValueOnce(response);
      vi.spyOn(YTMusicParser, 'parsePlaylistItemsFromResponse').mockReturnValueOnce([{ id: 't1' }]);

      const items = await api.getPlaylistItems('PL123');
      expect(items).toHaveLength(1);
      expect(api.makePostRequest).toHaveBeenCalledTimes(1);
    });

    it('should throw error if request fails', async () => {
      vi.spyOn(api, 'makePostRequest').mockRejectedValue(new Error('API Error'));
      await expect(api.getPlaylistItems('PL123')).rejects.toThrow('API Error');
    });
  });

  describe('removeItemFromPlaylist', () => {
    it('should throw error if status is not SUCCEEDED', async () => {
      vi.spyOn(api, 'makePostRequest').mockResolvedValue({ status: 'STATUS_FAILED' });
      await expect(api.removeItemFromPlaylist('PL1', 'v1', 's1')).rejects.toThrow('Failed to remove video from playlist');
    });
    
    it('should return true on success', async () => {
      vi.spyOn(api, 'makePostRequest').mockResolvedValue({ status: 'STATUS_SUCCEEDED' });
      const result = await api.removeItemFromPlaylist('PL1', 'v1', 's1');
      expect(result).toBe(true);
    });
  });

  describe('getCurrentPlaylistIdFromURL', () => {
    it('should extract list param from current URL', () => {
      // window.location is mocked in setup.js to have ?list=PLxyz
      expect(api.getCurrentPlaylistIdFromURL()).toBe('PLxyz');
    });
  });
});
