import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YTMusicAPI } from '../../scripts/yt-music-api.js';

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

    it('should throw error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(api.makePostRequest('/bad')).rejects.toThrow('HTTP error! status: 404');
    });
  });

  describe('searchMusic', () => {
    it('should build query string correctly', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const query = {
        name: 'Shake It Off',
        artists: ['Taylor Swift'],
        album: '1989'
      };

      await api.searchMusic(query);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/search'),
        expect.objectContaining({
          body: expect.stringContaining('Shake It Off - 1989 - Taylor Swift')
        })
      );
    });
  });

  describe('parseEditablePlaylistsFromResponse', () => {
    it('should parse playlists correctly', () => {
      const mockData = {
        contents: {
          singleColumnBrowseResultsRenderer: {
            tabs: [{
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [{
                      gridRenderer: {
                        items: [{
                          musicTwoRowItemRenderer: {
                            title: { runs: [{ text: 'Playlist Title' }] },
                            subtitle: { runs: [{ text: 'Owner' }] },
                            menu: {
                              menuRenderer: {
                                items: [{
                                  menuNavigationItemRenderer: {
                                    navigationEndpoint: {
                                      playlistEditorEndpoint: { playlistId: 'PL123' }
                                    }
                                  }
                                }]
                              }
                            },
                            thumbnailRenderer: {
                              musicThumbnailRenderer: {
                                thumbnail: {
                                  thumbnails: [{ url: 'thumb-url' }]
                                }
                              }
                            }
                          }
                        }]
                      }
                    }]
                  }
                }
              }
            }]
          }
        }
      };

      const playlists = api.parseEditablePlaylistsFromResponse(mockData);
      expect(playlists).toHaveLength(1);
      expect(playlists[0]).toEqual({
        id: 'PL123',
        title: 'Playlist Title',
        subtitle: 'Owner',
        owner: 'Owner',
        thumbnail: 'thumb-url'
      });
    });
  });

  describe('parsePlaylistItemsFromResponse', () => {
    it('should parse playlist items correctly', () => {
      const mockItems = [{
        musicResponsiveListItemRenderer: {
          flexColumns: [
            {
              musicResponsiveListItemFlexColumnRenderer: {
                text: { runs: [{ text: 'Song Name' }] }
              }
            },
            {
              musicResponsiveListItemFlexColumnRenderer: {
                text: { runs: [{ text: 'Artist Name' }] }
              }
            },
            {
              musicResponsiveListItemFlexColumnRenderer: {
                text: { runs: [{ text: 'Album Name' }] }
              }
            }
          ],
          fixedColumns: [{
            musicResponsiveListItemFixedColumnRenderer: {
              text: { runs: [{ text: '3:45' }] }
            }
          }],
          playlistItemData: {
            videoId: 'vid123',
            playlistSetVideoId: 'set123'
          }
        }
      }];

      const items = api.parsePlaylistItemsFromResponse(mockItems);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        name: 'Song Name',
        artists: ['Artist Name'],
        album: 'Album Name',
        duration: '3:45',
        videoId: 'vid123',
        playlistSetVideoId: 'set123'
      });
    });
  });
});
