import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YTMusicAPI } from '../../scripts/yt-music-api.js';
import { Track } from '../../scripts/models/track.js';
import { YTMusicParser } from '../../scripts/yt-music-parser.js';

vi.mock('../../scripts/yt-music-parser.js', async () => {
  const actual = await vi.importActual('../../scripts/yt-music-parser.js');
  return {
    ...actual,
    YTMusicParser: {
      ...actual.YTMusicParser,
      parsePlaylistsFromResponse: vi.fn(),
      parsePlaylistItemsFromResponse: vi.fn(),
      getBestSearchResult: vi.fn()
    }
  };
});

describe('YTMusicAPI', () => {
  let api;

  beforeEach(() => {
    api = new YTMusicAPI();
    vi.clearAllMocks();
    global.fetch = vi.fn();
    delete global.window.ytcfg;
  });

  it('should set auth token correctly', () => {
    api.setAuthToken('Bearer token');
    expect(api.isAuthTokenSet()).toBe(true);
    expect(api.authToken).toBe('Bearer token');
  });

  describe('makeGetRequest', () => {
    it('should make a GET request with correct headers and params', async () => {
      const mockResponse = { data: 'test' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      api.setAuthToken('Bearer token');
      const result = await api.makeGetRequest('/test-endpoint', { foo: 'bar' });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringMatching(/https:\/\/music\.youtube\.com\/test-endpoint\?foo=bar/)
        }),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        })
      );
    });

    it('should throw error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(api.makeGetRequest('/error')).rejects.toThrow('HTTP error! status: 404');
    });
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
        expect.stringMatching(/https:\/\/music\.youtube\.com\/test-endpoint/),
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

    it('should throw error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(api.makePostRequest('/error')).rejects.toThrow('HTTP error! status: 500');
    });
  });

  describe('getInnertubeContext', () => {
    it('should return context from window.ytcfg.data_.INNERTUBE_CONTEXT', () => {
      global.window.ytcfg = {
        data_: {
          INNERTUBE_CONTEXT: { client: { name: 'WEB' } }
        }
      };
      expect(api.getInnertubeContext()).toEqual({ client: { name: 'WEB' } });
    });

    it('should return context from window.ytcfg.INNERTUBE_CONTEXT', () => {
      global.window.ytcfg = {
        INNERTUBE_CONTEXT: { client: { name: 'REMIX' } }
      };
      expect(api.getInnertubeContext()).toEqual({ client: { name: 'REMIX' } });
    });

    it('should return empty object if no context found', () => {
      expect(api.getInnertubeContext()).toEqual({});
    });
  });

  describe('getPlaylists', () => {
    it('should fetch and merge playlists from multiple browse IDs', async () => {
      const mockResponse1 = { contents: { /* some playlist data */ } };
      const mockResponse2 = { contents: { /* some other data */ } };
      
      const spyPost = vi.spyOn(api, 'makePostRequest')
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);
      
      const spyParser = vi.spyOn(YTMusicParser, 'parsePlaylistsFromResponse');
      
      spyParser.mockReturnValueOnce([{ id: 'p1', isEditable: true }, { id: 'p2', isEditable: false }])
                .mockReturnValueOnce([{ id: 'p1', isEditable: true }, { id: 'p3', isEditable: true }]);

      const playlists = await api.getPlaylists();
      
      expect(playlists).toHaveLength(3);
      expect(playlists.map(p => p.id)).toContain('p1');
      expect(playlists.map(p => p.id)).toContain('p2');
      expect(playlists.map(p => p.id)).toContain('p3');
      
      spyPost.mockRestore();
    });

    it('should filter only editable playlists if requested', async () => {
      vi.spyOn(api, 'makePostRequest').mockResolvedValue({});
      vi.spyOn(YTMusicParser, 'parsePlaylistsFromResponse').mockReturnValue([
        { id: 'p1', isEditable: true },
        { id: 'p2', isEditable: false }
      ]);

      const playlists = await api.getPlaylists(true);
      expect(playlists).toHaveLength(1);
      expect(playlists[0].id).toBe('p1');
    });

    it('should throw last error if no playlists found and an error occurred', async () => {
      vi.spyOn(api, 'makePostRequest').mockRejectedValue(new Error('Network Error'));
      await expect(api.getPlaylists()).rejects.toThrow('Network Error');
    });
    
    it('should return empty array if no playlists found and no error occurred', async () => {
       vi.spyOn(api, 'makePostRequest').mockResolvedValue({});
       vi.spyOn(YTMusicParser, 'parsePlaylistsFromResponse').mockReturnValue([]);
       
       const playlists = await api.getPlaylists();
       expect(playlists).toEqual([]);
    });
  });

  describe('getPlaylistItems', () => {
    it('should handle pagination with continuation tokens', async () => {
      const mockInitialResponse = { contents: { twoColumnBrowseResultsRenderer: { secondaryContents: { sectionListRenderer: { contents: [
        { musicPlaylistShelfRenderer: { contents: [{ musicResponsiveListItemRenderer: {} }], continuations: [{ nextContinuationData: { continuation: 'token1' } }] } }
      ] } } } } };
      
      const mockContinuationResponse = {
        onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [{ musicResponsiveListItemRenderer: {} }, { continuationItemRenderer: { continuationEndpoint: { token: 'token2' } } }] } }]
      };
      
      const mockLastContinuationResponse = {
        onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [{ musicResponsiveListItemRenderer: {} }] } }]
      };

      vi.spyOn(api, 'makePostRequest')
        .mockResolvedValueOnce(mockInitialResponse)
        .mockResolvedValueOnce(mockContinuationResponse)
        .mockResolvedValueOnce(mockLastContinuationResponse);

      vi.spyOn(YTMusicParser, 'parsePlaylistItemsFromResponse').mockReturnValue([{ name: 'Track' }]);

      const items = await api.getPlaylistItems('PL123');
      expect(items).toHaveLength(3);
      expect(api.makePostRequest).toHaveBeenCalledTimes(3);
    });

    it('should handle errors in getPlaylistItems', async () => {
      vi.spyOn(api, 'makePostRequest').mockRejectedValue(new Error('Fail'));
      await expect(api.getPlaylistItems('PL123')).rejects.toThrow('Fail');
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

  describe('Extraction methods', () => {
    it('extractPlaylistShelfRecords should handle different response structures', () => {
      expect(api.extractPlaylistShelfRecords(null)).toEqual([]);
      
      const resp1 = { contents: { twoColumnBrowseResultsRenderer: { secondaryContents: { sectionListRenderer: { contents: [
        { musicPlaylistShelfRenderer: { contents: [1, 2] } }
      ] } } } } };
      expect(api.extractPlaylistShelfRecords(resp1)).toEqual([1, 2]);
      
      const resp2 = { continuationContents: { musicPlaylistShelfContinuation: { contents: [3, 4] } } };
      expect(api.extractPlaylistShelfRecords(resp2)).toEqual([3, 4]);
    });

    it('extractContinuationRecords should handle different response structures', () => {
      expect(api.extractContinuationRecords(null)).toEqual([]);
      
      const resp1 = { onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [1] } }] };
      expect(api.extractContinuationRecords(resp1)).toEqual([1]);
      
      const resp2 = { continuationContents: { musicPlaylistShelfContinuation: { contents: [2] } } };
      expect(api.extractContinuationRecords(resp2)).toEqual([2]);
    });
  });

  describe('findContinuationToken', () => {
    it('should find token in items array', () => {
      const items = [
        { musicResponsiveListItemRenderer: {} },
        { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 't1' } } } }
      ];
      expect(api.findContinuationToken(items)).toBe('t1');
    });

    it('should find token in nested commandExecutorCommand', () => {
      const items = [{
        continuationItemRenderer: {
          continuationEndpoint: {
            commandExecutorCommand: {
              commands: [{ continuationCommand: { token: 't-nested' } }]
            }
          }
        }
      }];
      expect(api.findContinuationToken(items)).toBe('t-nested');
    });

    it('should find token in response object', () => {
      const resp = { contents: { twoColumnBrowseResultsRenderer: { secondaryContents: { sectionListRenderer: { contents: [
        { musicPlaylistShelfRenderer: { continuations: [{ nextContinuationData: { continuation: 't-resp' } }] } }
      ] } } } } };
      expect(api.findContinuationToken([], resp)).toBe('t-resp');
    });
    
    it('should return null if no token found', () => {
       expect(api.findContinuationToken([])).toBeNull();
    });
  });

  describe('removeItemFromPlaylist', () => {
    it('should throw error if status is not SUCCEEDED', async () => {
       global.fetch.mockResolvedValue({
         ok: true,
         json: async () => ({ status: 'STATUS_FAILED' }),
       });
       await expect(api.removeItemFromPlaylist('pl', 'v', 's')).rejects.toThrow('Failed to remove video');
    });
  });

  describe('getCurrentPlaylistIdFromURL', () => {
    it('should extract list parameter from URL', () => {
      expect(api.getCurrentPlaylistIdFromURL()).toBe('PLxyz');
    });
  });
});
